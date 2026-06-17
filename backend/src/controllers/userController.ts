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
       res.status(400).json({ error: 'No se puede eliminar el usuario porque tiene órdenes de trabajo asociadas. Mantén su cuenta activa o cambia su rol.' });
       return;
    }
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};
