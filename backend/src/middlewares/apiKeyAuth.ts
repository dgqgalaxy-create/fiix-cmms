import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';
import prisma from '../config/prisma';
import type { AuthRequest } from '../middlewares/authMiddleware';

/** Genera una llave nueva: se guarda solo el hash y se muestra una vez. */
export function generateApiKey(): { plain: string; hash: string; prefix: string } {
  const raw = randomBytes(24).toString('hex');
  const plain = `gtz_${raw}`;
  return {
    plain,
    hash: hashApiKey(plain),
    prefix: plain.slice(0, 12),
  };
}

export function hashApiKey(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

function extractKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    if (token.startsWith('gtz_')) return token;
  }
  return null;
}

/**
 * Autenticación para la API pública v1 (integraciones).
 * Acepta `X-API-Key: gtz_...` o `Authorization: Bearer gtz_...`.
 */
export const authenticateApiKey = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const plain = extractKey(req);
  if (!plain) {
    res.status(401).json({ error: 'Falta la llave de API (X-API-Key).' });
    return;
  }

  try {
    const record = await prisma.apiKey.findUnique({
      where: { key_hash: hashApiKey(plain) },
      select: {
        id: true,
        name: true,
        scopes: true,
        is_active: true,
        expires_at: true,
        created_by_id: true,
      },
    });

    if (!record || !record.is_active) {
      res.status(401).json({ error: 'Llave de API inválida o desactivada.' });
      return;
    }
    if (record.expires_at && record.expires_at.getTime() < Date.now()) {
      res.status(401).json({ error: 'La llave de API expiró.' });
      return;
    }

    await prisma.apiKey.update({
      where: { id: record.id },
      data: { last_used_at: new Date() },
      select: { id: true },
    });

    const scopes = Array.isArray(record.scopes) ? (record.scopes as string[]) : [];
    (req as any).apiKey = { id: record.id, name: record.name, scopes };
    next();
  } catch (error) {
    console.error('Error validando la llave de API:', error);
    res.status(500).json({ error: 'No se pudo validar la llave de API' });
  }
};

/** Exige que la llave tenga el alcance indicado (read | write). */
export const requireScope = (scope: 'read' | 'write') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const scopes: string[] = (req as any).apiKey?.scopes ?? [];
    if (scopes.includes(scope) || scopes.includes('*')) {
      next();
      return;
    }
    res.status(403).json({ error: `La llave no tiene el alcance «${scope}».` });
  };
};
