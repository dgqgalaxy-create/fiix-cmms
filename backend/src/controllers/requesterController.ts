import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getRequesters = async (req: Request, res: Response) => {
  try {
    const requesters = await prisma.requester.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(requesters);
  } catch (error) {
    console.error('Error in getRequesters:', error);
    res.status(500).json({ error: 'Error al obtener los solicitantes' });
  }
};

export const createRequester = async (req: Request, res: Response) => {
  try {
    const { name, email, department } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    // Check if requester exists
    const existing = await prisma.requester.findUnique({
      where: { name: name.trim() }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un solicitante con ese nombre' });
    }

    const requester = await prisma.requester.create({
      data: {
        name: name.trim(),
        email: email ? email.trim() : null,
        department: department ? department.trim() : null,
      }
    });

    res.status(201).json(requester);
  } catch (error) {
    console.error('Error in createRequester:', error);
    res.status(500).json({ error: 'Error al crear el solicitante' });
  }
};

export const updateRequester = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, email, department } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    // Check if another requester has this name
    const existing = await prisma.requester.findUnique({
      where: { name: name.trim() }
    });
    
    if (existing && existing.id !== id) {
      return res.status(400).json({ error: 'Ya existe otro solicitante con ese nombre' });
    }

    const requester = await prisma.requester.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email ? email.trim() : null,
        department: department ? department.trim() : null,
      }
    });

    res.json(requester);
  } catch (error) {
    console.error('Error in updateRequester:', error);
    res.status(500).json({ error: 'Error al actualizar el solicitante' });
  }
};

export const deleteRequester = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.requester.delete({
      where: { id }
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error in deleteRequester:', error);
    res.status(500).json({ error: 'Error al eliminar el solicitante' });
  }
};

export const migrateRequesters = async (req: Request, res: Response) => {
  try {
    // 1. Get all unique requester_names from WorkOrder
    const uniqueNames = await prisma.workOrder.findMany({
      where: {
        requester_name: { not: null }
      },
      select: {
        requester_name: true
      },
      distinct: ['requester_name']
    });

    const namesToInsert = uniqueNames
      .map(wo => wo.requester_name?.trim())
      .filter((name): name is string => !!name && name.length > 0);

    // 2. Upsert them in Requester table
    let count = 0;
    for (const name of namesToInsert) {
      const existing = await prisma.requester.findUnique({
        where: { name }
      });
      if (!existing) {
        await prisma.requester.create({
          data: { name }
        });
        count++;
      }
    }

    res.json({ message: `Migración exitosa. Se insertaron ${count} solicitantes nuevos.`, count });
  } catch (error) {
    console.error('Error in migrateRequesters:', error);
    res.status(500).json({ error: 'Error en la migración de solicitantes' });
  }
};
