import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';

// Carpeta de respaldos: BACKUP_DIR del .env, o ~/fiix-backups por defecto (cross-platform).
export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'fiix-backups');
const RETENTION_DAYS = 14;
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const IS_WIN = process.platform === 'win32';

const PG_CLIENT_HINT = IS_WIN
  ? 'Instala las herramientas de cliente de PostgreSQL (pg_dump/psql) y asegúrate de que estén en el PATH, o en "C:\\Program Files\\PostgreSQL\\<versión>\\bin".'
  : 'Instala el cliente de PostgreSQL (paquete postgresql-client) para disponer de pg_dump y psql.';

const PG_DUMP_HINT = PG_CLIENT_HINT;
const SAFE_BACKUP_FILE = /^(fiix|uploads)_\d{8}_\d{4}\.(sql\.gz|tar\.gz)$/;
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

/** Busca un binario de cliente PostgreSQL (pg_dump / psql) en PATH y rutas típicas de Windows. */
function findPgBinary(binName: 'pg_dump' | 'psql'): string | null {
  const exeName = IS_WIN ? `${binName}.exe` : binName;
  const whichCmd = IS_WIN ? 'where' : 'which';
  try {
    const found = execFileSync(whichCmd, [binName], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: IS_WIN,
    })
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.toLowerCase().includes('info:') && fs.existsSync(line));
    if (found) return found;
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
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
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

/** Ejecuta pg_dump y comprime la salida con gzip vía streams de Node (sin bash). */
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
        throw new Error(stderr.trim() || `pg_dump terminó con código ${code}`);
      }
      throw pipeErr;
    }

    const { code, spawnError } = await exitPromise;
    if (spawnError?.code === 'ENOENT') {
      throw new Error(`No se pudo ejecutar pg_dump. ${PG_DUMP_HINT}`);
    }
    if (spawnError) throw spawnError;
    if (code !== 0) {
      throw new Error(stderr.trim() || `pg_dump terminó con código ${code}`);
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

/** Empaqueta uploads/ con tar (nativo en Linux/macOS y en Windows 10+). */
function archiveUploads(outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const parent = path.dirname(UPLOADS_DIR);
    const base = path.basename(UPLOADS_DIR);
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

/** Restaura un dump gzip (plain SQL) vía psql stdin, tras recrear el schema public. */
async function restoreDatabase(psqlPath: string, databaseUrl: string, sqlGzFile: string): Promise<void> {
  const gzSize = fs.statSync(sqlGzFile).size;
  if (gzSize < MIN_SQL_GZ_BYTES) {
    throw new Error(
      `El archivo de respaldo está vacío o es inválido (${gzSize} bytes). Genera un respaldo nuevo con «Crear respaldo ahora» (versiones anteriores podían dejar .sql.gz vacíos si pg_dump rechazaba ?schema=).`
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
  // Recrear public evita «relation already exists» al restaurar un dump completo sobre tablas ya creadas (p. ej. tras wipe).
  const preamble = Buffer.from(
    [
      'DROP SCHEMA IF EXISTS public CASCADE;',
      'CREATE SCHEMA public;',
      'GRANT ALL ON SCHEMA public TO public;',
      'GRANT ALL ON SCHEMA public TO CURRENT_USER;',
      '',
    ].join('\n'),
    'utf8'
  );
  const sqlPayload = Buffer.concat([preamble, sqlRaw]);

  const child = spawn(psqlPath, [pgUrl, '-v', 'ON_ERROR_STOP=1'], {
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
      throw new Error(stderr.trim() || `psql terminó con código ${code}`);
    }
    throw pipeErr;
  }

  const { code, spawnError } = await exitPromise;
  if (spawnError?.code === 'ENOENT') {
    throw new Error(`No se pudo ejecutar psql. ${PG_CLIENT_HINT}`);
  }
  if (spawnError) throw spawnError;
  if (code !== 0) {
    throw new Error(stderr.trim() || `psql terminó con código ${code}`);
  }
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
  const errors: string[] = [];

  try {
    await restoreDatabase(psqlPath, databaseUrl, sqlPath);
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
  if (restoredUploads) parts.push('uploads restaurados');
  const message = `${parts.join('; ')}.${errors.length ? ` Avisos: ${errors.join(' | ')}` : ''} Recarga la aplicación para ver los datos.`;

  return { success: restoredDb, message, restoredDb, restoredUploads };
};

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

  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (error: any) {
    return { success: false, message: `No se pudo crear la carpeta de respaldos: ${error.message}`, files: [] };
  }

  const stamp = timestamp();

  // --- Base de datos ---
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
        await dumpDatabase(pgDumpPath, databaseUrl, dbFile);
        files.push(dbFile);
      } catch (error: any) {
        errors.push(`Base de datos: ${error.message || error} (¿pg_dump instalado y DATABASE_URL correcto?)`);
      }
    }
  }

  // --- Uploads (fotos, firmas, evidencias) ---
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadsFile = path.join(BACKUP_DIR, `uploads_${stamp}.tar.gz`);
    try {
      await archiveUploads(uploadsFile);
      files.push(uploadsFile);
    } catch (error: any) {
      errors.push(`Uploads: ${error.message || error}`);
    }
  }

  cleanupOldBackups();

  const success = files.length > 0;
  const fileNames = files.map((f) => path.basename(f)).join(', ');
  const message = success
    ? `Respaldo creado en ${BACKUP_DIR}: ${fileNames}${errors.length ? ` (avisos: ${errors.join(' | ')})` : ''}`
    : `No se pudo crear ningún respaldo. ${errors.join(' | ') || 'Revisa permisos y herramientas instaladas (pg_dump, tar).'}`;

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
