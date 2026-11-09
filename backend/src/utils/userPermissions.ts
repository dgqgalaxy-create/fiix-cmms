import prisma from '../config/prisma';
import type { Role } from '@prisma/client';

export interface PermissionSnapshot {
  /** Mapa de permisos efectivos. */
  permissions: Record<string, boolean>;
  /** Rol base del enum (compatibilidad con requireRole y reportes). */
  baseRole: string;
  /** Nombre del rol configurable, si el usuario tiene role_id. */
  roleName: string | null;
  roleId: string | null;
}

/**
 * Resuelve los permisos de un usuario:
 * 1) Si tiene `role_id`, manda la definición de rol (RoleDefinition.permissions).
 * 2) Si no, se usa el mapa histórico por enum (RolePermission).
 * 3) Administrador sin fila configurada conserva acceso total.
 */
export async function getPermissionSnapshot(userId: string): Promise<PermissionSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      role_id: true,
      role_def: { select: { name: true, base_role: true, permissions: true } },
    },
  });
  if (!user) return null;

  const baseRole = (user.role_def?.base_role ?? user.role) as Role;

  if (user.role_def) {
    return {
      permissions: (user.role_def.permissions as Record<string, boolean>) ?? {},
      baseRole,
      roleName: user.role_def.name,
      roleId: user.role_id,
    };
  }

  const legacy = await prisma.rolePermission.findUnique({ where: { role: user.role } });
  if (!legacy) {
    return {
      permissions: user.role === 'ADMINISTRADOR' ? { '*': true } : {},
      baseRole,
      roleName: null,
      roleId: null,
    };
  }

  return {
    permissions: (legacy.permissions as Record<string, boolean>) ?? {},
    baseRole,
    roleName: null,
    roleId: null,
  };
}

/** ¿El snapshot concede el permiso? `*` es el comodín de administrador sin fila. */
export function snapshotAllows(snapshot: PermissionSnapshot, permission: string): boolean {
  if (snapshot.permissions['*'] === true) return true;
  return snapshot.permissions[permission] === true;
}
