import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';
import { emitRefresh, getConnectedUserIds } from '../utils/socket';
import { writeAuditLog } from '../utils/auditLog';
import { diffRequestedChanges } from '../utils/auditChanges';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    
    const filter: any = {};
    if (role && Object.values(Role).includes(role as Role)) {
      filter.role = role;
    }

    const users = await prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        is_active: true,
        created_at: true
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password || !role) {
      res.status(400).json({ error: 'Todos los campos son obligatorios' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
       res.status(400).json({ error: 'El correo electrónico ya está registrado' });
       return;
    }
    
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password_hash, role }
    });
    
    emitRefresh('refresh_users');
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch(error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, email, password, role, is_active } = req.body;

    const beforeUser = await prisma.user.findUnique({
      where: { id },
      select: { name: true, email: true, role: true, is_active: true },
    });
    if (!beforeUser) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const updateData: any = { name, email, role };
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    let passwordChanged = false;
    if (password && password.trim() !== '') {
      updateData.password_hash = await bcrypt.hash(password, 10);
      passwordChanged = true;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData
    });

    // Bitácora: valores anteriores → nuevos (solo campos presentes en el request).
    const labels: Record<string, string> = {
      name: 'nombre',
      email: 'correo',
      role: 'rol',
      is_active: 'activo',
    };
    const requestedDiff: Record<string, unknown> = {};
    if (name !== undefined) requestedDiff.name = name;
    if (email !== undefined) requestedDiff.email = email;
    if (role !== undefined) requestedDiff.role = role;
    if (is_active !== undefined) requestedDiff.is_active = is_active;
    const changes = diffRequestedChanges(
      {
        name: beforeUser.name,
        email: beforeUser.email,
        role: beforeUser.role,
        is_active: beforeUser.is_active,
      },
      requestedDiff,
      labels
    );
    if (passwordChanged) {
      changes.push({ campo: 'contraseña', antes: '(oculta)', despues: '(cambiada)' });
    }
    if (changes.length > 0) {
      const actorU = (req as any).user?.userId as string | undefined;
      const actorN = actorU
        ? (await prisma.user.findUnique({ where: { id: actorU }, select: { name: true } }))?.name
        : null;
      await writeAuditLog({
        userId: actorU ?? null,
        userName: actorN,
        action: 'USER_UPDATE',
        entity: 'user',
        entityId: id,
        summary: `Usuario ${user.name} actualizado (${changes.length} campo${changes.length === 1 ? '' : 's'})`,
        meta: { user_id: id, changes: changes as unknown as Prisma.InputJsonValue },
      });
    }

    emitRefresh('refresh_users');
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch(error: any) {
    console.error('Error updating user:', error);
    if (error.code === 'P2002') {
       res.status(400).json({ error: 'El correo electrónico ya está registrado en otra cuenta' });
       return;
    }
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.user.delete({ where: { id } });
    emitRefresh('refresh_users');
    res.json({ message: 'Usuario eliminado' });
  } catch(error: any) {
    console.error('Error deleting user:', error);
    if (error.code === 'P2003') {
       res.status(400).json({ error: 'No es posible eliminar el usuario debido a que tiene registros ligados (órdenes de trabajo o movimientos de inventario). Por favor, dalo de baja marcándolo como Inactivo.' });
       return;
    }
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

export const heartbeat = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const rawPath = typeof req.body?.path === 'string'
      ? req.body.path
      : typeof req.body?.module === 'string'
        ? req.body.module
        : undefined;
    const current_path = typeof rawPath === 'string' && rawPath.trim()
      ? rawPath.trim().slice(0, 200)
      : undefined;

    await prisma.user.update({
      where: { id: userId },
      data: {
        last_active: new Date(),
        ...(current_path !== undefined ? { current_path } : {})
      }
    });

    res.json({ message: 'Heartbeat registrado' });
  } catch (error) {
    console.error('Error in heartbeat:', error);
    res.status(500).json({ error: 'Error registrando heartbeat' });
  }
};

export const getOnlineUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let connectedIds: string[] = [];
    try {
      connectedIds = getConnectedUserIds();
    } catch {
      connectedIds = [];
    }

    const onlineUsers = await prisma.user.findMany({
      where: {
        is_active: true,
        OR: [
          { last_active: { gte: fiveMinutesAgo } },
          ...(connectedIds.length > 0 ? [{ id: { in: connectedIds } }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,
        last_active: true,
        current_path: true,
      },
      orderBy: {
        last_active: 'desc',
      },
    });

    res.json(onlineUsers);
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios en línea' });
  }
};

export const updateMyPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const { preferences } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { preferences }
    });

    res.json({ id: user.id, preferences: user.preferences });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Error al actualizar preferencias' });
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        preferences: true,
        must_change_password: true,
      }
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching me:', error);
    res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
};
