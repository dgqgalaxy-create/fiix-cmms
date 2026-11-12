import type { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import type { AuthRequest } from './authMiddleware';
import {
  DEV_PASSWORD_CODES,
  DEV_PASSWORD_MAX_ATTEMPTS,
  clearDevPasswordFailures,
  getDevPasswordGateStatus,
  recordDevPasswordFailure,
} from '../utils/devPasswordGate';

/**
 * Middleware de contraseña maestra (Opción de Desarrollador).
 *
 * Nunca responde 401 por clave incorrecta: 401 haría que el interceptor del
 * frontend cerrara la sesión. Se usa 403 con un `code` para que la UI distinga
 * entre «falta la clave», «clave incorrecta» y «bloqueado por intentos».
 */
export function formatLockWait(lockedUntilIso: string): string {
  const ms = Math.max(0, Date.parse(lockedUntilIso) - Date.now());
  const mins = Math.ceil(ms / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return mins <= 1 ? '1 minuto' : `${mins} minutos`;
}

type VerifyDevPasswordOptions = {
  /**
   * Si es true, cualquier intento fallido cuenta para el bloqueo temporal.
   * Por defecto solo POST /verify consume intentos (evita bloquear al usuario
   * por una sesión de desarrollador caducada).
   */
  trackFailures?: boolean;
};

export const createVerifyDevPassword = ({ trackFailures = false }: VerifyDevPasswordOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const password = req.headers['x-dev-password'] as string;

    if (!userId) {
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
        const shouldTrack =
          trackFailures || (req.method === 'POST' && (req.path === '/verify' || req.path.endsWith('/verify')));

        if (shouldTrack) {
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
      console.error('[DEV VERIFY] Error:', error);
      res.status(500).json({ message: 'Error verificando credenciales.' });
    }
  };
};

/** Comportamiento histórico de /api/dev/* (solo /verify consume intentos). */
export const verifyDevPassword = createVerifyDevPassword();

/** Para acciones destructivas: cualquier clave incorrecta cuenta para el bloqueo. */
export const verifyDevPasswordStrict = createVerifyDevPassword({ trackFailures: true });
