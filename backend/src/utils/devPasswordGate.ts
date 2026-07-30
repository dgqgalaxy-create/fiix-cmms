import prisma from '../config/prisma';
import { Prisma } from '@prisma/client';

/** Máximo de intentos fallidos antes de bloquear 1 hora (persistido en User.preferences). */
export const DEV_PASSWORD_MAX_ATTEMPTS = 3;
export const DEV_PASSWORD_LOCK_MS = 60 * 60 * 1000;

export const DEV_PASSWORD_CODES = {
  REQUIRED: 'DEV_PASSWORD_REQUIRED',
  INVALID: 'DEV_PASSWORD_INVALID',
  LOCKED: 'DEV_PASSWORD_LOCKED',
} as const;

type DevMenuLockState = {
  failedAttempts: number;
  lockedUntil: string | null;
};

type Prefs = Record<string, unknown> & { dev_menu_lock?: DevMenuLockState };

function asPrefs(raw: unknown): Prefs {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Prefs) };
  }
  return {};
}

function readLock(prefs: Prefs): DevMenuLockState {
  const lock = prefs.dev_menu_lock;
  if (!lock || typeof lock !== 'object') {
    return { failedAttempts: 0, lockedUntil: null };
  }
  return {
    failedAttempts: typeof lock.failedAttempts === 'number' ? lock.failedAttempts : 0,
    lockedUntil: typeof lock.lockedUntil === 'string' ? lock.lockedUntil : null,
  };
}

async function saveLock(userId: string, lock: DevMenuLockState | null): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  if (!user) return;

  const prefs = asPrefs(user.preferences);
  if (lock === null) {
    delete prefs.dev_menu_lock;
  } else {
    prefs.dev_menu_lock = lock;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { preferences: prefs as Prisma.InputJsonValue },
  });
}

export type DevGateStatus =
  | { locked: false; failedAttempts: number }
  | { locked: true; failedAttempts: number; lockedUntil: string };

/**
 * Estado actual del candado de contraseña maestra (User.preferences.dev_menu_lock).
 * Si el bloqueo ya expiró, limpia el contador en BD.
 */
export async function getDevPasswordGateStatus(userId: string): Promise<DevGateStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  if (!user) {
    return { locked: false, failedAttempts: 0 };
  }

  const prefs = asPrefs(user.preferences);
  const lock = readLock(prefs);
  const now = Date.now();

  if (lock.lockedUntil) {
    const until = Date.parse(lock.lockedUntil);
    if (!Number.isNaN(until) && until > now) {
      return {
        locked: true,
        failedAttempts: lock.failedAttempts,
        lockedUntil: lock.lockedUntil,
      };
    }
    // Bloqueo expirado → reinicia intentos
    await saveLock(userId, null);
    return { locked: false, failedAttempts: 0 };
  }

  return { locked: false, failedAttempts: lock.failedAttempts };
}

export async function clearDevPasswordFailures(userId: string): Promise<void> {
  await saveLock(userId, null);
}

/**
 * Registra un intento fallido. Al llegar a MAX, bloquea 1 hora.
 */
export async function recordDevPasswordFailure(userId: string): Promise<{
  remainingAttempts: number;
  locked: boolean;
  lockedUntil: string | null;
}> {
  const status = await getDevPasswordGateStatus(userId);
  if (status.locked) {
    return {
      remainingAttempts: 0,
      locked: true,
      lockedUntil: status.lockedUntil,
    };
  }

  const failedAttempts = status.failedAttempts + 1;
  if (failedAttempts >= DEV_PASSWORD_MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + DEV_PASSWORD_LOCK_MS).toISOString();
    await saveLock(userId, { failedAttempts, lockedUntil });
    return { remainingAttempts: 0, locked: true, lockedUntil };
  }

  await saveLock(userId, { failedAttempts, lockedUntil: null });
  return {
    remainingAttempts: DEV_PASSWORD_MAX_ATTEMPTS - failedAttempts,
    locked: false,
    lockedUntil: null,
  };
}
