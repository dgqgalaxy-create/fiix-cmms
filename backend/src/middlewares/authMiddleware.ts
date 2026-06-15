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

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token no proporcionado o inválido' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token) as { userId: string; role: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token expirado o inválido' });
  }
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

export const requirePermission = (permission: string) => {
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
        // If not seeded yet, fallback to roles checking or deny
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
      const hasAny = permissions.some(p => perms[p] === true);
      
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
