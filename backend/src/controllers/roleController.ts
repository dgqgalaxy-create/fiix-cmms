import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';

const BASE_ROLES = ['ADMINISTRADOR', 'GESTIONADOR', 'TECNICO', 'OBSERVADOR'] as const;

const SYSTEM_ROLES: { name: string; base_role: (typeof BASE_ROLES)[number]; label: string }[] = [
  { name: 'Administrador', base_role: 'ADMINISTRADOR', label: 'Administrador' },
  { name: 'Gestionador', base_role: 'GESTIONADOR', label: 'Gestionador' },
  { name: 'Técnico', base_role: 'TECNICO', label: 'Técnico' },
  { name: 'Observador', base_role: 'OBSERVADOR', label: 'Observador' },
];

/**
 * Crea los 4 roles base si no existen, copiando los permisos actuales del enum.
 * Se ejecuta al arrancar (idempotente) para que la pantalla de roles tenga base.
 */
export async function ensureSystemRoles(): Promise<void> {
  for (const system of SYSTEM_ROLES) {
    let role = await prisma.roleDefinition.findUnique({ where: { name: system.name } });

    if (!role) {
      const legacy = await prisma.rolePermission.findUnique({
        where: { role: system.base_role },
      });
      role = await prisma.roleDefinition.create({
        data: {
          name: system.name,
          base_role: system.base_role,
          is_system: true,
          permissions: (legacy?.permissions as object) ?? (system.base_role === 'ADMINISTRADOR' ? { '*': true } : {}),
        },
      });
    }

    // Los usuarios sin rol configurable se enlazan a su rol base. Se ejecuta
    // siempre (idempotente) para que la pantalla de roles aplique a todos.
    await prisma.user.updateMany({
      where: { role_id: null, role: system.base_role },
      data: { role_id: role.id },
    });
  }
}

/** GET /api/roles — roles configurables con cuántos usuarios los usan. */
export const getRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureSystemRoles();
    const roles = await prisma.roleDefinition.findMany({
      orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
    res.json(roles.map((role) => ({
      id: role.id,
      name: role.name,
      base_role: role.base_role,
      permissions: role.permissions,
      is_system: role.is_system,
      users_count: role._count.users,
      created_at: role.created_at,
    })));
  } catch (error) {
    console.error('Error listando roles:', error);
    res.status(500).json({ error: 'No se pudieron obtener los roles' });
  }
};

/** POST /api/roles — { name, base_role, permissions } */
export const createRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? '').trim();
    const baseRole = String(req.body?.base_role ?? 'TECNICO').toUpperCase();
    const permissions = req.body?.permissions ?? {};

    if (!name) {
      res.status(400).json({ error: 'El nombre del rol es obligatorio.' });
      return;
    }
    if (!BASE_ROLES.includes(baseRole as (typeof BASE_ROLES)[number])) {
      res.status(400).json({ error: `El rol base debe ser uno de: ${BASE_ROLES.join(', ')}` });
      return;
    }

    const existing = await prisma.roleDefinition.findUnique({ where: { name } });
    if (existing) {
      res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
      return;
    }

    const created = await prisma.roleDefinition.create({
      data: {
        name,
        base_role: baseRole as (typeof BASE_ROLES)[number],
        permissions,
        is_system: false,
      },
    });
    emitRefresh('refresh_permissions');
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando rol:', error);
    res.status(500).json({ error: 'No se pudo crear el rol' });
  }
};

/** PUT /api/roles/:id — { name?, base_role?, permissions? } */
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.roleDefinition.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Rol no encontrado' });
      return;
    }

    const data: { name?: string; base_role?: (typeof BASE_ROLES)[number]; permissions?: object } = {};

    if (typeof req.body?.name === 'string' && req.body.name.trim() && req.body.name.trim() !== existing.name) {
      if (existing.is_system) {
        res.status(400).json({ error: 'Los roles base no se pueden renombrar.' });
        return;
      }
      const duplicate = await prisma.roleDefinition.findUnique({ where: { name: req.body.name.trim() } });
      if (duplicate) {
        res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
        return;
      }
      data.name = req.body.name.trim();
    }

    if (typeof req.body?.base_role === 'string') {
      const baseRole = req.body.base_role.toUpperCase();
      if (!BASE_ROLES.includes(baseRole as (typeof BASE_ROLES)[number])) {
        res.status(400).json({ error: `El rol base debe ser uno de: ${BASE_ROLES.join(', ')}` });
        return;
      }
      data.base_role = baseRole as (typeof BASE_ROLES)[number];
    }

    if (req.body?.permissions && typeof req.body.permissions === 'object') {
      data.permissions = req.body.permissions;
    }

    const updated = await prisma.roleDefinition.update({ where: { id }, data });

    // Si cambia el rol base, los usuarios con ese rol ajustan su enum de respaldo.
    if (data.base_role) {
      await prisma.user.updateMany({
        where: { role_id: id },
        data: { role: data.base_role },
      });
    }

    // Los roles base siguen alimentando el mapa histórico por enum (respaldo).
    if (updated.is_system && data.permissions) {
      await prisma.rolePermission.upsert({
        where: { role: updated.base_role },
        update: { permissions: data.permissions as object },
        create: { role: updated.base_role, permissions: data.permissions as object },
      });
    }

    emitRefresh('refresh_permissions');
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ error: 'No se pudo actualizar el rol' });
  }
};

/** DELETE /api/roles/:id — solo roles personalizados y sin usuarios. */
export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const role = await prisma.roleDefinition.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      res.status(404).json({ error: 'Rol no encontrado' });
      return;
    }
    if (role.is_system) {
      res.status(400).json({ error: 'Los roles base no se pueden eliminar.' });
      return;
    }
    if (role._count.users > 0) {
      res.status(409).json({
        error: `Este rol tiene ${role._count.users} usuario(s). Cámbialos de rol antes de eliminarlo.`,
      });
      return;
    }

    await prisma.roleDefinition.delete({ where: { id } });
    emitRefresh('refresh_permissions');
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando rol:', error);
    res.status(500).json({ error: 'No se pudo eliminar el rol' });
  }
};
