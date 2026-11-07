import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { writeAuditLog } from '../utils/auditLog';
import type { AuthRequest } from '../middlewares/authMiddleware';

/**
 * Mantenimiento por uso: medidores (horómetro, odómetro, ciclos…), sus lecturas
 * y los disparadores que generan una OT al alcanzar un umbral.
 */

const UNITS = ['HORAS', 'KILOMETROS', 'CICLOS', 'PIEZAS', 'OTRO'];
const CONDITIONS = ['GTE', 'LTE'];

const asNumber = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const cleanText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 300) : null;
};

const unitLabel = (unit: string) => (unit === 'OTRO' || !UNITS.includes(unit) ? '' : unit.toLowerCase());

/** Datos completos de un medidor: disparadores y última lectura. */
const meterInclude = {
  triggers: { orderBy: { created_at: 'asc' as const } },
  readings: { orderBy: { reading_at: 'desc' as const }, take: 1 },
};

const serializeMeter = (meter: any) => {
  const lastReading = meter.readings?.[0] ?? null;
  return {
    ...meter,
    readings: undefined,
    last_reading_at: lastReading?.reading_at ?? meter.current_reading_at ?? null,
    last_reading_value: lastReading?.value ?? meter.current_value ?? null,
  };
};

/** GET /api/meters?assetId=...  Lista medidores (de un activo o de toda la planta). */
export const getMeters = async (req: Request, res: Response): Promise<void> => {
  try {
    const assetId = typeof req.query.assetId === 'string' ? req.query.assetId : undefined;
    const meters = await prisma.meter.findMany({
      where: assetId ? { asset_id: assetId } : undefined,
      include: {
        ...meterInclude,
        asset: { select: { id: true, name: true, internal_code: true } },
      },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });
    res.json(meters.map(serializeMeter));
  } catch (error: any) {
    console.error('Error listando medidores:', error);
    res.status(500).json({ message: 'No se pudieron obtener los medidores.' });
  }
};

/** POST /api/meters */
export const createMeter = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const assetId = String(req.body?.asset_id || '').trim();
    const name = cleanText(req.body?.name);
    const unitRaw = String(req.body?.unit || 'HORAS').toUpperCase();
    const unit = UNITS.includes(unitRaw) ? unitRaw : 'OTRO';
    const initialValue = asNumber(req.body?.initial_value);
    const notes = cleanText(req.body?.notes);

    if (!assetId || !name) {
      res.status(400).json({ message: 'El activo y el nombre del medidor son obligatorios.' });
      return;
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } });
    if (!asset) {
      res.status(404).json({ message: 'El activo indicado no existe.' });
      return;
    }

    const meter = await prisma.meter.create({
      data: {
        asset_id: assetId,
        name,
        unit,
        notes,
        current_value: initialValue ?? 0,
        current_reading_at: initialValue != null ? new Date() : null,
      },
      include: meterInclude,
    });

    if (initialValue != null) {
      await prisma.meterReading.create({
        data: {
          meter_id: meter.id,
          value: initialValue,
          notes: 'Lectura inicial',
          created_by_id: authReq.user?.userId ?? null,
        },
      });
    }

    await writeAuditLog({
      userId: authReq.user?.userId ?? null,
      action: 'CREATE',
      entity: 'Meter',
      entityId: meter.id,
      summary: `Medidor «${name}» creado para el activo ${assetId}`,
    });

    res.status(201).json(serializeMeter(meter));
  } catch (error: any) {
    console.error('Error creando medidor:', error);
    res.status(500).json({ message: 'No se pudo crear el medidor.' });
  }
};

/** PATCH /api/meters/:id */
export const updateMeter = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const id = req.params.id as string;
    const name = cleanText(req.body?.name);
    const unitRaw = req.body?.unit != null ? String(req.body.unit).toUpperCase() : null;
    const notes = req.body?.notes != null ? cleanText(req.body.notes) : undefined;
    const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : undefined;

    if (unitRaw != null && !UNITS.includes(unitRaw)) {
      res.status(400).json({ message: 'Unidad no válida.' });
      return;
    }

    const meter = await prisma.meter.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(unitRaw ? { unit: unitRaw } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(isActive !== undefined ? { is_active: isActive } : {}),
      },
      include: meterInclude,
    });

    await writeAuditLog({
      userId: authReq.user?.userId ?? null,
      action: 'UPDATE',
      entity: 'Meter',
      entityId: id,
      summary: `Medidor «${meter.name}» actualizado`,
    });

    res.json(serializeMeter(meter));
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ message: 'Medidor no encontrado.' });
      return;
    }
    console.error('Error actualizando medidor:', error);
    res.status(500).json({ message: 'No se pudo actualizar el medidor.' });
  }
};

/** DELETE /api/meters/:id */
export const deleteMeter = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const id = req.params.id as string;
    const meter = await prisma.meter.findUnique({ where: { id }, select: { name: true } });
    if (!meter) {
      res.status(404).json({ message: 'Medidor no encontrado.' });
      return;
    }
    await prisma.meter.delete({ where: { id } });
    await writeAuditLog({
      userId: authReq.user?.userId ?? null,
      action: 'DELETE',
      entity: 'Meter',
      entityId: id,
      summary: `Medidor «${meter.name}» eliminado`,
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando medidor:', error);
    res.status(500).json({ message: 'No se pudo eliminar el medidor.' });
  }
};

/** GET /api/meters/:id/readings?limit=50 */
export const getMeterReadings = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 50;
    const readings = await prisma.meterReading.findMany({
      where: { meter_id: id },
      orderBy: { reading_at: 'desc' },
      take: limit,
      include: { created_by: { select: { id: true, name: true } } },
    });
    res.json(readings);
  } catch (error: any) {
    console.error('Error listando lecturas:', error);
    res.status(500).json({ message: 'No se pudieron obtener las lecturas.' });
  }
};

/** Crea la OT asociada a un disparador. */
async function createWorkOrderForTrigger(
  meter: { id: string; name: string; unit: string; asset_id: string },
  trigger: { id: string; name: string },
  readingValue: number,
  userId: string | null
): Promise<string> {
  const asset = await prisma.asset.findUnique({
    where: { id: meter.asset_id },
    select: { id: true, name: true, zone_id: true },
  });

  let creatorId = userId;
  if (!creatorId) {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMINISTRADOR', is_active: true },
      select: { id: true },
      orderBy: { created_at: 'asc' },
    });
    creatorId = admin?.id ?? null;
  }
  if (!creatorId) throw new Error('No hay usuario disponible para registrar la OT automática.');

  const formatted = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(readingValue);
  const workOrder = await prisma.workOrder.create({
    data: {
      title: trigger.name,
      description:
        `Generada automáticamente por el medidor «${meter.name}» ` +
        `al registrar ${formatted}${unitLabel(meter.unit) ? ` ${unitLabel(meter.unit)}` : ''} ` +
        `en el equipo ${asset?.name ?? ''}.`.trim(),
      asset_id: meter.asset_id,
      zone_id: asset?.zone_id ?? null,
      priority: 'NORMAL',
      maintenance_type: 'PREVENTIVO',
      status: 'PENDIENTE',
      created_by_id: creatorId,
    },
    select: { id: true },
  });

  emitRefresh('refresh_work_orders');
  return workOrder.id;
}

/**
 * POST /api/meters/:id/readings
 * Registra la lectura, actualiza el valor actual y evalúa los disparadores.
 */
export const addMeterReading = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const id = req.params.id as string;
    const value = asNumber(req.body?.value);
    const notes = cleanText(req.body?.notes);
    const readingAtRaw = req.body?.reading_at ? new Date(String(req.body.reading_at)) : new Date();
    const readingAt = Number.isFinite(readingAtRaw.getTime()) ? readingAtRaw : new Date();

    if (value == null || value < 0) {
      res.status(400).json({ message: 'La lectura debe ser un número mayor o igual a cero.' });
      return;
    }

    const meter = await prisma.meter.findUnique({
      where: { id },
      include: { triggers: { where: { is_active: true } } },
    });
    if (!meter) {
      res.status(404).json({ message: 'Medidor no encontrado.' });
      return;
    }

    const reading = await prisma.meterReading.create({
      data: {
        meter_id: id,
        value,
        reading_at: readingAt,
        notes,
        created_by_id: authReq.user?.userId ?? null,
      },
      include: { created_by: { select: { id: true, name: true } } },
    });

    // La lectura más reciente manda: si se registra una lectura con fecha anterior,
    // no se regresa el valor actual.
    const latest = await prisma.meterReading.findFirst({
      where: { meter_id: id },
      orderBy: [{ reading_at: 'desc' }, { created_at: 'desc' }],
      select: { value: true, reading_at: true },
    });

    await prisma.meter.update({
      where: { id },
      data: {
        current_value: latest?.value ?? value,
        current_reading_at: latest?.reading_at ?? readingAt,
      },
    });

    const firedWorkOrders: { trigger_id: string; trigger_name: string; work_order_id: string }[] = [];
    for (const trigger of meter.triggers) {
      const reached =
        trigger.condition === 'LTE' ? value <= trigger.threshold : value >= trigger.threshold;
      if (!reached) continue;

      const workOrderId = await createWorkOrderForTrigger(meter, trigger, value, authReq.user?.userId ?? null);

      if (trigger.interval != null && trigger.interval > 0) {
        await prisma.meterTrigger.update({
          where: { id: trigger.id },
          data: {
            threshold: value + trigger.interval,
            last_fired_at: new Date(),
            last_fired_value: value,
          },
        });
      } else {
        await prisma.meterTrigger.update({
          where: { id: trigger.id },
          data: { is_active: false, last_fired_at: new Date(), last_fired_value: value },
        });
      }

      firedWorkOrders.push({
        trigger_id: trigger.id,
        trigger_name: trigger.name,
        work_order_id: workOrderId,
      });
    }

    await writeAuditLog({
      userId: authReq.user?.userId ?? null,
      action: 'READING',
      entity: 'Meter',
      entityId: id,
      summary:
        `Lectura ${value} en «${meter.name}»` +
        (firedWorkOrders.length ? ` · ${firedWorkOrders.length} OT generada(s)` : ''),
      meta: { value, firedWorkOrders },
    });

    const refreshed = await prisma.meter.findUnique({ where: { id }, include: meterInclude });

    res.status(201).json({
      reading,
      meter: refreshed ? serializeMeter(refreshed) : null,
      fired_work_orders: firedWorkOrders,
    });
  } catch (error: any) {
    console.error('Error registrando lectura:', error);
    res.status(500).json({ message: 'No se pudo registrar la lectura.' });
  }
};

/** DELETE /api/meters/:id/readings/:readingId — corrige capturas erróneas. */
export const deleteMeterReading = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const readingId = req.params.readingId as string;
    const reading = await prisma.meterReading.findFirst({
      where: { id: readingId, meter_id: id },
      select: { id: true, value: true },
    });
    if (!reading) {
      res.status(404).json({ message: 'Lectura no encontrada.' });
      return;
    }

    await prisma.meterReading.delete({ where: { id: readingId } });

    const latest = await prisma.meterReading.findFirst({
      where: { meter_id: id },
      orderBy: [{ reading_at: 'desc' }, { created_at: 'desc' }],
      select: { value: true, reading_at: true },
    });
    await prisma.meter.update({
      where: { id },
      data: {
        current_value: latest?.value ?? 0,
        current_reading_at: latest?.reading_at ?? null,
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando lectura:', error);
    res.status(500).json({ message: 'No se pudo eliminar la lectura.' });
  }
};

/** POST /api/meters/:id/triggers */
export const createMeterTrigger = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const name = cleanText(req.body?.name);
    const conditionRaw = String(req.body?.condition || 'GTE').toUpperCase();
    const condition = CONDITIONS.includes(conditionRaw) ? conditionRaw : 'GTE';
    const threshold = asNumber(req.body?.threshold);
    const interval = req.body?.interval == null ? null : asNumber(req.body?.interval);

    if (!name || threshold == null) {
      res.status(400).json({ message: 'El nombre y el umbral son obligatorios.' });
      return;
    }
    if (interval != null && interval <= 0) {
      res.status(400).json({ message: 'El intervalo debe ser mayor que cero.' });
      return;
    }

    const meter = await prisma.meter.findUnique({ where: { id }, select: { id: true } });
    if (!meter) {
      res.status(404).json({ message: 'Medidor no encontrado.' });
      return;
    }

    const trigger = await prisma.meterTrigger.create({
      data: { meter_id: id, name, condition: condition as 'GTE' | 'LTE', threshold, interval },
    });
    res.status(201).json(trigger);
  } catch (error: any) {
    console.error('Error creando disparador:', error);
    res.status(500).json({ message: 'No se pudo crear el disparador.' });
  }
};

/** PATCH /api/meters/:id/triggers/:triggerId */
export const updateMeterTrigger = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const triggerId = req.params.triggerId as string;
    const name = req.body?.name != null ? cleanText(req.body.name) : undefined;
    const conditionRaw = req.body?.condition != null ? String(req.body.condition).toUpperCase() : null;
    const threshold = req.body?.threshold != null ? asNumber(req.body.threshold) : undefined;
    const interval = req.body?.interval === null ? null : req.body?.interval != null ? asNumber(req.body.interval) : undefined;
    const isActive = typeof req.body?.is_active === 'boolean' ? req.body.is_active : undefined;

    if (conditionRaw != null && !CONDITIONS.includes(conditionRaw)) {
      res.status(400).json({ message: 'Condición no válida.' });
      return;
    }
    if (threshold === null || (interval != null && interval <= 0)) {
      res.status(400).json({ message: 'Umbral o intervalo no válidos.' });
      return;
    }

    const existing = await prisma.meterTrigger.findFirst({ where: { id: triggerId, meter_id: id } });
    if (!existing) {
      res.status(404).json({ message: 'Disparador no encontrado.' });
      return;
    }

    const trigger = await prisma.meterTrigger.update({
      where: { id: triggerId },
      data: {
        ...(name ? { name } : {}),
        ...(conditionRaw ? { condition: conditionRaw as 'GTE' | 'LTE' } : {}),
        ...(threshold != null ? { threshold } : {}),
        ...(req.body?.interval !== undefined ? { interval } : {}),
        ...(isActive !== undefined ? { is_active: isActive } : {}),
      },
    });
    res.json(trigger);
  } catch (error: any) {
    console.error('Error actualizando disparador:', error);
    res.status(500).json({ message: 'No se pudo actualizar el disparador.' });
  }
};

/** DELETE /api/meters/:id/triggers/:triggerId */
export const deleteMeterTrigger = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const triggerId = req.params.triggerId as string;
    const existing = await prisma.meterTrigger.findFirst({ where: { id: triggerId, meter_id: id } });
    if (!existing) {
      res.status(404).json({ message: 'Disparador no encontrado.' });
      return;
    }
    await prisma.meterTrigger.delete({ where: { id: triggerId } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando disparador:', error);
    res.status(500).json({ message: 'No se pudo eliminar el disparador.' });
  }
};
