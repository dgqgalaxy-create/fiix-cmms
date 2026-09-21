/**
 * Prueba de integración AISLADA de los endurecimientos (v1.63.0):
 *  1) Candado de importación: exclusión mutua real (no dos importaciones a la vez).
 *  2) Proxy de imágenes: validación anti-SSRF (protocolo, hosts e IPs privadas).
 *  3) Preferencias: el cliente NO puede pisar el candado del menú de desarrollador.
 * Base temporal fiix_cmms_test_*; NUNCA toca la operativa.
 * Ejecutar desde backend/: bash scripts/run-hardening-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import {
  tryStartImportJob,
  endImportJob,
  isImportJobActive,
  isMaintenanceActive,
} from '../src/utils/maintenance';
import { isPrivateIp, assertSafeRemoteUrl, isImageContentType } from '../src/utils/imageProxySafety';
import { updateMyPreferences } from '../src/controllers/userController';

function makeRes() {
  const res: any = { _status: 0, _body: undefined };
  res.status = (code: number) => {
    res._status = code;
    return res;
  };
  res.json = (body: unknown) => {
    if (res._status === 0) res._status = 200;
    res._body = body;
    return res;
  };
  return res;
}

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  // ---- 1) Candado de importación ----
  {
    assert.equal(isImportJobActive(), false);
    assert.equal(await tryStartImportJob('prueba 1'), true);
    assert.equal(isImportJobActive(), true);
    assert.equal(isMaintenanceActive(), true);
    assert.equal(await tryStartImportJob('prueba 2'), false, 'la segunda importación se rechaza');
    await endImportJob();
    assert.equal(isImportJobActive(), false);
    assert.equal(isMaintenanceActive(), false);
    assert.equal(await tryStartImportJob('prueba 3'), true, 'tras terminar se puede volver a importar');
    await endImportJob();
    await endImportJob(); // idempotente
    assert.equal(isMaintenanceActive(), false);
    console.log('  ✓ Candado de importación: exclusión mutua y liberación idempotente');
  }

  // ---- 2) Anti-SSRF ----
  {
    for (const ip of ['10.0.0.5', '172.16.3.4', '192.168.1.10', '127.0.0.1', '169.254.169.254', '100.101.102.103', '::1', 'fd00::1', 'fe80::1']) {
      assert.equal(isPrivateIp(ip), true, `${ip} debe ser privada`);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
      assert.equal(isPrivateIp(ip), false, `${ip} debe ser pública`);
    }

    for (const bad of [
      'ftp://example.com/x.png',
      'http://localhost/x.png',
      'http://127.0.0.1:3000/api/health',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/x.png',
      'http://192.168.1.50/logo.png',
      'http://algo.local/x.png',
    ]) {
      const r = await assertSafeRemoteUrl(bad);
      assert.equal(r.ok, false, `${bad} debe rechazarse`);
    }
    assert.equal(isImageContentType('image/png'), true);
    assert.equal(isImageContentType('text/html'), false);
    console.log('  ✓ Proxy de imágenes: rechaza protocolos, hosts locales e IPs privadas');
  }

  // ---- 3) Preferencias no pueden pisar el candado dev ----
  {
    const user = await prisma.user.create({
      data: {
        name: 'Prefs',
        email: `prefs-${Date.now()}@test.local`,
        password_hash: 'x',
        role: 'TECNICO',
        preferences: { theme: 'dark', dev_menu_lock: { failedAttempts: 3, lockedUntil: new Date(Date.now() + 3_600_000).toISOString() } },
      },
    });

    const res = makeRes();
    await updateMyPreferences(
      {
        body: {
          preferences: {
            theme: 'light',
            sidebar: 'compact',
            dev_menu_lock: { failedAttempts: 0, lockedUntil: null }, // intento de bypass
          },
        },
        user: { userId: user.id },
      } as any,
      res as any
    );
    assert.equal(res._status, 200, `updateMyPreferences respondió ${res._status}`);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const prefs = after.preferences as Record<string, any>;
    assert.equal(prefs.theme, 'light', 'la preferencia nueva se aplica');
    assert.equal(prefs.sidebar, 'compact', 'se fusionan claves nuevas');
    assert.equal(prefs.dev_menu_lock?.failedAttempts, 3, 'el candado dev NO se puede pisar');
    assert.ok(prefs.dev_menu_lock?.lockedUntil, 'el bloqueo sigue vigente');

    // Y si el usuario intenta borrarlo sin tener candado, tampoco se crea
    const user2 = await prisma.user.create({
      data: { name: 'Prefs2', email: `prefs2-${Date.now()}@test.local`, password_hash: 'x', role: 'TECNICO', preferences: {} },
    });
    const res2 = makeRes();
    await updateMyPreferences(
      { body: { preferences: { theme: 'light', dev_menu_lock: { failedAttempts: 0 } } }, user: { userId: user2.id } } as any,
      res2 as any,
    );
    const after2 = await prisma.user.findUniqueOrThrow({ where: { id: user2.id } });
    assert.equal((after2.preferences as Record<string, unknown>).dev_menu_lock, undefined);
    console.log('  ✓ Preferencias: fusión en servidor y candado dev protegido');
  }

  console.log('\nTodas las comprobaciones de endurecimiento pasaron ✔');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
