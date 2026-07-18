import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';

// Carpeta de respaldos: BACKUP_DIR del .env, o ~/fiix-backups por defecto (cross-platform).
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'fiix-backups');
const RETENTION_DAYS = 14;
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const IS_WIN = process.platform === 'win32';

const PG_DUMP_HINT = IS_WIN
  ? 'Instala las herramientas de cliente de PostgreSQL (pg_dump) y asegúrate de que estén en el PATH, o en "C:\\Program Files\\PostgreSQL\\<versión>\\bin".'
  : 'Instala el cliente de PostgreSQL (paquete postgresql-client) para disponer de pg_dump.';

const timestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

/** Busca pg_dump en PATH y, en Windows, en rutas típicas de instalación. */
function findPgDump(): string | null {
  const whichCmd = IS_WIN ? 'where' : 'which';
  try {
    const found = execFileSync(whichCmd, ['pg_dump'], {
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
        const candidate = path.join(pgRoot, version, 'bin', 'pg_dump.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  return null;
}

/** Ejecuta pg_dump y comprime la salida con gzip vía streams de Node (sin bash). */
async function dumpDatabase(pgDumpPath: string, databaseUrl: string, outFile: string): Promise<void> {
  const child = spawn(pgDumpPath, [databaseUrl], {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const exitPromise = new Promise<void>((resolve, reject) => {
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`No se pudo ejecutar pg_dump. ${PG_DUMP_HINT}`));
      } else {
        reject(err);
      }
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `pg_dump terminó con código ${code}`));
    });
  });

  try {
    if (!child.stdout) throw new Error('pg_dump no produjo salida');
    await pipeline(child.stdout, zlib.createGzip(), fs.createWriteStream(outFile));
    await exitPromise;
  } catch (error) {
    try {
      if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    } catch {
      // ignore
    }
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
      if (!/^(fiix|uploads)_\d{8}_\d{4}\.(sql\.gz|tar\.gz)$/.test(entry)) continue;
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
