import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getAssetMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      res.status(404).json({ error: 'Activo no encontrado' });
      return;
    }

    const workOrders = await prisma.workOrder.findMany({
      where: { asset_id: id, status: 'FINALIZADO' },
      orderBy: { created_at: 'asc' },
      include: {
        assigned_technicians: {
          select: { name: true }
        }
      }
    });

    const correctiveOrders = workOrders.filter(wo => wo.maintenance_type === 'CORRECTIVO');
    
    let totalRepairTimeMs = 0;
    let repairCount = 0;

    correctiveOrders.forEach(wo => {
      const end = wo.completed_at ? new Date(wo.completed_at).getTime() : 0;
      const start = wo.started_at ? new Date(wo.started_at).getTime() : new Date(wo.created_at).getTime();
      let repairTimeMs = wo.accumulated_time_ms;
      if (!repairTimeMs || repairTimeMs <= 0) {
        if (end && end > start) {
          repairTimeMs = end - start;
        } else {
          repairTimeMs = 0;
        }
      }
      
      if (repairTimeMs > 0) {
        totalRepairTimeMs += repairTimeMs;
        repairCount++;
      }
    });

    const mttr_hours = repairCount > 0 ? (totalRepairTimeMs / repairCount) / (1000 * 60 * 60) : 0;

    let totalTimeBetweenFailuresMs = 0;
    let failureCountForMtbf = 0;
    
    if (correctiveOrders.length >= 2) {
       for (let i = 1; i < correctiveOrders.length; i++) {
          const prev = correctiveOrders[i-1];
          const curr = correctiveOrders[i];
          const prevEnd = prev.completed_at ? new Date(prev.completed_at).getTime() : new Date(prev.created_at).getTime();
          const currStart = new Date(curr.created_at).getTime();
          if (currStart > prevEnd) {
             totalTimeBetweenFailuresMs += (currStart - prevEnd);
             failureCountForMtbf++;
          }
       }
    }
    const mtbf_hours = failureCountForMtbf > 0 ? (totalTimeBetweenFailuresMs / failureCountForMtbf) / (1000 * 60 * 60) : 0;

    const monthly_stats: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
       const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
       monthly_stats.push({
          month: d.getMonth(),
          year: d.getFullYear(),
          label: d.toLocaleString('es-ES', { month: 'short' }).toUpperCase(),
          failures: 0,
          downtime: 0
       });
    }

    correctiveOrders.forEach(wo => {
       const woDate = new Date(wo.created_at);
       const stat = monthly_stats.find(m => m.month === woDate.getMonth() && m.year === woDate.getFullYear());
       if (stat) {
          stat.failures++;
          const end = wo.completed_at ? new Date(wo.completed_at).getTime() : 0;
          const start = wo.started_at ? new Date(wo.started_at).getTime() : woDate.getTime();
          if (end > start) {
              stat.downtime += (end - start) / (1000 * 60 * 60);
          }
       }
    });

    res.json({
      mttr_hours: parseFloat(mttr_hours.toFixed(2)),
      mtbf_hours: parseFloat(mtbf_hours.toFixed(2)),
      monthly_stats,
      history: workOrders.slice(-10).reverse() // Ultimas 10 ordenes finalizadas
    });
  } catch (error) {
    console.error('Error fetching asset metrics', error);
    res.status(500).json({ error: 'Error al obtener métricas del activo' });
  }
};
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
