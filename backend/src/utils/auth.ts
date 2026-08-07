import jwt from 'jsonwebtoken';

const INSECURE_DEFAULT = 'super-secret-key-change-me';

let cachedSecret: string | null = null;

/**
 * JWT_SECRET obligatorio y distinto del default inseguro.
 * En local de emergencia: ALLOW_INSECURE_JWT=1 (nunca en planta).
 * Llamar assertJwtConfigured() tras dotenv.config() al arrancar.
 */
export function resolveJwtSecret(): string {
  const raw = (process.env.JWT_SECRET || '').trim();
  const allowInsecure = process.env.ALLOW_INSECURE_JWT === '1';

  if (!raw || raw === INSECURE_DEFAULT) {
    if (allowInsecure) {
      console.warn(
        '[GTZ] AVISO: JWT_SECRET ausente o inseguro; ALLOW_INSECURE_JWT=1 activo. No uses esto en producción.'
      );
      return raw || INSECURE_DEFAULT;
    }
    throw new Error(
      'JWT_SECRET ausente o inseguro en backend/.env. Define un secreto largo y único. ' +
        'Lab: ALLOW_INSECURE_JWT=1'
    );
  }

  if (raw.length < 16) {
    console.warn('[GTZ] AVISO: JWT_SECRET es corto (<16); considera uno más largo.');
  }

  return raw;
}

export function assertJwtConfigured(): void {
  try {
    cachedSecret = resolveJwtSecret();
  } catch (err) {
    console.error('[GTZ] FATAL:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

function jwtSecret(): string {
  if (!cachedSecret) {
    cachedSecret = resolveJwtSecret();
  }
  return cachedSecret;
}

export const generateToken = (userId: string, role: string) => {
  return jwt.sign({ userId, role }, jwtSecret(), { expiresIn: '1d' });
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, jwtSecret());
};
