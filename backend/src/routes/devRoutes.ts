import express, { Request, Response } from 'express';
import prisma from '../config/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { runBackup, listBackups, runRestore, BACKUP_DIR, getBackupProgress, SAFE_BACKUP_FILE } from '../utils/backupService';
import {
  previewOrphanUploads,
  cleanupOrphanUploads,
  emptyUploadsDirectory,
} from '../utils/uploadsCleanup';
import { authenticate, type AuthRequest } from '../middlewares/authMiddleware';
import { processCsvImportFiles, CsvImportError } from '../utils/runCsvImport';
import { importInventoryTransactionsFile } from '../utils/inventoryCsvImport';
import { buildAnnualFileData } from '../utils/annualFile';
import { buildDataQualityReport, fixStockToLedger, fixItemPrice } from '../utils/dataQuality';
import { logImportAudit } from '../utils/importAuditLog';
import {
  fetchAllImportTabs,
  recordsToCsv,
  GoogleSheetsError,
} from '../utils/googleSheetsClient';
import {
  getDriveApiKey,
  getDriveItemsFolderId,
  getDriveWoFolderId,
  getDriveVendorsFolderId,
  setDriveDbSettings,
} from '../utils/googleDriveImport';
import { getImportProgress, setImportProgress, resetImportProgress } from '../utils/importProgress';
import { enterMaintenance, exitMaintenance } from '../utils/maintenance';
import {
  DEV_PASSWORD_CODES,
  DEV_PASSWORD_MAX_ATTEMPTS,
  clearDevPasswordFailures,
  getDevPasswordGateStatus,
  recordDevPasswordFailure,
} from '../utils/devPasswordGate';

const router = express.Router();

// Sesión JWT obligatoria: la contraseña maestra NO usa 401 (el interceptor del front cerraría sesión).
router.use(authenticate);

/** Límite del zip de fotos (~171 MB típico; deja margen). CSV son pequeños. */
export const IMPORT_MAX_FILE_BYTES = 500 * 1024 * 1024;

/** Límite para restauración desde archivo: los tar de fotos reales pueden pasar de 1 GB. */
export const RESTORE_MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024;

const importTmpDir = path.join(os.tmpdir(), 'fiix-csv-import');

const importStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      fs.mkdirSync(importTmpDir, { recursive: true });
      cb(null, importTmpDir);
    } catch (err) {
      cb(err as Error, importTmpDir);
    }
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safe}`);
  },
});

const uploadImport = multer({
  storage: importStorage,
  limits: { fileSize: IMPORT_MAX_FILE_BYTES, files: 25 },
});

function uploadImportFields(req: Request, res: Response, next: express.NextFunction): void {
  // .any() evita "Unexpected field" si el cliente envía zips nuevos (p. ej. workOrderImagesZip)
  // y el proceso aún no listaba ese nombre en .fields().
  uploadImport.any()(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          message: `El archivo es demasiado grande (máximo ${Math.round(IMPORT_MAX_FILE_BYTES / (1024 * 1024))} MB para el zip de fotos).`,
        });
        return;
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        res.status(400).json({
          message:
            'El servidor rechazó un archivo inesperado. Actualiza a v1.30.5+ (git pull / update.sh) e inténtalo de nuevo.',
        });
        return;
      }
      res.status(400).json({ message: `Error al subir archivos: ${err.message}` });
      return;
    }
    if (err) {
      const message = err instanceof Error ? err.message : 'Error al subir archivos.';
      res.status(400).json({ message });
      return;
    }

    const list = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    const byField: { [fieldname: string]: Express.Multer.File[] } = {};
    for (const file of list) {
      if (!byField[file.fieldname]) byField[file.fieldname] = [];
      byField[file.fieldname].push(file);
    }
    req.files = byField;
    next();
  });
}

// Subida de respaldos para restaurar (fiix_*.sql.gz + uploads_*.tar.gz):
// límite propio de 10 GB porque los tar de fotos de producción superan 500 MB.
const restoreUpload = multer({
  storage: importStorage,
  limits: { fileSize: RESTORE_MAX_FILE_BYTES, files: 2 },
});

function uploadRestoreFields(req: Request, res: Response, next: express.NextFunction): void {
  restoreUpload.any()(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          success: false,
          message: `El archivo es demasiado grande (máximo ${Math.round(RESTORE_MAX_FILE_BYTES / (1024 * 1024 * 1024))} GB por archivo para restaurar). Si tu tar de fotos pesa más, restaura la base de datos por aquí y copia el tar a mano en la carpeta de respaldos del servidor.`,
        });
        return;
      }
      res.status(400).json({ success: false, message: `Error al subir archivos: ${err.message}` });
      return;
    }
    if (err) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'Error al subir archivos.',
      });
      return;
    }
    const list = (Array.isArray(req.files) ? req.files : []) as Express.Multer.File[];
    const byField: { [fieldname: string]: Express.Multer.File[] } = {};
    for (const file of list) {
      if (!byField[file.fieldname]) byField[file.fieldname] = [];
      byField[file.fieldname].push(file);
    }
    req.files = byField;
    next();
  });
}


function unlinkUploadedSafe(file?: Express.Multer.File): void {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch {
    /* ignore */
  }
}

/** Formatea tiempo restante de bloqueo para mensajes al usuario. */
function formatLockWait(lockedUntilIso: string): string {
  const ms = Math.max(0, Date.parse(lockedUntilIso) - Date.now());
  const mins = Math.ceil(ms / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return mins <= 1 ? '1 minuto' : `${mins} minutos`;
}

// Middleware to verify the developer password (403 = wrong/locked; never 401 for bad password)
const verifyDevPassword = async (req: Request, res: Response, next: express.NextFunction): Promise<void> => {
  const authReq = req as AuthRequest;
  const userId = authReq.user?.userId;
  const password = req.headers['x-dev-password'] as string;

  if (!userId) {
    // authenticate ya debería haber respondido; defensa en profundidad
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  if (!password) {
    res.status(403).json({
      code: DEV_PASSWORD_CODES.REQUIRED,
      message: 'Se requiere contraseña maestra.',
    });
    return;
  }

  try {
    const gate = await getDevPasswordGateStatus(userId);
    if (gate.locked) {
      res.status(403).json({
        code: DEV_PASSWORD_CODES.LOCKED,
        message: `Demasiados intentos fallidos. Espera ${formatLockWait(gate.lockedUntil)} e inténtalo de nuevo.`,
        lockedUntil: gate.lockedUntil,
        remainingAttempts: 0,
      });
      return;
    }

    let isValid = false;

    // 1) Contraseña maestra personalizada guardada en BD (cambiable desde la app)
    const settings = await prisma.systemSettings.findFirst();
    if (settings?.dev_menu_password_hash) {
      const matchesCustomHash = await bcrypt.compare(password, settings.dev_menu_password_hash);
      if (matchesCustomHash) {
        isValid = true;
      }
    }

    // 2) Fallback a variable de entorno (o clave de emergencia) para prevenir bloqueo si la BD se vacía
    if (!isValid) {
      const envPassword = process.env.DEV_MENU_PASSWORD || 'DavidG.Q.1991';
      if (password === envPassword) {
        isValid = true;
      }
    }

    // 3) Contraseña de cualquier administrador activo
    if (!isValid) {
      const admins = await prisma.user.findMany({
        where: { role: 'ADMINISTRADOR', is_active: true },
      });
      for (const admin of admins) {
        if (!admin.password_hash) continue;
        const match = await bcrypt.compare(password, admin.password_hash);
        if (match) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      // Solo el desbloqueo (POST /verify) consume intentos; otras rutas no bloquean por sesión caducada.
      const trackFailures = req.method === 'POST' && (req.path === '/verify' || req.path.endsWith('/verify'));

      if (trackFailures) {
        const result = await recordDevPasswordFailure(userId);
        if (result.locked && result.lockedUntil) {
          res.status(403).json({
            code: DEV_PASSWORD_CODES.LOCKED,
            message: `Contraseña incorrecta. Tras ${DEV_PASSWORD_MAX_ATTEMPTS} intentos fallidos, el acceso queda bloqueado 1 hora. Espera ${formatLockWait(result.lockedUntil)}.`,
            lockedUntil: result.lockedUntil,
            remainingAttempts: 0,
          });
          return;
        }
        res.status(403).json({
          code: DEV_PASSWORD_CODES.INVALID,
          message: `Contraseña incorrecta. Te quedan ${result.remainingAttempts} intento${result.remainingAttempts === 1 ? '' : 's'}.`,
          remainingAttempts: result.remainingAttempts,
          lockedUntil: null,
        });
        return;
      }

      res.status(403).json({
        code: DEV_PASSWORD_CODES.INVALID,
        message: 'Contraseña maestra incorrecta.',
      });
      return;
    }

    await clearDevPasswordFailures(userId);
    next();
  } catch (error) {
    console.error(`[DEV VERIFY] Error:`, error);
    res.status(500).json({ message: 'Error verificando credenciales.' });
  }
};

router.post('/verify', verifyDevPassword, (req: Request, res: Response) => {
  res.json({ success: true, message: 'Password is valid.' });
});

router.get('/settings', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          email_enabled: false,
        },
      });
    }
    res.json({
      telegram_bot_token: settings.telegram_bot_token || '',
      telegram_chat_id: settings.telegram_chat_id || '',
      google_drive_api_key: settings.google_drive_api_key || '',
      google_drive_items_folder: settings.google_drive_items_folder || '',
      google_drive_vendors_folder: settings.google_drive_vendors_folder || '',
      google_drive_wo_folder: settings.google_drive_wo_folder || ''
    });
  } catch (error) {
    console.error('Error fetching dev settings:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

router.post('/settings', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      telegram_bot_token,
      telegram_chat_id,
      google_drive_api_key,
      google_drive_items_folder,
      google_drive_vendors_folder,
      google_drive_wo_folder,
    } = req.body;
    let settings = await prisma.systemSettings.findFirst();

    const data = {
      telegram_bot_token: typeof telegram_bot_token === 'string' ? telegram_bot_token.trim() : undefined,
      telegram_chat_id: typeof telegram_chat_id === 'string' ? telegram_chat_id.trim() : undefined,
      google_drive_api_key: typeof google_drive_api_key === 'string' ? google_drive_api_key.trim() : undefined,
      google_drive_items_folder: typeof google_drive_items_folder === 'string' ? google_drive_items_folder.trim() : undefined,
      google_drive_vendors_folder: typeof google_drive_vendors_folder === 'string' ? google_drive_vendors_folder.trim() : undefined,
      google_drive_wo_folder: typeof google_drive_wo_folder === 'string' ? google_drive_wo_folder.trim() : undefined,
    };

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          telegram_bot_token: data.telegram_bot_token,
          telegram_chat_id: data.telegram_chat_id,
          google_drive_api_key: data.google_drive_api_key,
          google_drive_items_folder: data.google_drive_items_folder,
          google_drive_vendors_folder: data.google_drive_vendors_folder,
          google_drive_wo_folder: data.google_drive_wo_folder,
        },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data,
      });
    }

    // Refrescar el caché en memoria que usan las importaciones (sin reiniciar).
    setDriveDbSettings({
      apiKey: settings.google_drive_api_key ?? null,
      itemsFolder: settings.google_drive_items_folder ?? null,
      vendorsFolder: settings.google_drive_vendors_folder ?? null,
      woFolder: settings.google_drive_wo_folder ?? null,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating dev settings:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// Cambia la contraseña maestra de Opciones de Desarrollador. Protegida por la
// contraseña ACTUAL (header x-dev-password, validada por verifyDevPassword);
// el body solo confirma cuál es esa contraseña actual para el registro/UX.
router.post('/change-password', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body as { currentPassword?: string; newPassword?: string };

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          email_enabled: false,
          dev_menu_password_hash: newHash,
        },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { dev_menu_password_hash: newHash },
      });
    }

    // Best-effort: refleja también en backend/.env para servidores que aún lean DEV_MENU_PASSWORD.
    // La BD (hash) es la fuente de verdad; si esto falla no se interrumpe la operación.
    try {
      const envPath = path.join(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf-8');
        const escaped = newPassword.replace(/"/g, '\\"');
        if (/^DEV_MENU_PASSWORD=.*$/m.test(content)) {
          content = content.replace(/^DEV_MENU_PASSWORD=.*$/m, `DEV_MENU_PASSWORD="${escaped}"`);
        } else {
          content += `${content.endsWith('\n') ? '' : '\n'}DEV_MENU_PASSWORD="${escaped}"\n`;
        }
        fs.writeFileSync(envPath, content, 'utf-8');
      }
    } catch (envError) {
      console.warn('[DEV] No se pudo actualizar backend/.env con la nueva contraseña (no crítico):', envError);
    }

    res.json({ success: true, message: 'Contraseña maestra actualizada con éxito.' });
  } catch (error: any) {
    console.error('Error changing dev password:', error);
    res.status(500).json({ message: 'Error al cambiar la contraseña.', error: error.message });
  }
});

// Respaldo manual (BD + uploads) disparado desde Opciones de Desarrollador.
router.post('/backup', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await runBackup();
    res.json({ ...result, backupDir: BACKUP_DIR, progress: getBackupProgress() });
  } catch (error: any) {
    console.error('Error running manual backup:', error);
    res.status(500).json({ success: false, message: 'Error al generar el respaldo.', error: error.message });
  }
});

// Progreso del respaldo en curso (para barra en Opciones de Desarrollador).
router.get('/backup/progress', verifyDevPassword, (_req: Request, res: Response): void => {
  res.json(getBackupProgress());
});

// Lista respaldos recientes en BACKUP_DIR (fiix_*.sql.gz).
router.get('/backups', verifyDevPassword, async (_req: Request, res: Response): Promise<void> => {
  try {
    const backups = listBackups();
    // Siempre devolver la ruta real (puede no ser ~/usuario si PM2 usa otro home).
    res.json({ backups, backupDir: BACKUP_DIR });
  } catch (error: any) {
    console.error('Error listing backups:', error);
    res.status(500).json({ message: 'Error al listar respaldos.', error: error.message });
  }
});

// Restaura un fiix_*.sql.gz (+ uploads opcional). Destructivo: requiere confirmación en el cliente.
router.post('/restore', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, restoreUploads = true, confirm } = req.body || {};
    if (!file || typeof file !== 'string') {
      res.status(400).json({ success: false, message: 'Indica el archivo a restaurar (file: fiix_….sql.gz).' });
      return;
    }
    if (confirm !== 'RESTAURAR' && confirm !== true) {
      res.status(400).json({
        success: false,
        message: 'Confirmación requerida. Envía confirm: "RESTAURAR" (esto borra los datos actuales).',
      });
      return;
    }
    const result = await runRestore(file, Boolean(restoreUploads));
    if (!result.success) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ success: false, message: 'Error al restaurar el respaldo.', error: error.message });
  }
});

// Descarga un archivo de respaldo (fiix_*.sql.gz o uploads_*.tar.gz) desde BACKUP_DIR.
// Vía contraseña maestra en header (para clientes HTTP que puedan enviar x-dev-password).
router.get('/backups/download/:file', verifyDevPassword, (req: Request, res: Response): void => {
  const base = path.basename(String(req.params.file || ''));
  if (!SAFE_BACKUP_FILE.test(base)) {
    res.status(400).json({ message: 'Nombre de archivo inválido.' });
    return;
  }
  const filePath = path.join(BACKUP_DIR, base);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: 'No se encontró el archivo en la carpeta de respaldos.' });
    return;
  }
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${base}"`);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error enviando respaldo para descarga:', err);
    }
  });
});

// Tokens de descarga de un solo uso (para descargas nativas del navegador,
// que no pueden enviar el header x-dev-password). Vida corta y ligados a un archivo.
const downloadTokens = new Map<string, { file: string; expires: number }>();
const DOWNLOAD_TOKEN_TTL_MS = 5 * 60 * 1000;

/** Emite un token de descarga de un solo uso para un archivo de respaldo. */
router.post('/backups/download-token', verifyDevPassword, (req: Request, res: Response): void => {
  const base = path.basename(String(req.body?.file || ''));
  if (!SAFE_BACKUP_FILE.test(base)) {
    res.status(400).json({ message: 'Nombre de archivo inválido.' });
    return;
  }
  const filePath = path.join(BACKUP_DIR, base);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: 'No se encontró el archivo en la carpeta de respaldos.' });
    return;
  }
  const token = randomUUID();
  downloadTokens.set(token, { file: base, expires: Date.now() + DOWNLOAD_TOKEN_TTL_MS });
  // Limpieza oportunista de tokens vencidos.
  for (const [k, v] of downloadTokens) {
    if (Date.now() > v.expires) downloadTokens.delete(k);
  }
  res.json({ token, expiresInSec: Math.round(DOWNLOAD_TOKEN_TTL_MS / 1000) });
});

/**
 * Descarga nativa (stream) con token de un solo uso + sesión JWT por query.
 * El navegador gestiona el progreso y escribe a disco (archivos de GB sin abortar).
 */
router.get('/backups/download-native/:file', async (req: Request, res: Response): Promise<void> => {
  const base = path.basename(String(req.params.file || ''));
  const token = String(req.query.token || '');
  if (!SAFE_BACKUP_FILE.test(base)) {
    res.status(400).json({ message: 'Nombre de archivo inválido.' });
    return;
  }
  const entry = downloadTokens.get(token);
  if (!entry || entry.file !== base || Date.now() > entry.expires) {
    res.status(403).json({ message: 'Token de descarga inválido o vencido. Vuelve a solicitarlo.' });
    return;
  }
  downloadTokens.delete(token); // un solo uso
  const filePath = path.join(BACKUP_DIR, base);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ message: 'No se encontró el archivo en la carpeta de respaldos.' });
    return;
  }
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="${base}"`);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error enviando respaldo (descarga nativa):', err);
    }
  });
});

// Restaura desde un archivo subido (fiix_*.sql.gz + opcional uploads_*.tar.gz).
// Destructivo: requiere confirmación explícita. Para migrar entre entornos.
router.post(
  '/restore-upload',
  verifyDevPassword,
  uploadRestoreFields,
  async (req: Request, res: Response): Promise<void> => {
    const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const sqlFile = filesMap?.backupFile?.[0];
    const uploadsFile = filesMap?.uploadsFile?.[0];
    const cleanupTemps = () => {
      unlinkUploadedSafe(sqlFile);
      unlinkUploadedSafe(uploadsFile);
    };
    try {
      const confirm = String((req.body as any)?.confirm || '');
      if (confirm !== 'RESTAURAR') {
        res.status(400).json({
          success: false,
          message: 'Confirmación requerida. Envía confirm: "RESTAURAR" (esto borra los datos actuales).',
        });
        return;
      }
      if (!sqlFile) {
        res.status(400).json({
          success: false,
          message: 'Selecciona el archivo de respaldo fiix_….sql.gz para restaurar.',
        });
        return;
      }

      let base = path.basename(sqlFile.originalname || '');
      base = base.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/^fiix_\d{8}_\d{4}\.sql\.gz$/.test(base)) {
        res.status(400).json({
          success: false,
          message: 'El respaldo debe llamarse fiix_AAAAMMDD_HHMM.sql.gz (como lo genera la app).',
        });
        return;
      }

      const stamp = base.replace(/^fiix_/, '').replace(/\.sql\.gz$/, '');
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.copyFileSync(sqlFile.path, path.join(BACKUP_DIR, base));
      let uploadsStaged = false;
      if (uploadsFile) {
        const uploadsBase = `uploads_${stamp}.tar.gz`;
        fs.copyFileSync(uploadsFile.path, path.join(BACKUP_DIR, uploadsBase));
        uploadsStaged = true;
      }

      const result = await runRestore(base, uploadsStaged);
      if (!result.success) {
        res.status(500).json(result);
        return;
      }
      res.json(result);
    } catch (error: any) {
      console.error('Error restoring uploaded backup:', error);
      res.status(500).json({
        success: false,
        message: 'Error al restaurar el respaldo subido.',
        error: error.message,
      });
    } finally {
      cleanupTemps();
    }
  }
);

router.post('/delete', verifyDevPassword, async (req: Request, res: Response) => {
  try {
    // Por defecto true (UI envía deleteUploads: true). false solo si se pide explícitamente.
    const deleteUploads = req.body?.deleteUploads !== false;

    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    
    // Explicitly delete checklist records just in case
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklist" CASCADE;`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklistRow" CASCADE;`);

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations' && tablename !== 'ChecklistActivity') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      }
    }

    // Inyectar usuario administrador por defecto para evitar perder acceso
    // Credenciales alineadas con seed y hint de Login.tsx
    const defaultPassword = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@fiix.com',
        password_hash: defaultPassword,
        role: 'ADMINISTRADOR',
        is_active: true,
        must_change_password: true,
      }
    });

    let uploadsResult: { deletedCount: number; freedBytes: number; errors?: string[] } | undefined;
    if (deleteUploads) {
      uploadsResult = await emptyUploadsDirectory();
    }

    res.json({
      success: true,
      message: deleteUploads
        ? 'Base de datos vaciada y carpeta uploads limpiada.'
        : 'Database data has been deleted completely.',
      deleteUploads,
      uploads: uploadsResult,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete database data.', error: error.message });
  }
});

// Vista previa de fotos/archivos en uploads/ no referenciados por la BD.
router.post('/orphan-uploads/preview', verifyDevPassword, async (_req: Request, res: Response): Promise<void> => {
  try {
    const preview = await previewOrphanUploads(prisma);
    res.json(preview);
  } catch (error: any) {
    console.error('Error previewing orphan uploads:', error);
    res.status(500).json({ message: 'Error al escanear fotos huérfanas.', error: error.message });
  }
});

// Elimina archivos en uploads/ que no están referenciados en la BD. Requiere confirm: "LIMPIAR".
router.post('/orphan-uploads/cleanup', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const { confirm } = req.body || {};
    if (confirm !== 'LIMPIAR') {
      res.status(400).json({
        message: 'Confirmación requerida. Envía confirm: "LIMPIAR".',
      });
      return;
    }
    const result = await cleanupOrphanUploads(prisma);
    res.json(result);
  } catch (error: any) {
    console.error('Error cleaning orphan uploads:', error);
    res.status(500).json({ message: 'Error al limpiar fotos huérfanas.', error: error.message });
  }
});

router.post(
  '/import-csv',
  verifyDevPassword,
  uploadImportFields,
  async (req: Request, res: Response): Promise<void> => {
  const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const csvFieldFiles = filesMap?.csvFiles || [];
  // Zips pueden venir en csvFiles (compat) o en campos dedicados.
  const files = csvFieldFiles.filter((f) => !/\.zip$/i.test(f.originalname || ''));
  const zipFile = filesMap?.itemImagesZip?.[0];
  const vendorZipFile =
    filesMap?.vendorImagesZip?.[0] ||
    csvFieldFiles.find((f) => {
      const n = f.originalname || '';
      return /\.zip$/i.test(n) && /vendors?_?images/i.test(n);
    });
  const woZipFile =
    filesMap?.workOrderImagesZip?.[0] ||
    csvFieldFiles.find((f) => {
      const n = f.originalname || '';
      if (!/\.zip$/i.test(n)) return false;
      if (/items?_?images/i.test(n)) return false;
      if (/vendors?_?images/i.test(n)) return false;
      return true;
    });
  const uploadedTemps = [
    ...csvFieldFiles,
    ...(zipFile ? [zipFile] : []),
    ...(filesMap?.vendorImagesZip || []),
    ...(filesMap?.workOrderImagesZip || []),
  ];

  enterMaintenance('Importación de datos en curso. Modo solo lectura.');

  try {
    const useGoogleDrive =
      String((req.body as any)?.useGoogleDrive || '').toLowerCase() === 'true' ||
      String((req.body as any)?.useGoogleDrive || '') === '1';
    const skipAssets =
      String((req.body as any)?.skipAssets || '').toLowerCase() === 'true' ||
      String((req.body as any)?.skipAssets || '') === '1';
    const authReq = req as AuthRequest;
    const results = await processCsvImportFiles(files, {
      zipFile,
      vendorZipFile,
      woZipFile,
      useGoogleDrive,
      skipAssets,
    });
    await logImportAudit({
      source: 'csv',
      userId: authReq.user?.userId,
      results,
      useGoogleDrive,
      scopeHint: woZipFile || files.some((f) => /Solicitudes/i.test(f.originalname || ''))
        ? 'orders_or_mixed'
        : 'inventory',
    });
    res.json({ success: true, message: 'Archivos CSV importados con éxito.', results });
  } catch (error: any) {
    const authReq = req as AuthRequest;
    await logImportAudit({
      source: 'csv',
      userId: authReq.user?.userId,
      errorMessage: error?.message || String(error),
      useGoogleDrive:
        String((req.body as any)?.useGoogleDrive || '').toLowerCase() === 'true' ||
        String((req.body as any)?.useGoogleDrive || '') === '1',
    });
    if (error instanceof CsvImportError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    console.error('CSV Import error:', error);
    res.status(500).json({ message: 'Error procesando archivos CSV.', error: error.message });
  } finally {
    exitMaintenance();
    for (const f of uploadedTemps) {
      unlinkUploadedSafe(f);
    }
  }
});

/** Vista previa SIN aplicar: qué haría el import del CSV de movimientos (crea/omite/ignora). */
router.post(
  '/import-csv-preview',
  verifyDevPassword,
  uploadImportFields,
  async (req: Request, res: Response): Promise<void> => {
    const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const csvFiles = (filesMap?.csvFiles || []).filter((f) => !/\.zip$/i.test(f.originalname || ''));
    const uploadedTemps = csvFiles.slice();

    try {
      const invFile = csvFiles.find((f) => (f.originalname || '').includes('Inventory'));
      if (!invFile) {
        res.status(400).json({
          message:
            'Para la vista previa selecciona el CSV de movimientos (Items - Inventory.csv). No se aplicó nada.',
        });
        return;
      }
      const details = await importInventoryTransactionsFile(invFile, { dryRun: true });
      res.json({
        success: true,
        dryRun: true,
        filename: invFile.originalname,
        inventory: details,
        note:
          'Vista previa de MOVIMIENTOS únicamente (no se aplicó nada). Los demás CSV usan upsert y no borran historial.',
      });
    } catch (error: any) {
      console.error('CSV import preview error:', error);
      res.status(400).json({ message: error?.message || 'No se pudo calcular la vista previa.' });
    } finally {
      for (const f of uploadedTemps) {
        unlinkUploadedSafe(f);
      }
    }
  }
);

/** Expediente anual (solo lectura): órdenes + consumos + fotos del año en hora de planta. */
router.get('/annual-file', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawYear = Number(req.query.year);
    const year = Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : new Date().getFullYear();
    const data = await buildAnnualFileData(year);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error generando expediente anual:', error);
    res.status(500).json({ message: error?.message || 'No se pudo generar el expediente anual.' });
  }
});

/** Corrección del centro de calidad: alinear stock con el saldo de movimientos (auditado). */
router.post('/data-quality/fix-stock', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = String((req.body as any)?.item_id || '');
    const reason = (req.body as any)?.reason ?? null;
    if (!itemId) {
      res.status(400).json({ message: 'Falta item_id' });
      return;
    }
    const actor = (req as AuthRequest).user;
    const result = await fixStockToLedger(itemId, {
      reason,
      actorId: actor?.userId ?? null,
    });
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Error corrigiendo stock:', error);
    res.status(error?.message === 'ITEM_NOT_FOUND' ? 404 : 400).json({
      message: error?.message || 'No se pudo corregir el stock.',
    });
  }
});

/** Corrección del centro de calidad: asignar precio a un repuesto (auditado). */
router.post('/data-quality/fix-price', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = String((req.body as any)?.item_id || '');
    const price = Number((req.body as any)?.purchase_cost);
    const reason = (req.body as any)?.reason ?? null;
    if (!itemId) {
      res.status(400).json({ message: 'Falta item_id' });
      return;
    }
    const actor = (req as AuthRequest).user;
    const result = await fixItemPrice(itemId, price, {
      reason,
      actorId: actor?.userId ?? null,
    });
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Error corrigiendo precio:', error);
    res.status(error?.message === 'ITEM_NOT_FOUND' ? 404 : 400).json({
      message: error?.message || 'No se pudo corregir el precio.',
    });
  }
});

/** Centro de calidad de datos (solo lectura): inventario, precios, fotos y tiempos. */
router.get('/data-quality', verifyDevPassword, async (_req: Request, res: Response): Promise<void> => {
  try {
    const report = await buildDataQualityReport();
    res.json({ success: true, report });
  } catch (error: any) {
    console.error('Error generando reporte de calidad:', error);
    res.status(500).json({ message: error?.message || 'No se pudo generar el reporte de calidad.' });
  }
});

/** Importa las 7 pestañas mapeadas desde Google Sheets (mismo motor que CSV). */
router.post('/import-sheets', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  const tempPaths: string[] = [];
  resetImportProgress();
  setImportProgress('sheets', 5, 'Leyendo pestañas de Google Sheets…');
  enterMaintenance('Importación de datos en curso. Modo solo lectura.');
  try {
    fs.mkdirSync(importTmpDir, { recursive: true });
    const tabs = await fetchAllImportTabs();
    const nonEmpty = tabs.filter((t) => t.records.length > 0);
    if (nonEmpty.length === 0) {
      setImportProgress('error', 0, 'Hojas vacías o sin filas', { active: false });
      res.status(400).json({
        message:
          'Las pestañas de Google Sheets están vacías o no se pudieron leer filas de datos.',
      });
      return;
    }
    setImportProgress('sheets', 15, `Sheets leídos (${nonEmpty.length} pestañas). Preparando import…`);
    const files = nonEmpty.map((tab) => {
      const csv = recordsToCsv(tab.records);
      const originalname = `Items - ${tab.filenameToken}.csv`;
      const tempPath = path.join(
        importTmpDir,
        `sheets-${Date.now()}-${Math.round(Math.random() * 1e9)}-${tab.filenameToken.replace(/\s+/g, '_')}.csv`
      );
      fs.writeFileSync(tempPath, csv, 'utf8');
      tempPaths.push(tempPath);
      return { originalname, path: tempPath };
    });

    const useGoogleDrive =
      String((req.body as any)?.useGoogleDrive || '').toLowerCase() === 'true' ||
      String((req.body as any)?.useGoogleDrive || '') === '1' ||
      // Por defecto: sí usar Drive en sync Sheets si hay key/carpetas (sin zip).
      ((req.body as any)?.useGoogleDrive === undefined && Boolean(getDriveApiKey()));

    const skipAssets =
      String((req.body as any)?.skipAssets || '').toLowerCase() === 'true' ||
      String((req.body as any)?.skipAssets || '') === '1';

    const authReq = req as AuthRequest;
    const results = await processCsvImportFiles(files, {
      includeLocalPhotoFolders: true,
      useGoogleDrive,
      skipAssets,
    });

    const sheetsMeta = tabs.map((t) => ({
      sheetTitle: t.sheetTitle,
      rows: t.records.length,
    }));
    await logImportAudit({
      source: 'sheets',
      userId: authReq.user?.userId,
      results,
      useGoogleDrive,
      sheets: sheetsMeta,
    });

    res.json({
      success: true,
      message: 'Datos importados desde Google Sheets con éxito.',
      results,
      sheets: sheetsMeta,
      progress: getImportProgress(),
    });
  } catch (error: any) {
    setImportProgress('error', 0, error?.message || 'Error en importación', { active: false });
    const authReq = req as AuthRequest;
    await logImportAudit({
      source: 'sheets',
      userId: authReq.user?.userId,
      errorMessage: error?.message || String(error),
      useGoogleDrive:
        String((req.body as any)?.useGoogleDrive || '').toLowerCase() === 'true' ||
        String((req.body as any)?.useGoogleDrive || '') === '1' ||
        ((req.body as any)?.useGoogleDrive === undefined && Boolean(getDriveApiKey())),
    });
    if (error instanceof GoogleSheetsError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    if (error instanceof CsvImportError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    console.error('Sheets import error:', error);
    const msg = String(error?.message || error);
    if (/403|permission|forbidden|enlace → Lector|cualquier persona/i.test(msg)) {
      res.status(403).json({
        message:
          'Sin acceso al Google Sheet. Pon ambos documentos en «Cualquier persona con el enlace → Lector» (modo temporal).',
      });
      return;
    }
    res.status(500).json({
      message: 'Error importando desde Google Sheets.',
      error: error.message,
    });
  } finally {
    exitMaintenance();
    for (const p of tempPaths) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
});

/** Progreso de import CSV/Sheets/Drive (poll mientras corre el POST). */
router.get('/import-progress', verifyDevPassword, (_req: Request, res: Response): void => {
  res.json(getImportProgress());
});

/** Estado de Google Drive (nunca expone la API key). */
router.get('/google-drive-status', (_req: AuthRequest, res: Response) => {
  res.json({
    configured: Boolean(getDriveApiKey()),
    itemsFolderConfigured: Boolean(getDriveItemsFolderId()),
    vendorsFolderConfigured: Boolean(getDriveVendorsFolderId()),
    woFolderConfigured: Boolean(getDriveWoFolderId()),
  });
});

export default router;
