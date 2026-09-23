// Solo crea/elimina una base local temporal de nombre aleatorio, nunca la operativa.
const { Client } = require('pg');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
(async () => {
  if (!process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL hacia PostgreSQL local para crear una base temporal de prueba.');
  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Las pruebas requieren PostgreSQL local.');
  const name = 'fiix_cmms_test_weekly_' + randomUUID().replaceAll('-', '');
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`); created = true;
    url.pathname = '/' + name;
    const temporary = new Client({ connectionString: url.toString() });
    await temporary.connect();
    try { await temporary.query(fs.readFileSync(path.join(root, 'prisma/migrations/20260923120000_weekly_work_order_progress/migration.sql'), 'utf8')); }
    finally { await temporary.end(); }
    const env = { ...process.env, DATABASE_URL: url.toString(), TZ: 'UTC' };
    for (const [command, args] of [
      [path.join(root, 'node_modules/.bin/prisma'), ['db', 'push']],
      [path.join(root, 'node_modules/.bin/ts-node'), ['--transpile-only', '-P', 'tests/tsconfig.json', 'tests/weeklyProgress.integration.ts']],
    ]) {
      const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
      if (result.status !== 0) throw new Error('Falló la prueba aislada de avance semanal.');
    }
  } finally {
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
