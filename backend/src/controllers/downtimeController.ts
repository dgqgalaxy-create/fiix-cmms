import { Request, Response } from 'express';
import prisma from '../config/prisma';

const include = {
  reported_by: { select: { id: true, name: true } },
  work_order: { select: { id: true, folio: true, title: true } },
  asset: { select: { id: true, name: true, internal_code: true } },
} as const;

/**
 * GET /api/downtimes?assetId=&from=&to=&open=1
 * Paros registrados, opcionalmente filtrados por activo y rango de fechas.
 */
export const getDowntimes = async (req: Request, res: Response): Promise<void> => {
  try {
    const assetId = typeof req.query.assetId === 'string' && req.query.assetId ? req.query.assetId : undefined;
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : undefined;
    const onlyOpen = req.query.open === '1' || req.query.open === 'true';

    const rows = await prisma.assetDowntime.findMany({
      where: {
        ...(assetId ? { asset_id: assetId } : {}),
        ...(from || to
          ? { started_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
          : {}),
        ...(onlyOpen ? { ended_at: null } : {}),
      },
      include,
      orderBy: { started_at: 'desc' },
      take: 500,
    });

    res.json(rows);
  } catch (error) {
    console.error('Error listando paros:', error);
    res.status(500).json({ error: 'No se pudieron obtener los paros' });
  }
};

/** POST /api/downtimes — abre un paro (por defecto empieza ahora). */
export const createDowntime = async (req: Request, res: Response): Promise<void> => {
  try {
    const { asset_id, work_order_id, reason, started_at } = req.body ?? {};
    if (!asset_id) {
      res.status(400).json({ error: 'Indica el activo.' });
      return;
    }
    const asset = await prisma.asset.findUnique({ where: { id: asset_id }, select: { id: true } });
    if (!asset) {
      res.status(404).json({ error: 'Activo no encontrado' });
      return;
    }

    const started = started_at ? new Date(started_at) : new Date();
    if (Number.isNaN(started.getTime())) {
      res.status(400).json({ error: 'La fecha de inicio no es válida.' });
      return;
    }

    const created = await prisma.assetDowntime.create({
      data: {
        asset_id,
        work_order_id: work_order_id || null,
        reason: typeof reason === 'string' ? reason.trim().slice(0, 200) || null : null,
        started_at: started,
        reported_by_id: (req as any).user?.userId ?? null,
      },
      include,
    });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando paro:', error);
    res.status(500).json({ error: 'No se pudo registrar el paro' });
  }
};

/** PATCH /api/downtimes/:id/close — cierra el paro (por defecto ahora). */
export const closeDowntime = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.assetDowntime.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Paro no encontrado' });
      return;
    }

    const ended = req.body?.ended_at ? new Date(req.body.ended_at) : new Date();
    if (Number.isNaN(ended.getTime())) {
      res.status(400).json({ error: 'La fecha de fin no es válida.' });
      return;
    }
    if (ended.getTime() < existing.started_at.getTime()) {
      res.status(400).json({ error: 'El fin no puede ser anterior al inicio.' });
      return;
    }

    const updated = await prisma.assetDowntime.update({
      where: { id },
      data: {
        ended_at: ended,
        ...(typeof req.body?.reason === 'string'
          ? { reason: req.body.reason.trim().slice(0, 200) || null }
          : {}),
      },
      include,
    });
    res.json(updated);
  } catch (error) {
    console.error('Error cerrando paro:', error);
    res.status(500).json({ error: 'No se pudo cerrar el paro' });
  }
};

/** PATCH /api/downtimes/:id — edición (motivo, fechas u OT). */
export const updateDowntime = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.assetDowntime.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Paro no encontrado' });
      return;
    }
    const { reason, started_at, ended_at, work_order_id } = req.body ?? {};
    const start = started_at ? new Date(started_at) : existing.started_at;
    const end = ended_at ? new Date(ended_at) : existing.ended_at;
    if (end && end.getTime() < start.getTime()) {
      res.status(400).json({ error: 'El fin no puede ser anterior al inicio.' });
      return;
    }

    const updated = await prisma.assetDowntime.update({
      where: { id },
      data: {
        ...(typeof reason === 'string' ? { reason: reason.trim().slice(0, 200) || null } : {}),
        ...(started_at ? { started_at: start } : {}),
        ...(ended_at !== undefined ? { ended_at: end } : {}),
        ...(work_order_id !== undefined ? { work_order_id: work_order_id || null } : {}),
      },
      include,
    });
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando paro:', error);
    res.status(500).json({ error: 'No se pudo actualizar el paro' });
  }
};

/** DELETE /api/downtimes/:id */
export const deleteDowntime = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.assetDowntime.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando paro:', error);
    res.status(500).json({ error: 'No se pudo eliminar el paro' });
  }
};

/**
 * GET /api/downtimes/stats?assetId=&from=&to=
 * MTBF, MTTR y disponibilidad del periodo. El tiempo de paro abierto se corta
 * en «ahora» para no subestimar el impacto.
 */
export const getDowntimeStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const assetId = typeof req.query.assetId === 'string' && req.query.assetId ? req.query.assetId : undefined;
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : new Date();
    const from = typeof req.query.from === 'string' && req.query.from
      ? new Date(req.query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const where = {
      ...(assetId ? { asset_id: assetId } : {}),
      started_at: { gte: from, lte: to },
    };

    const [stops, count] = await Promise.all([
      prisma.assetDowntime.findMany({ where, select: { started_at: true, ended_at: true } }),
      prisma.assetDowntime.count({ where }),
    ]);

    const now = new Date();
    const totalDowntimeMs = stops.reduce((sum, stop) => {
      const end = stop.ended_at ?? now;
      return sum + Math.max(0, end.getTime() - stop.started_at.getTime());
    }, 0);

    const periodMs = Math.max(0, to.getTime() - from.getTime());
    const uptimeMs = Math.max(0, periodMs - totalDowntimeMs);

    // MTBF = tiempo operativo / número de paros; MTTR = tiempo parado / número de paros.
    const mtbfHours = count > 0 ? uptimeMs / count / (60 * 60 * 1000) : null;
    const mttrMinutes = count > 0 ? totalDowntimeMs / count / (60 * 1000) : null;
    const availabilityPct = periodMs > 0 ? (uptimeMs / periodMs) * 100 : null;
    const openStops = stops.filter((stop) => !stop.ended_at).length;

    res.json({
      from: from.toISOString(),
      to: to.toISOString(),
      stops: count,
      open_stops: openStops,
      downtime_hours: totalDowntimeMs / (60 * 60 * 1000),
      mtbf_hours: mtbfHours,
      mttr_minutes: mttrMinutes,
      availability_pct: availabilityPct,
    });
  } catch (error) {
    console.error('Error calculando indicadores de paros:', error);
    res.status(500).json({ error: 'No se pudieron calcular los indicadores' });
  }
};
