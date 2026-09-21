import prisma from '../config/prisma';
import type { Prisma } from '@prisma/client';
export const DEV_PASSWORD_MAX_ATTEMPTS = 3;
export const DEV_PASSWORD_LOCK_MS = 60 * 60 * 1000;
export const DEV_PASSWORD_CODES = { REQUIRED: 'DEV_PASSWORD_REQUIRED', INVALID: 'DEV_PASSWORD_INVALID', LOCKED: 'DEV_PASSWORD_LOCKED' } as const;
export type DevGateStatus = { locked: false; failedAttempts: number } | { locked: true; failedAttempts: number; lockedUntil: string };

async function withLock<T>(userId: string, action: (tx: Prisma.TransactionClient, state: { failed_attempts: number; locked_until: Date | null }) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
    let state = await tx.developerAccessLock.findUnique({ where: { user_id: userId } });
    if (!state) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { preferences: true } });
      const legacy = (user.preferences as Record<string, any> | null)?.dev_menu_lock;
      const until = legacy?.lockedUntil ? new Date(legacy.lockedUntil) : null;
      state = await tx.developerAccessLock.create({ data: {
        user_id: userId,
        failed_attempts: Math.max(0, Math.min(3, Number(legacy?.failedAttempts) || 0)),
        locked_until: until && Number.isFinite(until.getTime()) ? until : null,
      } });
    }
    if (state.locked_until && state.locked_until.getTime() <= Date.now()) {
      state = await tx.developerAccessLock.update({ where: { user_id: userId }, data: { failed_attempts: 0, locked_until: null } });
    }
    return action(tx, state);
  });
}
export async function getDevPasswordGateStatus(userId: string): Promise<DevGateStatus> {
  return withLock(userId, async (_, state) => state.locked_until
    ? { locked: true, failedAttempts: state.failed_attempts, lockedUntil: state.locked_until.toISOString() }
    : { locked: false, failedAttempts: state.failed_attempts });
}
export async function clearDevPasswordFailures(userId: string): Promise<void> {
  await withLock(userId, async (tx, state) => {
    // No quitar un bloqueo que se activó mientras otra petición validaba una clave.
    if (state.locked_until) return;
    await tx.developerAccessLock.update({ where: { user_id: userId }, data: { failed_attempts: 0, locked_until: null } });
  });
}
export async function recordDevPasswordFailure(userId: string): Promise<{ remainingAttempts: number; locked: boolean; lockedUntil: string | null }> {
  return withLock(userId, async (tx, state) => {
    if (state.locked_until) return { remainingAttempts: 0, locked: true, lockedUntil: state.locked_until.toISOString() };
    const count = state.failed_attempts + 1;
    const until = count >= DEV_PASSWORD_MAX_ATTEMPTS ? new Date(Date.now() + DEV_PASSWORD_LOCK_MS) : null;
    await tx.developerAccessLock.update({ where: { user_id: userId }, data: { failed_attempts: count, locked_until: until } });
    return { remainingAttempts: Math.max(0, DEV_PASSWORD_MAX_ATTEMPTS - count), locked: !!until, lockedUntil: until?.toISOString() ?? null };
  });
}
