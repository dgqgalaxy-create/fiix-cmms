import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Carpeta de respaldos: BACKUP_DIR del .env, o ~/fiix-backups por defecto.
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.homedir(), 'fiix-backups');
const RETENTION_DAYS = 14;
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

const timestamp = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
};

const run = (command: string): Promise<{ ok: boolean; error?: string }> =>
  new Promise((resolve) => {
    exec(command, { shell: '/bin/bash' }, (error) => {
      resolve(error ? { ok: false, error: error.message } : { ok: true });
    });
  });

export interface BackupResult {
  success: boolean;
  message: string;
  files: string[];
}

/**
 * Respalda la base de datos (pg_dump | gzip) y la carpeta backend/uploads a
 * BACKUP_DIR, y elimina respaldos con más de RETENTION_DAYS días.
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
    const dbFile = path.join(BACKUP_DIR, `fiix_${stamp}.sql.gz`);
    const dbResult = await run(`pg_dump "${databaseUrl}" | gzip > "${dbFile}"`);
    if (dbResult.ok) {
      files.push(dbFile);
    } else {
      errors.push(`Base de datos: ${dbResult.error} (¿pg_dump instalado?)`);
    }
  }

  // --- Uploads (fotos, firmas, evidencias) ---
  if (fs.existsSync(UPLOADS_DIR)) {
    const uploadsFile = path.join(BACKUP_DIR, `uploads_${stamp}.tar.gz`);
    const tarResult = await run(
      `tar -czf "${uploadsFile}" -C "${path.dirname(UPLOADS_DIR)}" "${path.basename(UPLOADS_DIR)}"`
    );
    if (tarResult.ok) {
      files.push(uploadsFile);
    } else {
      errors.push(`Uploads: ${tarResult.error}`);
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
