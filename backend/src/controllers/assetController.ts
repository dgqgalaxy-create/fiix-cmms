import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const assets = await prisma.asset.findMany({
      include: {
        zone: true,
        vendor: true,
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener activos' });
  }
};

export const getAssetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        zone: true,
        vendor: true,
      },
    });
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
    const { zone_id, vendor_id, price, internal_code, name, brand, model, serial_number, description, status } = req.body;
    
    const assetData: any = {
      internal_code,
      name,
      brand,
      model,
      serial_number: serial_number || null,
      description: description || null,
      status,
      vendor_id: vendor_id || null,
      price: price ? parseFloat(price) : null,
    };

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.['image']) {
      assetData.image_url = `/uploads/assets/${files['image'][0].filename}`;
    }
    if (files?.['document']) {
      assetData.document_url = `/uploads/assets/${files['document'][0].filename}`;
    }

    if (!zone_id) {
      res.status(400).json({ error: 'La zona (zone_id) es obligatoria' });
      return;
    }

    assetData.zone = { connect: { id: zone_id } };

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
    const { zone_id, internal_code, name, brand, model, serial_number, description, status } = req.body;

    const assetData: any = {};
    if (internal_code) assetData.internal_code = internal_code;
    if (name) assetData.name = name;
    if (brand) assetData.brand = brand;
    if (model) assetData.model = model;
    if (serial_number !== undefined) assetData.serial_number = serial_number || null;
    if (description !== undefined) assetData.description = description || null;
    if (status) assetData.status = status;
    if (zone_id) assetData.zone = { connect: { id: zone_id } };

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.['image']) {
      assetData.image_url = `/uploads/assets/${files['image'][0].filename}`;
    }
    if (files?.['document']) {
      assetData.document_url = `/uploads/assets/${files['document'][0].filename}`;
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: assetData
    });
    res.json(updatedAsset);
  } catch (error) {
    console.error('Update Asset Error:', error);
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
