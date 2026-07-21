/** sessionStorage keys for Developer Options unlock window (tab-scoped). */
export const DEV_OPTIONS_UNLOCKED_AT_KEY = 'devOptionsUnlockedAt';
export const DEV_OPTIONS_PASSWORD_KEY = 'devOptionsPassword';

/** Unlock remains valid for 5 minutes after last visit/activity on Developer Options. */
export const DEV_OPTIONS_UNLOCK_TTL_MS = 5 * 60 * 1000;

export type DevOptionsSession = {
  password: string;
  unlockedAt: number;
};

function readUnlockedAt(): number | null {
  try {
    const raw = sessionStorage.getItem(DEV_OPTIONS_UNLOCKED_AT_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function readStoredPassword(): string | null {
  try {
    return sessionStorage.getItem(DEV_OPTIONS_PASSWORD_KEY);
  } catch {
    return null;
  }
}

/** Clears unlock timestamp and stored password from sessionStorage. */
export function clearDevOptionsSession(): void {
  try {
    sessionStorage.removeItem(DEV_OPTIONS_UNLOCKED_AT_KEY);
    sessionStorage.removeItem(DEV_OPTIONS_PASSWORD_KEY);
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

/**
 * Returns a valid session if unlock is still within the TTL window.
 * Expired or incomplete sessions are cleared.
 */
export function getValidDevOptionsSession(
  now: number = Date.now()
): DevOptionsSession | null {
  const unlockedAt = readUnlockedAt();
  const password = readStoredPassword();

  if (unlockedAt == null || !password) {
    clearDevOptionsSession();
    return null;
  }

  if (now - unlockedAt >= DEV_OPTIONS_UNLOCK_TTL_MS) {
    clearDevOptionsSession();
    return null;
  }

  return { password, unlockedAt };
}

/** Persists password + activity timestamp after a successful unlock or while still unlocked. */
export function saveDevOptionsSession(password: string, at: number = Date.now()): void {
  try {
    sessionStorage.setItem(DEV_OPTIONS_UNLOCKED_AT_KEY, String(at));
    sessionStorage.setItem(DEV_OPTIONS_PASSWORD_KEY, password);
  } catch {
    // ignore storage errors
  }
}

/** Refreshes the activity timestamp if a valid session exists; returns updated password or null. */
export function touchDevOptionsSession(now: number = Date.now()): string | null {
  const session = getValidDevOptionsSession(now);
  if (!session) return null;
  saveDevOptionsSession(session.password, now);
  return session.password;
}
