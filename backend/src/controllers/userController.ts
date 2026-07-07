import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { Role } from '@prisma/client';

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
    
    const updateData: any = { name, email, role };
    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }
    if (password && password.trim() !== '') {
       updateData.password_hash = await bcrypt.hash(password, 10);
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: updateData
    });
    
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

    await prisma.user.update({
      where: { id: userId },
      data: { last_active: new Date() }
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

    const onlineUsers = await prisma.user.findMany({
      where: {
        last_active: {
          gte: fiveMinutesAgo
        },
        is_active: true
      },
      select: {
        id: true,
        name: true,
        role: true,
        last_active: true
      },
      orderBy: {
        last_active: 'desc'
      }
    });

    res.json(onlineUsers);
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios en línea' });
  }
};
