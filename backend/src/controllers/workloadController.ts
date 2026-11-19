import type { Request, Response } from 'express';
import prisma from '../config/prisma';
import { dominantPatternType, loadRosterSnapshot, rosterDayFor } from '../utils/rosterSchedule';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] as const;

const toDayKey = (date: Date): string => date.toISOString().slice(0, 10);
const startOfToday = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * GET /api/workload?days=14&zoneIds=...
 *
 * Carga por técnico y por día: órdenes abiertas, vencidas, programadas y
 * capacidad del horario (roster). Sirve para decidir a quién asignar sin
 * sobrecargar a nadie.
 */
export const getWorkload = async (req: Request, res: Response): Promise<void> => {
  try {
    const daysParam = Number(req.query.days ?? 14);
    const days = Math.min(42, Math.max(7, Number.isFinite(daysParam) ? Math.round(daysParam) : 14));

    const from = startOfToday();
    const to = new Date(from.getTime() + (days - 1) * DAY_MS);
    const toEnd = new Date(to.getTime() + DAY_MS - 1);

    const zoneIdsRaw = String(req.query.zoneIds ?? '').trim();
    const zoneIds = zoneIdsRaw
      ? [...new Set(zoneIdsRaw.split(',').map((id) => id.trim()).filter(Boolean))]
      : [];

    const settings = await prisma.systemSettings.findFirst({
      select: { performance_config: true },
    });
    const config = (settings?.performance_config ?? {}) as {
      hours_by_code?: Record<string, number>;
      shift_end_by_code?: Record<string, string>;
    };
    const hoursByCode = config.hours_by_code ?? {
      D: 12,
      N: 12,
      M: 9,
      M_SAT: 5,
      D_TE: 12,
      N_TE: 12,
      TE: 8,
      TXT: 8,
      CURSO: 8,
      PSG: 0,
      V: 0,
      I: 0,
      F: 0,
      X: 0,
    };
    const shiftEndByCode = config.shift_end_by_code ?? {};

    const technicians = await prisma.user.findMany({
      where: { is_active: true, role: { in: ['TECNICO', 'GESTIONADOR'] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });

    const workOrders = await prisma.workOrder.findMany({
      where: {
        status: { in: [...OPEN_STATUSES] },
        ...(zoneIds.length > 0 ? { zone_id: { in: zoneIds } } : {}),
      },
      select: {
        id: true,
        title: true,
        folio: true,
        status: true,
        priority: true,
        scheduled_date: true,
        due_date: true,
        assigned_technicians: { select: { id: true } },
      },
    });

    const roster = await loadRosterSnapshot(prisma as never, from, toEnd);

    const today = from.getTime();

    const rows = technicians.map((tech) => {
      const mine = workOrders.filter((wo) => wo.assigned_technicians.some((t) => t.id === tech.id));

      const perDay = new Map<string, number>();
      for (let i = 0; i < days; i += 1) {
        perDay.set(toDayKey(new Date(from.getTime() + i * DAY_MS)), 0);
      }

      let overdue = 0;
      let dueThisPeriod = 0;
      for (const wo of mine) {
        if (wo.due_date) {
          const dueDay = toDayKey(wo.due_date);
          if (wo.due_date.getTime() < today) overdue += 1;
          if (perDay.has(dueDay)) {
            perDay.set(dueDay, (perDay.get(dueDay) ?? 0) + 1);
            dueThisPeriod += 1;
          }
        }
        if (wo.scheduled_date) {
          const scheduledDay = toDayKey(wo.scheduled_date);
          if (perDay.has(scheduledDay)) {
            perDay.set(scheduledDay, (perDay.get(scheduledDay) ?? 0) + 1);
          }
        }
      }

      let scheduledHours = 0;
      for (let i = 0; i < days; i += 1) {
        const day = toDayKey(new Date(from.getTime() + i * DAY_MS));
        const rosterDay = rosterDayFor(roster, tech.id, day, { hoursByCode, shiftEndByCode });
        scheduledHours += rosterDay.hours;
      }

      const patternType = dominantPatternType(roster, tech.id, from, toEnd);

      return {
        user_id: tech.id,
        name: tech.name,
        role: tech.role,
        shift_code: patternType,
        open_wos: mine.length,
        in_progress: mine.filter((wo) => wo.status === 'EN_PROCESO').length,
        overdue,
        due_this_period: dueThisPeriod,
        urgent: mine.filter((wo) => wo.priority === 'URGENTE').length,
        scheduled_hours: Math.round(scheduledHours * 10) / 10,
        per_day: [...perDay.entries()].map(([date, count]) => ({ date, count })),
        title_samples: mine.slice(0, 5).map((wo) => ({ id: wo.id, folio: wo.folio, title: wo.title, priority: wo.priority })),
      };
    });

    const activeRows = rows.filter((row) => row.scheduled_hours > 0 || row.open_wos > 0);
    const avgOpen = activeRows.length
      ? activeRows.reduce((sum, row) => sum + row.open_wos, 0) / activeRows.length
      : 0;

    const enriched = rows.map((row) => {
      const relative = avgOpen > 0 ? Math.round((row.open_wos / avgOpen) * 100) : 0;
      return {
        ...row,
        load_pct: relative,
        load_level: relative >= 150 ? 'alta' : relative >= 75 ? 'media' : 'baja',
      };
    });

    const suggestion = [...enriched]
      .filter((row) => row.scheduled_hours > 0 || row.open_wos > 0)
      .sort((a, b) => a.open_wos - b.open_wos || a.overdue - b.overdue)[0] ?? null;

    res.json({
      from: from.toISOString(),
      to: toEnd.toISOString(),
      days,
      zone_ids: zoneIds,
      rows: enriched,
      totals: {
        open_wos: workOrders.length,
        unassigned: workOrders.filter((wo) => wo.assigned_technicians.length === 0).length,
        overdue: enriched.reduce((sum, row) => sum + row.overdue, 0),
        technicians: technicians.length,
        avg_open: Math.round(avgOpen * 10) / 10,
      },
      suggestion: suggestion
        ? {
            user_id: suggestion.user_id,
            name: suggestion.name,
            open_wos: suggestion.open_wos,
            reason: `Menor carga del equipo (${suggestion.open_wos} OT abiertas vs. promedio ${Math.round(avgOpen * 10) / 10})`,
          }
        : null,
    });
  } catch (error) {
    console.error('[workload] getWorkload', error);
    res.status(500).json({ error: 'No se pudo calcular la carga de trabajo' });
  }
};
