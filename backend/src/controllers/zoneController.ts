import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getZones = async (req: Request, res: Response) => {
  try {
    const zones = await prisma.zone.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(zones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
};

export const createZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'El nombre es obligatorio' });
      return;
    }
    
    // Check if exists
    const existing = await prisma.zone.findUnique({ where: { name } });
    if (existing) {
      res.status(400).json({ error: 'La zona ya existe' });
      return;
    }

    const newZone = await prisma.zone.create({ data: { name } });
    res.status(201).json(newZone);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear zona' });
  }
};

export const deleteZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Check if it's used
    const inUse = await prisma.workOrder.findFirst({ where: { zone_id: id } });
    if (inUse) {
      res.status(400).json({ error: 'No se puede eliminar la zona porque tiene órdenes asociadas' });
      return;
    }

    await prisma.zone.delete({ where: { id } });
    res.json({ message: 'Zona eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar zona' });
  }
};
