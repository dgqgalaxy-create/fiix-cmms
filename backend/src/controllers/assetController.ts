import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { generateInventoryCode } from '../utils/codeGenerator';
import { emitRefresh } from '../utils/socket';

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
        },
        failure_problem: { select: { id: true, name: true } },
        failure_cause: { select: { id: true, name: true } },
        failure_remedy: { select: { id: true, name: true } },
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

    // Fallas RCA más frecuentes
    const rcaCounts = new Map<string, { problem: string; cause: string | null; count: number }>();
    for (const wo of correctiveOrders) {
      if (!wo.failure_problem) continue;
      const key = `${wo.failure_problem.id}|${wo.failure_cause?.id || ''}`;
      const existing = rcaCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        rcaCounts.set(key, {
          problem: wo.failure_problem.name,
          cause: wo.failure_cause?.name || null,
          count: 1,
        });
      }
    }
    const top_failures = Array.from(rcaCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // PMs próximos (próximos 60 días o vencidos)
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 60);
    const upcoming_pms = await prisma.maintenancePlan.findMany({
      where: {
        asset_id: id,
        is_active: true,
        next_due_date: { lte: horizon },
      },
      orderBy: { next_due_date: 'asc' },
      take: 8,
      select: {
        id: true,
        title: true,
        next_due_date: true,
        frequency_type: true,
        frequency_value: true,
      },
    });

    // Stock crítico de repuestos ligados a planes de este activo
    const planItems = await prisma.planItem.findMany({
      where: { maintenance_plan: { asset_id: id } },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            internal_code: true,
            stock: true,
            minimum_inventory: true,
            uom: true,
          },
        },
      },
    });
    const criticalMap = new Map<string, typeof planItems[0]['item']>();
    for (const pi of planItems) {
      if (pi.item.stock <= pi.item.minimum_inventory) {
        criticalMap.set(pi.item.id, pi.item);
      }
    }
    const critical_stock = Array.from(criticalMap.values()).slice(0, 10);

    // Costo acumulado de refacciones consumidas en OTs de este activo
    const partTx = await prisma.inventoryTransaction.findMany({
      where: {
        amount: { lt: 0 },
        work_order: { asset_id: id },
      },
      include: {
        item: { select: { purchase_cost: true } },
      },
    });
    const parts_cost_total = partTx.reduce((sum, tx) => {
      const qty = Math.abs(tx.amount);
      const unit = tx.unit_cost ?? tx.item.purchase_cost ?? 0;
      return sum + qty * unit;
    }, 0);

    // Últimas OT (cualquier estado) para vista rápida
    const recent_orders = await prisma.workOrder.findMany({
      where: { asset_id: id },
      orderBy: { created_at: 'desc' },
      take: 8,
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        maintenance_type: true,
        priority: true,
        created_at: true,
        completed_at: true,
      },
    });

    res.json({
      mttr_hours: parseFloat(mttr_hours.toFixed(2)),
      mtbf_hours: parseFloat(mtbf_hours.toFixed(2)),
      monthly_stats,
      history: workOrders.slice(-10).reverse(),
      overview: {
        recent_orders,
        top_failures,
        upcoming_pms,
        critical_stock,
        parts_cost_total: parseFloat(parts_cost_total.toFixed(2)),
        asset_price: asset.price ?? 0,
        total_cost: parseFloat(((asset.price ?? 0) + parts_cost_total).toFixed(2)),
      },
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
    const { zone_id, vendor_id, price, name, brand, model, serial_number, description, status } = req.body;

    // El código interno es inmutable y autogenerado (ACT-0001, ACT-0002, ...).
    // Se ignora cualquier valor enviado desde el cliente.
    const internal_code = await generateInventoryCode('Asset', 'ACT-', 4);

    const assetData: any = {
      internal_code,
      name,
      brand,
      model,
      serial_number: serial_number || null,
      description: description || null,
      status,
      price: price ? parseFloat(price) : null,
    };

    // Prisma no permite mezclar el estilo de relación (connect) con la escritura
    // directa del scalar de otra relación en la misma llamada; por eso "vendor"
    // también se asigna con connect en vez de "vendor_id" plano.
    if (vendor_id) {
      assetData.vendor = { connect: { id: vendor_id } };
    }

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
    emitRefresh('refresh_assets');
    res.status(201).json(newAsset);
  } catch (error: any) {
    console.error('Create Asset Error:', error);
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
    // internal_code es inmutable una vez creado: se ignora deliberadamente
    // cualquier valor recibido para este campo en la actualización.
    const { zone_id, vendor_id, price, name, brand, model, serial_number, description, status } = req.body;

    const assetData: any = {};
    if (name) assetData.name = name;
    if (brand) assetData.brand = brand;
    if (model) assetData.model = model;
    if (serial_number !== undefined) assetData.serial_number = serial_number || null;
    if (description !== undefined) assetData.description = description || null;
    if (status) assetData.status = status;
    if (price !== undefined) assetData.price = price ? parseFloat(price) : null;
    if (zone_id) assetData.zone = { connect: { id: zone_id } };
    // "vendor" se asigna con connect/disconnect en vez del scalar "vendor_id"
    // directo, ya que Prisma no permite mezclar ambos estilos en la misma llamada.
    if (vendor_id !== undefined) {
      assetData.vendor = vendor_id ? { connect: { id: vendor_id } } : { disconnect: true };
    }

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
    emitRefresh('refresh_assets');
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
    emitRefresh('refresh_assets');
    res.json({ message: 'Activo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar activo' });
  }
};
