import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';

const defaultPermissions: Record<Role, any> = {
  ADMINISTRADOR: {
    MANAGE_USERS: true,
    MANAGE_ASSETS: true,
    MANAGE_ZONES: true,
    MANAGE_KPIS: true,
    CREATE_WORK_ORDERS: true,
    EDIT_WORK_ORDERS: true,
    DELETE_WORK_ORDERS: true,
    MANAGE_PERMISSIONS: true,
  },
  GESTIONADOR: {
    MANAGE_USERS: false,
    MANAGE_ASSETS: true,
    MANAGE_ZONES: true,
    MANAGE_KPIS: true,
    CREATE_WORK_ORDERS: true,
    EDIT_WORK_ORDERS: true,
    DELETE_WORK_ORDERS: false,
    MANAGE_PERMISSIONS: false,
  },
  TECNICO: {
    MANAGE_USERS: false,
    MANAGE_ASSETS: false,
    MANAGE_ZONES: false,
    MANAGE_KPIS: false,
    CREATE_WORK_ORDERS: false,
    EDIT_WORK_ORDERS: true,
    DELETE_WORK_ORDERS: false,
    MANAGE_PERMISSIONS: false,
  },
};

// Seed defaults
const getOrCreatePermissions = async (role: Role) => {
  let rolePerms = await prisma.rolePermission.findUnique({
    where: { role },
  });

  if (!rolePerms) {
    rolePerms = await prisma.rolePermission.create({
      data: {
        role,
        permissions: defaultPermissions[role],
      },
    });
  }
  return rolePerms;
};

export const getAllPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const roles = Object.values(Role);
    const result = [];
    
    for (const r of roles) {
      const perms = await getOrCreatePermissions(r);
      result.push(perms);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
};

export const getMyPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = (req as any).user?.role as Role;
    if (!role) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }
    const perms = await getOrCreatePermissions(role);
    res.json(perms.permissions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
};

export const updateRolePermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = req.params.role as Role;
    const permissions = req.body.permissions;

    if (!Object.values(Role).includes(role)) {
      res.status(400).json({ error: 'Rol inválido' });
      return;
    }

    if (!permissions || typeof permissions !== 'object') {
      res.status(400).json({ error: 'Formato de permisos inválido' });
      return;
    }

    const updated = await prisma.rolePermission.upsert({
      where: { role },
      update: { permissions },
      create: { role, permissions },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar permisos' });
  }
};
