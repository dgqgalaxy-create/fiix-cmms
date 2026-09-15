import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';

// Carpeta de respaldos: BACKUP_DIR del .env, o ~/fiix-backups del usuario del proceso
// (con PM2 suele ser el home de quien arrancó el proceso — no siempre /home/usuario).
export const BACKUP_DIR = path.resolve(
  process.env.BACKUP_DIR || path.join(os.homedir(), 'fiix-backups')
);
const RETENTION_DAYS = 14;
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
/** Carpeta data/ del proyecto (CSVs, Excel, imágenes de referencia). */
const DATA_DIR = path.join(__dirname, '../../../data');
/** backend/.env (configuración y secretos). */
const ENV_FILE = path.join(__dirname, '../../.env');
const IS_WIN = process.platform === 'win32';

const PG_CLIENT_HINT = IS_WIN
  ? 'Instala las herramientas de cliente de PostgreSQL (pg_dump/psql) y asegúrate de que estén en el PATH, o en "C:\\Program Files\\PostgreSQL\\<versión>\\bin".'
  : 'Instala el cliente de PostgreSQL (paquete postgresql-client) para disponer de pg_dump y psql.';

const PG_DUMP_HINT = PG_CLIENT_HINT;
export const SAFE_BACKUP_FILE = /^(fiix|uploads|data|env)_\d{8}_\d{4}\.(sql\.gz|tar\.gz|env)$/;
/** Gzip vacío ~20 bytes; un dump real de esquema+datos supera holgadamente este mínimo. */
const MIN_SQL_GZ_BYTES = 64;
const MIN_SQL_RAW_BYTES = 200;
/** Parámetros de URI que usa Prisma / pools y que libpq (pg_dump/psql) rechaza (p. ej. PG 18). */
const NON_LIBPQ_URL_PARAMS = [
  'schema',
  'connection_limit',
  'pool_timeout',
  'pgbouncer',
  'connect_timeout',
  'socket_timeout',
  'statement_cache_size',
];

const timestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

/**
 * Quita query params solo de Prisma/ORM para que pg_dump/psql acepten la URI.
 * Sin esto, PostgreSQL 15+ falla con: «parámetro de URI no válido: schema».
 */
export function sanitizeDatabaseUrlForPgClients(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    for (const key of NON_LIBPQ_URL_PARAMS) {
      u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return trimmed
      .replace(/([?&])schema=[^&]*/gi, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?')
      .replace(/\?$/, '');
  }
}

/** Busca un binario de cliente PostgreSQL (pg_dump / psql) en PATH y rutas típicas. */
function findPgBinary(binName: 'pg_dump' | 'psql'): string | null {
  const exeName = IS_WIN ? `${binName}.exe` : binName;
  const whichCmd = IS_WIN ? 'where' : 'which';
  const candidates: string[] = [];

  try {
    const found = execFileSync(whichCmd, [binName], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: IS_WIN,
    })
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.toLowerCase().includes('info:') && fs.existsSync(line));
    candidates.push(...found);
  } catch {
    // no está en PATH
  }

  if (IS_WIN) {
    const roots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      'C:\\Program Files',
      'C:\\Program Files (x86)',
    ].filter((r): r is string => Boolean(r));

    for (const root of roots) {
      const pgRoot = path.join(root, 'PostgreSQL');
      if (!fs.existsSync(pgRoot)) continue;
      let versions: string[] = [];
      try {
        versions = fs.readdirSync(pgRoot).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      } catch {
        continue;
      }
      for (const version of versions) {
        const candidate = path.join(pgRoot, version, 'bin', exeName);
        if (fs.existsSync(candidate)) candidates.push(candidate);
      }
    }
  } else {
    // Ubuntu/Debian: preferir /usr/lib/postgresql/<mayor>/bin/pg_dump (la más alta).
    // El pg_dump del PATH suele ser el metapaquete (p. ej. 16) aunque exista el cliente 17.
    const pgLib = '/usr/lib/postgresql';
    if (fs.existsSync(pgLib)) {
      try {
        const versions = fs
          .readdirSync(pgLib)
          .filter((v) => /^\d+(\.\d+)?$/.test(v))
          .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
        for (const version of versions) {
          const candidate = path.join(pgLib, version, 'bin', binName);
          if (fs.existsSync(candidate)) candidates.push(candidate);
        }
      } catch {
        // ignore
      }
    }
  }

  const unique = [...new Set(candidates)];
  if (unique.length === 0) return null;
  if (unique.length === 1) return unique[0];

  // Elegir la versión mayor reportada por --version (pg_dump debe ser >= servidor).
  let best: string | null = null;
  let bestMajor = -1;
  for (const candidate of unique) {
    try {
      const out = execFileSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const m = out.match(/(\d+)\.\d+/);
      const major = m ? Number(m[1]) : -1;
      if (major > bestMajor) {
        bestMajor = major;
        best = candidate;
      }
    } catch {
      if (!best) best = candidate;
    }
  }
  return best;
}

function findPgDump(): string | null {
  return findPgBinary('pg_dump');
}

function findPsql(): string | null {
  return findPgBinary('psql');
}

/**
 * Espera el cierre del hijo sin rechazar la promesa (evita unhandledRejection en Windows
 * cuando pg_dump/psql fallan mientras aún corre el pipeline de streams).
 */
function waitForChildExit(
  child: ReturnType<typeof spawn>
): Promise<{ code: number | null; spawnError: NodeJS.ErrnoException | null }> {
  return new Promise((resolve) => {
    let spawnError: NodeJS.ErrnoException | null = null;
    child.on('error', (err: NodeJS.ErrnoException) => {
      spawnError = err;
    });
    child.on('close', (code) => {
      resolve({ code, spawnError });
    });
  });
}

function unlinkQuiet(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

/** Mensaje claro cuando pg_dump falla, con pista si el cliente es más viejo que el servidor. */
function pgDumpFailureDetail(stderr: string, code: number | null): string {
  const detail = stderr.trim() || `pg_dump terminó con código ${code}`;
  if (/version mismatch/i.test(detail)) {
    return `${detail} — pg_dump es de una versión menor que el servidor PostgreSQL: instala un cliente pg_dump de la misma versión o más nueva (p. ej. postgresql-client-16 para PostgreSQL 16).`;
  }
  return detail;
}

/**
 * Ejecuta pg_dump completo del esquema `public` (todas las tablas Prisma, p. ej. Zone,
 * ZoneSection, Asset con has_sections / zone_section_id) y comprime con gzip vía streams
 * de Node (sin bash). No filtra por tabla: un dump nuevo siempre incluye columnas/tablas
 * añadidas por migraciones.
 */
async function dumpDatabase(pgDumpPath: string, databaseUrl: string, outFile: string): Promise<void> {
  const pgUrl = sanitizeDatabaseUrlForPgClients(databaseUrl);
  const child = spawn(
    pgDumpPath,
    ['--no-owner', '--no-acl', pgUrl],
    {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );

  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const exitPromise = waitForChildExit(child);

  try {
    if (!child.stdout) throw new Error('pg_dump no produjo salida');
    try {
      await pipeline(child.stdout, zlib.createGzip(), fs.createWriteStream(outFile));
    } catch (pipeErr: any) {
      // Si el proceso ya murió, el cierre de stdout puede provocar EPIPE; el código de salida manda.
      const { code, spawnError } = await exitPromise;
      if (spawnError?.code === 'ENOENT') {
        throw new Error(`No se pudo ejecutar pg_dump. ${PG_DUMP_HINT}`);
      }
      if (spawnError) throw spawnError;
      if (code !== 0) {
        throw new Error(pgDumpFailureDetail(stderr, code));
      }
      throw pipeErr;
    }

    const { code, spawnError } = await exitPromise;
    if (spawnError?.code === 'ENOENT') {
      throw new Error(`No se pudo ejecutar pg_dump. ${PG_DUMP_HINT}`);
    }
    if (spawnError) throw spawnError;
    if (code !== 0) {
      throw new Error(pgDumpFailureDetail(stderr, code));
    }

    const gzSize = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
    if (gzSize < MIN_SQL_GZ_BYTES) {
      throw new Error(
        `El respaldo quedó vacío (${gzSize} bytes). Revisa DATABASE_URL y que pg_dump pueda conectar (PostgreSQL 15+ no acepta ?schema= de Prisma en la URI).`
      );
    }

    let rawLen = 0;
    try {
      rawLen = zlib.gunzipSync(fs.readFileSync(outFile)).length;
    } catch {
      throw new Error('El archivo .sql.gz generado está corrupto o vacío.');
    }
    if (rawLen < MIN_SQL_RAW_BYTES) {
      throw new Error(
        `El dump SQL es demasiado pequeño (${rawLen} bytes). No se guardó un respaldo vacío.`
      );
    }
  } catch (error) {
    unlinkQuiet(outFile);
    throw error;
  }
}

/** Empaqueta un directorio con tar (nativo en Linux/macOS y en Windows 10+). */
function archivePath(dir: string, outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parent = path.dirname(dir);
    const base = path.basename(dir);
    const child = spawn('tar', ['-czf', outFile, '-C', parent, base], {
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error('No se encontró "tar". En Windows 10+ suele venir incluido; en Linux instala tar/gzip.'));
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        try {
          if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
        } catch {
          // ignore
        }
        reject(new Error(stderr.trim() || `tar terminó con código ${code}`));
      }
    });
  });
}

function archiveUploads(outFile: string): Promise<void> {
  return archivePath(UPLOADS_DIR, outFile);
}

export interface BackupResult {
  success: boolean;
  message: string;
  files: string[];
}

export interface BackupListEntry {
  file: string;
  stamp: string;
  size: number;
  mtime: string;
  hasUploads: boolean;
  uploadsFile?: string;
  /** false si el .sql.gz está vacío/corrupto (p. ej. dumps fallidos por ?schema=). */
  usable: boolean;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  restoredDb: boolean;
  restoredUploads: boolean;
}

/**
 * Lista respaldos de BD recientes (fiix_*.sql.gz) en BACKUP_DIR, más nuevos primero.
 */
export const listBackups = (): BackupListEntry[] => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    const entries = fs.readdirSync(BACKUP_DIR);
    const dbFiles = entries
      .filter((name) => /^fiix_\d{8}_\d{4}\.sql\.gz$/.test(name))
      .map((name) => {
        const fullPath = path.join(BACKUP_DIR, name);
        const stats = fs.statSync(fullPath);
        const stamp = name.replace(/^fiix_/, '').replace(/\.sql\.gz$/, '');
        const uploadsName = `uploads_${stamp}.tar.gz`;
        const hasUploads = entries.includes(uploadsName);
        const usable = stats.size >= MIN_SQL_GZ_BYTES;
        return {
          file: name,
          stamp,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
          hasUploads,
          uploadsFile: hasUploads ? uploadsName : undefined,
          usable,
        } satisfies BackupListEntry;
      })
      .sort((a, b) => b.stamp.localeCompare(a.stamp));
    return dbFiles;
  } catch (error) {
    console.error('[Backup] Error al listar respaldos:', error);
    return [];
  }
};

/** Conteos de verificación tras una restauración (prueba de que la BD responde). */
export type RestoreVerification = { users: number; workOrders: number; items: number };

/**
 * Restaura un dump gzip (plain SQL) vía psql stdin DENTRO de una sola transacción:
 * `BEGIN; DROP SCHEMA public CASCADE; CREATE SCHEMA public; <dump>; COMMIT;`.
 *
 * Si el dump falla a mitad, psql se detiene (ON_ERROR_STOP) sin llegar al COMMIT y la
 * conexión se cierra → PostgreSQL revierte TODO (incluido el DROP del esquema). Así una
 * restauración fallida NUNCA deja la base a medias (antes, el DROP quedaba aplicado y la
 * base incompleta si el dump fallaba después de recrear el esquema).
 */
/** Extrae solo el error real del stderr de psql (ignora NOTICEs de DROP CASCADE, etc.). */
function summarizePsqlError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return 'sin detalles';
  const errors = lines.filter((l) => /^ERROR:/.test(l));
  if (errors.length > 0) return errors.join(' | ');
  return lines.slice(-8).join(' | ');
}

async function restoreDatabase(
  psqlPath: string,
  databaseUrl: string,
  sqlGzFile: string
): Promise<RestoreVerification> {
  const gzSize = fs.statSync(sqlGzFile).size;
  if (gzSize < MIN_SQL_GZ_BYTES) {
    throw new Error(
      `El archivo de respaldo está vacío o es inválido (${gzSize} bytes). Genera un respaldo nuevo con «Crear respaldo» (versiones anteriores podían dejar .sql.gz vacíos si pg_dump rechazaba ?schema=).`
    );
  }

  let sqlRaw: Buffer;
  try {
    sqlRaw = zlib.gunzipSync(fs.readFileSync(sqlGzFile));
  } catch {
    throw new Error('No se pudo descomprimir el .sql.gz (archivo corrupto).');
  }
  if (sqlRaw.length < MIN_SQL_RAW_BYTES) {
    throw new Error(
      `El dump SQL está vacío (${sqlRaw.length} bytes). Este respaldo no contiene datos; no se restauró nada.`
    );
  }

  const pgUrl = sanitizeDatabaseUrlForPgClients(databaseUrl);
  // Recrear public evita «relation already exists» al restaurar un dump completo sobre tablas ya creadas.
  // Todo dentro de BEGIN…COMMIT: cualquier fallo revierte el DROP y deja la BD como estaba.
  const preamble = Buffer.from(
    [
      'BEGIN;',
      'DROP SCHEMA IF EXISTS public CASCADE;',
      'CREATE SCHEMA public;',
      'GRANT ALL ON SCHEMA public TO public;',
      'GRANT ALL ON SCHEMA public TO CURRENT_USER;',
      '',
    ].join('\n'),
    'utf8'
  );
  const commitTail = Buffer.from('\nCOMMIT;\n', 'utf8');
  const sqlPayload = Buffer.concat([preamble, sqlRaw, commitTail]);

  const child = spawn(psqlPath, ['-q', pgUrl, '-v', 'ON_ERROR_STOP=1'], {
    shell: false,
    stdio: ['pipe', 'ignore', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const exitPromise = waitForChildExit(child);

  if (!child.stdin) throw new Error('psql no aceptó entrada');

  try {
    await pipeline(Readable.from(sqlPayload), child.stdin);
  } catch (pipeErr: any) {
    const { code, spawnError } = await exitPromise;
    if (spawnError?.code === 'ENOENT') {
      throw new Error(`No se pudo ejecutar psql. ${PG_CLIENT_HINT}`);
    }
    if (spawnError) throw spawnError;
    if (code !== 0) {
      throw new Error(summarizePsqlError(stderr) || `psql terminó con código ${code}`);
    }
    throw pipeErr;
  }

  const { code, spawnError } = await exitPromise;
  if (spawnError?.code === 'ENOENT') {
    throw new Error(`No se pudo ejecutar psql. ${PG_CLIENT_HINT}`);
  }
  if (spawnError) throw spawnError;
  if (code !== 0) {
    // La transacción abierta (BEGIN) se aborta al cerrar la conexión → rollback total.
    throw new Error(summarizePsqlError(stderr) || `psql terminó con código ${code}`);
  }

  // Recuperación COMPROBADA: verificar que la base restaurada responde con sus tablas.
  return verifyRestoredDatabase(psqlPath, pgUrl);
}

/** Consulta de verificación tras restaurar: la BD debe responder con sus tablas core. */
async function verifyRestoredDatabase(
  psqlPath: string,
  pgUrl: string
): Promise<RestoreVerification> {
  const query =
    "SELECT (SELECT count(*) FROM \"User\")::text || '|' || " +
    "(SELECT count(*) FROM \"WorkOrder\")::text || '|' || " +
    '(SELECT count(*) FROM "Item")::text;';
  return new Promise((resolve, reject) => {
    const child = spawn(psqlPath, [pgUrl, '-tAc', query], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`No se pudo ejecutar psql. ${PG_CLIENT_HINT}`));
      } else {
        reject(err);
      }
    });
    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(
          new Error(
            `La base restaurada no pasó la verificación (código ${exitCode}): ${stderr.trim() || 'consulta de verificación fallida'}`
          )
        );
        return;
      }
      const parts = stdout.trim().split('|').map((v) => parseInt(v, 10));
      const [users, workOrders, items] = parts;
      if (!Number.isFinite(users) || !Number.isFinite(workOrders) || !Number.isFinite(items)) {
        reject(new Error(`La base restaurada no pasó la verificación: respuesta inesperada "${stdout.trim()}"`));
        return;
      }
      resolve({ users, workOrders, items });
    });
  });
}

/** Extrae uploads_*.tar.gz sobre backend/ (reemplaza/mezcla la carpeta uploads). */
function extractUploads(uploadsTarGz: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parent = path.dirname(UPLOADS_DIR);
    fs.mkdirSync(parent, { recursive: true });
    const child = spawn('tar', ['-xzf', uploadsTarGz, '-C', parent], {
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error('No se encontró "tar". En Windows 10+ suele venir incluido; en Linux instala tar/gzip.'));
      } else {
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `tar terminó con código ${code}`));
    });
  });
}

/**
 * Restaura un respaldo fiix_*.sql.gz (y opcionalmente uploads_*.tar.gz del mismo stamp).
 * Solo acepta nombres de archivo seguros dentro de BACKUP_DIR.
 */
export const runRestore = async (
  file: string,
  restoreUploads: boolean = true
): Promise<RestoreResult> => {
  const base = path.basename(file);
  if (!SAFE_BACKUP_FILE.test(base) || !base.startsWith('fiix_') || !base.endsWith('.sql.gz')) {
    return {
      success: false,
      message: 'Nombre de archivo inválido. Usa un respaldo fiix_YYYYMMDD_HHMM.sql.gz del directorio de respaldos.',
      restoredDb: false,
      restoredUploads: false,
    };
  }

  const sqlPath = path.join(BACKUP_DIR, base);
  if (!fs.existsSync(sqlPath)) {
    return {
      success: false,
      message: `No se encontró el archivo ${base} en ${BACKUP_DIR}.`,
      restoredDb: false,
      restoredUploads: false,
    };
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) {
    return {
      success: false,
      message: 'DATABASE_URL no está definido; no se puede restaurar la base de datos.',
      restoredDb: false,
      restoredUploads: false,
    };
  }

  const psqlPath = findPsql();
  if (!psqlPath) {
    return {
      success: false,
      message: `No se encontró psql. ${PG_CLIENT_HINT}`,
      restoredDb: false,
      restoredUploads: false,
    };
  }

  let restoredDb = false;
  let restoredUploads = false;
  let verification: RestoreVerification | null = null;
  const errors: string[] = [];

  try {
    verification = await restoreDatabase(psqlPath, databaseUrl, sqlPath);
    restoredDb = true;
  } catch (error: any) {
    return {
      success: false,
      message: `Error al restaurar la base de datos: ${error.message || error}`,
      restoredDb: false,
      restoredUploads: false,
    };
  }

  if (restoreUploads) {
    const stamp = base.replace(/^fiix_/, '').replace(/\.sql\.gz$/, '');
    const uploadsName = `uploads_${stamp}.tar.gz`;
    const uploadsPath = path.join(BACKUP_DIR, uploadsName);
    if (fs.existsSync(uploadsPath)) {
      try {
        await extractUploads(uploadsPath);
        restoredUploads = true;
      } catch (error: any) {
        errors.push(`Uploads: ${error.message || error}`);
      }
    } else {
      errors.push(`No hay archivo ${uploadsName} junto al dump; se omitió uploads.`);
    }
  }

  const parts = [`BD restaurada desde ${base}`];
  if (verification) {
    parts.push(
      `verificación OK: ${verification.users} usuarios, ${verification.workOrders} órdenes, ${verification.items} repuestos`
    );
  }
  if (restoredUploads) parts.push('uploads restaurados');
  const message = `${parts.join('; ')}.${errors.length ? ` Avisos: ${errors.join(' | ')}` : ''} Recarga la aplicación para ver los datos.`;

  return { success: restoredDb, message, restoredDb, restoredUploads };
};

export interface BackupProgress {
  phase: 'idle' | 'prepare' | 'database' | 'uploads' | 'cleanup' | 'done' | 'error';
  step: number;
  totalSteps: number;
  percent: number;
  message: string;
  running: boolean;
  updatedAt: string;
}

const TOTAL_BACKUP_STEPS = 4;

let backupProgress: BackupProgress = {
  phase: 'idle',
  step: 0,
  totalSteps: TOTAL_BACKUP_STEPS,
  percent: 0,
  message: '',
  running: false,
  updatedAt: new Date().toISOString(),
};

function setBackupProgress(
  phase: BackupProgress['phase'],
  step: number,
  percent: number,
  message: string,
  running = true
) {
  backupProgress = {
    phase,
    step,
    totalSteps: TOTAL_BACKUP_STEPS,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    message,
    running,
    updatedAt: new Date().toISOString(),
  };
  console.log(`[Backup] ${percent}% · ${message}`);
}

export const getBackupProgress = (): BackupProgress => ({ ...backupProgress });

/**
 * Respalda la base de datos (pg_dump + gzip en Node) y la carpeta backend/uploads a
 * BACKUP_DIR, y elimina respaldos con más de RETENTION_DAYS días.
 * Funciona en Windows y Linux sin depender de /bin/bash.
 * Se usa tanto desde el cron diario (2:15 AM) como desde el botón manual en
 * Opciones de Desarrollador (POST /api/dev/backup).
 */
export const runBackup = async (): Promise<BackupResult> => {
  const files: string[] = [];
  const errors: string[] = [];
  let dbFailed = false;
  let dbErrorDetail = '';
  const started = Date.now();
  setBackupProgress('prepare', 1, 5, 'Preparando carpeta de respaldos…');
  console.log(`[Backup] Inicio → carpeta ${BACKUP_DIR} (home proceso: ${os.homedir()})`);

  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (error: any) {
    setBackupProgress('error', 1, 0, `No se pudo crear la carpeta: ${error.message}`, false);
    return { success: false, message: `No se pudo crear la carpeta de respaldos (${BACKUP_DIR}): ${error.message}`, files: [] };
  }

  const stamp = timestamp();

  // --- Base de datos ---
  setBackupProgress('database', 2, 25, 'Respaldando base de datos (pg_dump)…');
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) {
    errors.push('DATABASE_URL no está definido; se omitió el respaldo de la base de datos.');
  } else {
    const pgDumpPath = findPgDump();
    if (!pgDumpPath) {
      errors.push(`Base de datos: no se encontró pg_dump. ${PG_DUMP_HINT}`);
    } else {
      const dbFile = path.join(BACKUP_DIR, `fiix_${stamp}.sql.gz`);
      try {
        console.log(`[Backup] pg_dump → ${path.basename(dbFile)} (${pgDumpPath})`);
        await dumpDatabase(pgDumpPath, databaseUrl, dbFile);
        files.push(dbFile);
        console.log(`[Backup] BD OK (${fs.statSync(dbFile).size} bytes)`);
        setBackupProgress('database', 2, 45, 'Base de datos respaldada…');
      } catch (error: any) {
        dbFailed = true;
        dbErrorDetail = error?.message || String(error);
        errors.push(`Base de datos: ${dbErrorDetail}`);
      }
    }
  }

  // --- Uploads (fotos, firmas, evidencias) — puede tardar varios minutos si hay muchas fotos ---
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadsFile = path.join(BACKUP_DIR, `uploads_${stamp}.tar.gz`);
    try {
      setBackupProgress('uploads', 3, 55, 'Empaquetando fotos (uploads/)… esto puede tardar varios minutos');
      console.log(`[Backup] tar uploads/ → ${path.basename(uploadsFile)} (puede tardar si hay muchas fotos)`);
      await archiveUploads(uploadsFile);
      files.push(uploadsFile);
      console.log(`[Backup] Uploads OK (${fs.statSync(uploadsFile).size} bytes)`);
      setBackupProgress('uploads', 3, 85, 'Fotos empaquetadas…');
    } catch (error: any) {
      errors.push(`Uploads: ${error.message || error}`);
    }
  } else {
    setBackupProgress('uploads', 3, 85, 'Sin carpeta uploads; se omite empaquetado de fotos…');
  }

  // --- data/ (CSVs, Excel, imágenes de referencia) ---
  if (fs.existsSync(DATA_DIR)) {
    const dataFile = path.join(BACKUP_DIR, `data_${stamp}.tar.gz`);
    try {
      console.log(`[Backup] tar data/ → ${path.basename(dataFile)}`);
      await archivePath(DATA_DIR, dataFile);
      files.push(dataFile);
      console.log(`[Backup] data/ OK (${fs.statSync(dataFile).size} bytes)`);
    } catch (error: any) {
      errors.push(`data/: ${error.message || error}`);
    }
  }

  // --- .env (configuración y secretos) ---
  if (fs.existsSync(ENV_FILE)) {
    const envBackup = path.join(BACKUP_DIR, `env_${stamp}.env`);
    try {
      fs.copyFileSync(ENV_FILE, envBackup);
      files.push(envBackup);
      console.log(`[Backup] .env OK → ${path.basename(envBackup)}`);
    } catch (error: any) {
      errors.push(`.env: ${error.message || error}`);
    }
  }

  setBackupProgress('cleanup', 4, 92, 'Limpiando respaldos antiguos…');
  cleanupOldBackups();

  // Un respaldo sin dump de BD no sirve para restaurar/migrar: reportar fallo claro.
  const hasDbDump = files.some((f) => /^fiix_\d{8}_\d{4}\.sql\.gz$/.test(path.basename(f)));
  const success = hasDbDump;
  const fileNames = files.map((f) => path.basename(f)).join(', ');
  const elapsedSec = Math.round((Date.now() - started) / 1000);
  let message: string;
  if (success) {
    message = `Respaldo creado en ${BACKUP_DIR}: ${fileNames} (${elapsedSec}s)${errors.length ? ` (avisos: ${errors.join(' | ')})` : ''}`;
  } else if (dbFailed) {
    message = `El respaldo de la base de datos falló: ${dbErrorDetail}. Sin dump de BD no hay un respaldo utilizable para restaurar o migrar.${files.length ? ` (solo se generaron: ${fileNames})` : ''}`;
  } else {
    message = `No se pudo crear ningún respaldo en ${BACKUP_DIR}. ${errors.join(' | ') || 'Revisa permisos y herramientas instaladas (pg_dump, tar).'}`;
  }

  console.log(`[Backup] Fin (${elapsedSec}s): ${message}`);
  setBackupProgress(success ? 'done' : 'error', 4, 100, message, false);
  return { success, message, files };
};

function cleanupOldBackups() {
  try {
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const entries = fs.readdirSync(BACKUP_DIR);
    for (const entry of entries) {
      if (!SAFE_BACKUP_FILE.test(entry)) continue;
      const fullPath = path.join(BACKUP_DIR, entry);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.mtimeMs < cutoff) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // ignore entradas problemáticas individuales
      }
    }
  } catch (error) {
    console.error('[Backup] Error al limpiar respaldos antiguos:', error);
  }
}
