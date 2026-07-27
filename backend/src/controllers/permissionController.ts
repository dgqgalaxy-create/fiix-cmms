import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';
import { emitRefresh } from '../utils/socket';
import { writeAuditLog } from '../utils/auditLog';
import type { AuthRequest } from '../middlewares/authMiddleware';

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
    MANAGE_INVENTORY: true,
    MANAGE_MAINTENANCE_PLANS: true,
    VIEW_ALL_WORK_ORDERS: true,
    MANAGE_CALENDAR: true,
    USE_QR_SCANNER: true,
    APPROVE_CHECKLIST: true,
    MANAGE_CHECKLIST_CATALOG: true,
    MANAGE_PURCHASES: true,
    REGISTER_INVENTORY_ENTRIES: true,
    MANAGE_SHIFTS: true,
    VIEW_RCA: true,
    MANAGE_RCA: true,
    VIEW_SETTINGS: true,
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
    MANAGE_INVENTORY: true,
    MANAGE_MAINTENANCE_PLANS: true,
    VIEW_ALL_WORK_ORDERS: true,
    MANAGE_CALENDAR: true,
    USE_QR_SCANNER: true,
    APPROVE_CHECKLIST: true,
    MANAGE_CHECKLIST_CATALOG: false,
    MANAGE_PURCHASES: true,
    REGISTER_INVENTORY_ENTRIES: true,
    MANAGE_SHIFTS: false,
    VIEW_RCA: true,
    MANAGE_RCA: true,
    VIEW_SETTINGS: true,
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
    MANAGE_INVENTORY: false,
    MANAGE_MAINTENANCE_PLANS: false,
    VIEW_ALL_WORK_ORDERS: false,
    MANAGE_CALENDAR: false,
    USE_QR_SCANNER: true,
    APPROVE_CHECKLIST: false,
    MANAGE_CHECKLIST_CATALOG: false,
    MANAGE_PURCHASES: false,
    REGISTER_INVENTORY_ENTRIES: false,
    MANAGE_SHIFTS: false,
    VIEW_RCA: true,
    MANAGE_RCA: false,
    VIEW_SETTINGS: false,
  },
};

const getOrCreatePermissions = async (role: Role) => {
  let rolePerms = await prisma.rolePermission.findUnique({
    where: { role },
  });

  const defaults = defaultPermissions[role] || {};

  if (!rolePerms) {
    rolePerms = await prisma.rolePermission.create({
      data: {
        role,
        permissions: defaults,
      },
    });
  } else {
    // Merge missing permissions for existing roles
    let needsUpdate = false;
    const currentPerms = rolePerms.permissions as Record<string, boolean>;
    const updatedPerms = { ...currentPerms };

    for (const key of Object.keys(defaults)) {
      if (updatedPerms[key] === undefined) {
        updatedPerms[key] = defaults[key];
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      rolePerms = await prisma.rolePermission.update({
        where: { role },
        data: { permissions: updatedPerms },
      });
    }
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

export const updateRolePermissions = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const actorId = req.user?.userId;
    const actor = actorId
      ? await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } })
      : null;
    await writeAuditLog({
      userId: actorId,
      userName: actor?.name,
      action: 'UPDATE_PERMISSIONS',
      entity: 'permissions',
      entityId: role,
      summary: `Permisos del rol ${role} actualizados`,
      meta: { permissions },
    });

    emitRefresh('refresh_permissions');
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar permisos' });
  }
};
