import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

function extractBearerOrQueryToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1] || null;
  }
  const q = req.query.access_token;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return null;
}

/**
 * Valida JWT + existencia + is_active. Usa rol actual de la BD (no solo el del token).
 */
export async function resolveAuthUser(
  token: string
): Promise<{ userId: string; role: string } | { error: string; status: number }> {
  try {
    const decoded = verifyToken(token) as { userId: string; role: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, is_active: true },
    });
    if (!user) {
      return { error: 'El usuario ya no existe', status: 401 };
    }
    if (!user.is_active) {
      return { error: 'Usuario desactivado', status: 401 };
    }
    return { userId: user.id, role: user.role };
  } catch {
    return { error: 'Token expirado o inválido', status: 401 };
  }
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = extractBearerOrQueryToken(req);
  if (!token) {
    res.status(401).json({ error: 'Token no proporcionado o inválido' });
    return;
  }

  void resolveAuthUser(token).then((result) => {
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    req.user = result;
    next();
  });
};

/**
 * Protege GET /uploads: exige JWT (Authorization o ?access_token=).
 * Desactivar con PUBLIC_UPLOADS=1 (emergencia / depuración).
 */
export const requireUploadAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.PUBLIC_UPLOADS === '1' || process.env.PUBLIC_UPLOADS === 'true') {
    next();
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  const token = extractBearerOrQueryToken(req);
  if (!token) {
    res.status(401).json({ error: 'Se requiere autenticación para ver archivos' });
    return;
  }
  void resolveAuthUser(token).then((result) => {
    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    next();
  });
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
      return;
    }

    next();
  };
};

/**
 * Bloquea mutaciones para OBSERVADOR (solo consulta + Mensajes).
 * No aplicar en /api/chat ni en lecturas / preferencias / notificaciones vistas.
 */
export const requireWritable = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  if (req.user.role === 'OBSERVADOR') {
    res.status(403).json({
      error: 'Tu perfil (Observador) solo permite consultar y usar Mensajes',
    });
    return;
  }
  next();
};

export const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    if (req.user.role === 'OBSERVADOR') {
      const readOk = permission === 'VIEW_ALL_WORK_ORDERS' || permission === 'VIEW_RCA';
      if (!readOk) {
        res.status(403).json({
          error: 'Tu perfil (Observador) solo permite consultar y usar Mensajes',
        });
        return;
      }
    }

    try {
      const rolePerms = await prisma.rolePermission.findUnique({
        where: { role: req.user.role as Role },
      });

      if (!rolePerms) {
        if (req.user.role === 'ADMINISTRADOR') {
          return next();
        }
        res.status(403).json({ error: 'No tienes permisos asignados' });
        return;
      }

      const perms: any = rolePerms.permissions;
      if (perms[permission] === true) {
        next();
      } else {
        res.status(403).json({ error: 'No tienes el permiso: ' + permission });
      }
    } catch (err) {
      res.status(500).json({ error: 'Error verificando permisos' });
    }
  };
};

export const requireAnyPermission = (permissions: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    try {
      const rolePerms = await prisma.rolePermission.findUnique({
        where: { role: req.user.role as Role },
      });

      if (!rolePerms) {
        if (req.user.role === 'ADMINISTRADOR') {
          return next();
        }
        res.status(403).json({ error: 'No tienes permisos asignados' });
        return;
      }

      const perms: any = rolePerms.permissions;
      const hasAny = permissions.some((p) => perms[p] === true);

      if (hasAny) {
        next();
      } else {
        res.status(403).json({ error: 'No tienes los permisos requeridos' });
      }
    } catch (err) {
      res.status(500).json({ error: 'Error verificando permisos' });
    }
  };
};
