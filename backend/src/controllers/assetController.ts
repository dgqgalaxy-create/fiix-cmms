import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const assets = await prisma.asset.findMany();
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener activos' });
  }
};

export const getAssetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      res.status(404).json({ error: 'Activo no encontrado' });
      return;
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener activo' });
  }
};

export const createAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const assetData = req.body;
    const newAsset = await prisma.asset.create({ data: assetData });
    res.status(201).json(newAsset);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'El internal_code ya existe' });
      return;
    }
    res.status(500).json({ error: 'Error al crear activo' });
  }
};

export const updateAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const assetData = req.body;
    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: assetData
    });
    res.json(updatedAsset);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar activo' });
  }
};

export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.asset.delete({ where: { id } });
    res.json({ message: 'Activo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar activo' });
  }
};
