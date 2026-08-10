import { Request, Response } from 'express';
import { AssetKind, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { resolveAssetZoneSection } from '../utils/assetSection';
import {
  generateAssetInternalCode,
  normalizeAssetKind,
  normalizeEquipmentName,
} from '../utils/assetCodeGenerator';
import { resolvePartsUnitCost } from '../utils/resolvePartsUnitCost';

const assetInclude = {
  zone: { include: { sections: { orderBy: { name: 'asc' as const } } } },
  zone_section: true,
  vendor: true,
};

async function loadZoneForSection(zoneId: string) {
  return prisma.zone.findUnique({
    where: { id: zoneId },
    include: { sections: { orderBy: { name: 'asc' } } },
  });
}

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
      return sum + qty * resolvePartsUnitCost(tx);
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
    const { page, limit, q, zoneId, zoneSectionId, status } = req.query;
    const and: Record<string, unknown>[] = [];
    if (zoneId) and.push({ zone_id: String(zoneId) });
    if (zoneSectionId) and.push({ zone_section_id: String(zoneSectionId) });
    if (status) and.push({ status: String(status) });
    if (q) {
      const term = String(q).trim();
      if (term) {
        and.push({
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { internal_code: { contains: term, mode: 'insensitive' } },
            { brand: { contains: term, mode: 'insensitive' } },
            { model: { contains: term, mode: 'insensitive' } },
          ],
        });
      }
    }
    const where = and.length ? { AND: and } : {};
    const wantsPage = page != null || limit != null;

    if (wantsPage) {
      const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
      const [total, assets] = await Promise.all([
        prisma.asset.count({ where }),
        prisma.asset.findMany({
          where,
          include: assetInclude,
          orderBy: { created_at: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({
        data: assets,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      });
      return;
    }

    const assets = await prisma.asset.findMany({
      where,
      include: assetInclude,
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
      include: assetInclude,
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

const MAX_CODE_RETRIES = 5;

export const createAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      zone_id,
      vendor_id,
      price,
      name,
      brand,
      model,
      serial_number,
      description,
      status,
      section,
      zone_section_id,
      asset_kind,
    } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'El nombre del equipo es obligatorio' });
      return;
    }

    if (!zone_id) {
      res.status(400).json({ error: 'La zona (zone_id) es obligatoria' });
      return;
    }

    const kind = normalizeAssetKind(asset_kind);
    if (kind === undefined || kind === null) {
      res.status(400).json({ error: 'Debes indicar si es Activo fijo o Controlable' });
      return;
    }

    const zone = await loadZoneForSection(zone_id);
    if (!zone) {
      res.status(400).json({ error: 'La zona indicada no existe' });
      return;
    }

    const sectionResult = resolveAssetZoneSection({
      zone,
      zoneSectionIdInput: zone_section_id,
      sectionInput: section,
    });
    if ('error' in sectionResult) {
      res.status(400).json({ error: sectionResult.error });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const image_url = files?.['image']
      ? `/uploads/assets/${files['image'][0].filename}`
      : undefined;
    const document_url = files?.['document']
      ? `/uploads/assets/${files['document'][0].filename}`
      : undefined;

    let newAsset = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      try {
        newAsset = await prisma.$transaction(
          async (tx) => {
            const internal_code = await generateAssetInternalCode({
              name: String(name),
              zoneId: zone_id,
              section: sectionResult.section,
              assetKind: kind,
              tx,
            });

            const assetData: Prisma.AssetCreateInput = {
              internal_code,
              name: String(name).trim(),
              brand,
              model,
              serial_number: serial_number || null,
              description: description || null,
              status,
              price: price ? parseFloat(price) : null,
              section: sectionResult.section,
              asset_kind: kind,
              zone: { connect: { id: zone_id } },
            };

            if (sectionResult.zone_section_id) {
              assetData.zone_section = { connect: { id: sectionResult.zone_section_id } };
            }
            if (vendor_id) {
              assetData.vendor = { connect: { id: vendor_id } };
            }
            if (image_url) assetData.image_url = image_url;
            if (document_url) assetData.document_url = document_url;

            return tx.asset.create({
              data: assetData,
              include: assetInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        break;
      } catch (err: any) {
        lastError = err;
        if (err?.code === 'P2002') continue;
        throw err;
      }
    }

    if (!newAsset) {
      console.error('Create Asset Error (code collision):', lastError);
      res.status(400).json({ error: 'El código interno ya existe; reintenta' });
      return;
    }

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
    const {
      zone_id,
      vendor_id,
      price,
      name,
      brand,
      model,
      serial_number,
      description,
      status,
      section,
      zone_section_id,
      asset_kind,
    } = req.body;

    const existing = await prisma.asset.findUnique({
      where: { id },
      include: { zone: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Activo no encontrado' });
      return;
    }

    let nextZoneId = existing.zone_id;
    if (zone_id) {
      const zoneCheck = await prisma.zone.findUnique({ where: { id: zone_id } });
      if (!zoneCheck) {
        res.status(400).json({ error: 'La zona indicada no existe' });
        return;
      }
      nextZoneId = zoneCheck.id;
    }

    if (!nextZoneId) {
      res.status(400).json({ error: 'La zona (zone_id) es obligatoria' });
      return;
    }

    const zone = await loadZoneForSection(nextZoneId);
    if (!zone) {
      res.status(400).json({ error: 'La zona indicada no existe' });
      return;
    }

    const sectionResult = resolveAssetZoneSection({
      zone,
      zoneSectionIdInput: zone_section_id,
      sectionInput: section,
      existingZoneSectionId: existing.zone_section_id,
      existingSection: existing.section,
      isUpdate: true,
    });
    if ('error' in sectionResult) {
      res.status(400).json({ error: sectionResult.error });
      return;
    }

    let nextKind: AssetKind = existing.asset_kind;
    if (asset_kind !== undefined) {
      const kind = normalizeAssetKind(asset_kind);
      if (kind === null || kind === undefined) {
        res.status(400).json({ error: 'Debes indicar si es Activo fijo o Controlable' });
        return;
      }
      nextKind = kind;
    }

    const nextName = name !== undefined ? String(name).trim() : existing.name;
    if (!nextName) {
      res.status(400).json({ error: 'El nombre del equipo es obligatorio' });
      return;
    }

    const nameChanged =
      normalizeEquipmentName(nextName) !== normalizeEquipmentName(existing.name);
    const zoneChanged = nextZoneId !== existing.zone_id;
    const sectionChanged =
      sectionResult.section !== existing.section ||
      sectionResult.zone_section_id !== existing.zone_section_id;
    const kindChanged = nextKind !== existing.asset_kind;
    const shouldRegenerateCode =
      nameChanged || zoneChanged || sectionChanged || kindChanged;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    let updatedAsset = null;
    let lastError: unknown = null;
    const attempts = shouldRegenerateCode ? MAX_CODE_RETRIES : 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        updatedAsset = await prisma.$transaction(
          async (tx) => {
            const assetData: Prisma.AssetUpdateInput = {
              section: sectionResult.section,
              asset_kind: nextKind,
              name: nextName,
              zone_section: sectionResult.zone_section_id
                ? { connect: { id: sectionResult.zone_section_id } }
                : { disconnect: true },
            };
            if (brand) assetData.brand = brand;
            if (model) assetData.model = model;
            if (serial_number !== undefined) assetData.serial_number = serial_number || null;
            if (description !== undefined) assetData.description = description || null;
            if (status) assetData.status = status;
            if (price !== undefined) assetData.price = price ? parseFloat(price) : null;
            if (zone_id) assetData.zone = { connect: { id: zone_id } };
            if (vendor_id !== undefined) {
              assetData.vendor = vendor_id
                ? { connect: { id: vendor_id } }
                : { disconnect: true };
            }
            if (files?.['image']) {
              assetData.image_url = `/uploads/assets/${files['image'][0].filename}`;
            }
            if (files?.['document']) {
              assetData.document_url = `/uploads/assets/${files['document'][0].filename}`;
            }

            if (shouldRegenerateCode) {
              assetData.internal_code = await generateAssetInternalCode({
                name: nextName,
                zoneId: nextZoneId!,
                section: sectionResult.section,
                assetKind: nextKind,
                excludeAssetId: id,
                previousCode: existing.internal_code,
                previousName: existing.name,
                previousZoneId: existing.zone_id,
                tx,
              });
            }

            return tx.asset.update({
              where: { id },
              data: assetData,
              include: assetInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        break;
      } catch (err: any) {
        lastError = err;
        if (shouldRegenerateCode && err?.code === 'P2002') continue;
        throw err;
      }
    }

    if (!updatedAsset) {
      console.error('Update Asset Error (code collision):', lastError);
      res.status(400).json({ error: 'El código interno ya existe; reintenta' });
      return;
    }

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
