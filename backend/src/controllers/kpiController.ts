import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { resolvePartsUnitCost } from '../utils/resolvePartsUnitCost';
import {
  plantDateParts,
  plantWallClockToDate,
  plantAddDays,
  plantUtcWeekday,
  plantStartOfMonth,
  plantShiftMonthStart,
  plantEndOfMonth,
} from '../utils/plantTimezone';
import { PRODUCTION_LINES, resolveProductionLine } from '../utils/assetSection';

const MS_PER_HOUR = 3_600_000;
const DEFAULT_REWORK_WINDOW_DAYS = 2;
const MIN_REWORK_WINDOW_DAYS = 1;
const MAX_REWORK_WINDOW_DAYS = 90;

const parseReworkWindowDays = (raw: unknown): number => {
  const parsed = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_REWORK_WINDOW_DAYS;
  return Math.min(MAX_REWORK_WINDOW_DAYS, Math.max(MIN_REWORK_WINDOW_DAYS, Math.round(parsed)));
};

// Horas productivas al día que asume el MTBF (fijas en 24).
const HOURS_PER_DAY = 24;

// MTBF se delimita por la zona del equipo, no por la zona capturada en la OT.
// Vacío/null conserva el significado del selector: todas las zonas.
const mtbfZoneIds = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];

/** Zona efectiva de una OT: la de la propia OT y, si no tiene, la de su equipo. */
const orderZoneId = (
  order: { zone_id?: string | null; asset?: { zone_id?: string | null } | null },
): string | null => order.zone_id ?? order.asset?.zone_id ?? null;

const isMtbfOrderInScope = (
  order: { zone_id?: string | null; asset?: { zone_id: string | null } | null },
  zoneIds: string[],
): boolean => {
  if (zoneIds.length === 0) return !!order.asset; // sin selección: todas (con equipo)
  const zoneId = orderZoneId(order);
  return zoneId !== null && zoneIds.includes(zoneId);
};

// MTBF usa el NÚMERO DE ZONAS del alcance («Zonas de respuesta»), no de equipos.
// Sin selección: todas las zonas.
const countMtbfZones = async (zoneIds: string[]): Promise<number> =>
  zoneIds.length > 0 ? zoneIds.length : prisma.zone.count();

const DEFAULT_GOALS: Record<string, { targetValue: number; unit: string }> = {
  COMPLETED_MONTHLY: { targetValue: 80, unit: '%' },
  MTTR: { targetValue: 4, unit: 'horas' },
  MTBF: { targetValue: 0, unit: 'horas' },
  RESPONSE_TIME: { targetValue: 1, unit: 'horas' },
  SLA: { targetValue: 90, unit: '%' },
  BACKLOG: { targetValue: 10, unit: 'órdenes' },
  ASSET_AVAILABILITY: { targetValue: 95, unit: '%' },
  REINCIDENCIA: { targetValue: 10, unit: '%' },
};

const clip = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type DateRangeOpts = { startDate?: unknown; endDate?: unknown };

/** YYYY-MM-DD → instante UTC de medianoche (o 23:59:59.999) del día civil de PLANTA. */
const parseYmdPlant = (raw: unknown, endOfDay: boolean): Date | null => {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const [y, m, d] = raw.trim().split('-').map(Number);
  if (!y || !m || !d) return null;
  const base = plantWallClockToDate(y, m, d);
  if (!base) return null;
  return endOfDay ? new Date(base.getTime() + 86_399_999) : base;
};

/**
 * Rango del periodo expresado en hora de planta (America/Mexico_City), independiente
 * del TZ del proceso: el mismo periodo da los mismos límites en un servidor UTC y en
 * una Mac en hora de México.
 */
const getDateRange = (
  period: string | undefined,
  opts?: DateRangeOpts,
): { start: Date; end: Date; effectiveEnd: Date } => {
  const now = new Date();
  const p = plantDateParts(now);
  const atPlantMidnight = (year: number, month: number, day: number): Date =>
    plantWallClockToDate(year, month, day) ?? now;
  const DAY_MS = 86_400_000;

  let start: Date;
  let end: Date;

  if (period === 'CUSTOM') {
    start = parseYmdPlant(opts?.startDate, false) || plantStartOfMonth(now.getTime());
    const parsedEnd = parseYmdPlant(opts?.endDate, true);
    end = parsedEnd || new Date(atPlantMidnight(p.year, p.month, p.day).getTime() + DAY_MS - 1);
    if (end < start) {
      // Terminar el mismo día civil de planta en que inicia el rango.
      const sp = plantDateParts(start);
      end = new Date(atPlantMidnight(sp.year, sp.month, sp.day).getTime() + DAY_MS - 1);
    }
  } else if (period === 'THIS_WEEK' || period === 'LAST_WEEK') {
    // Lunes de la semana en curso/anterior, en hora de planta real (00:00).
    const dayStart = atPlantMidnight(p.year, p.month, p.day).getTime();
    const weekday = plantUtcWeekday(now.getTime()); // 0 = domingo
    const backToMonday = weekday === 0 ? 6 : weekday - 1;
    const weeksBack = period === 'LAST_WEEK' ? 7 : 0;
    start = new Date(dayStart - (backToMonday + weeksBack) * DAY_MS);
    end = new Date(start.getTime() + 7 * DAY_MS - 1);
  } else if (period === 'THIS_MONTH') {
    start = plantStartOfMonth(now.getTime());
    end = plantEndOfMonth(now.getTime());
  } else if (period === 'LAST_MONTH') {
    start = plantShiftMonthStart(now.getTime(), -1);
    end = new Date(plantStartOfMonth(now.getTime()).getTime() - 1);
  } else if (period === 'THIS_YEAR') {
    start = atPlantMidnight(p.year, 1, 1);
    end = new Date(atPlantMidnight(p.year + 1, 1, 1).getTime() - 1);
  } else if (period === 'LAST_12_MONTHS') {
    start = atPlantMidnight(p.year - 1, p.month, p.day);
    end = new Date(now);
  } else if (period === 'ALL') {
    start = new Date(0);
    end = new Date(now);
  } else {
    // Default: mes en curso (hora de planta).
    start = plantStartOfMonth(now.getTime());
    end = plantEndOfMonth(now.getTime());
  }

  const effectiveEnd = end.getTime() > now.getTime() ? now : end;
  return { start, end, effectiveEnd };
};

const rangeFromReq = (req: AuthRequest) =>
  getDateRange(req.query.period as string, {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
  });

const normalizeGoal = (metricKey: string, targetValue: number, unit?: string | null) => {
  const fallback = DEFAULT_GOALS[metricKey] || { targetValue, unit: unit || '' };
  let value = targetValue;
  let resolvedUnit = unit || fallback.unit;

  // Migración: metas antiguas guardadas en milisegundos
  if ((metricKey === 'MTTR' || metricKey === 'RESPONSE_TIME') && (resolvedUnit === 'ms' || value >= 1000)) {
    value = value / MS_PER_HOUR;
    resolvedUnit = 'horas';
  }

  return { targetValue: value, unit: resolvedUnit };
};

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const getTopFailingAssets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, effectiveEnd } = rangeFromReq(req);

    const grouped = await prisma.workOrder.groupBy({
      by: ['asset_id'],
      where: {
        maintenance_type: 'CORRECTIVO',
        status: { not: 'ANULADO' },
        OR: [
          { completed_at: { gte: start, lte: effectiveEnd } },
          { completed_at: null, created_at: { gte: start, lte: effectiveEnd } },
        ],
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const assetIds = grouped.map((g) => g.asset_id).filter(Boolean);
    const assets = assetIds.length
      ? await prisma.asset.findMany({
          where: { id: { in: assetIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(assets.map((a) => [a.id, a.name]));

    res.json(
      grouped.map((g) => ({
        assetId: g.asset_id,
        assetName: nameById.get(g.asset_id) || '—',
        count: g._count.id,
      }))
    );
  } catch (error) {
    console.error('Error fetching top failing assets:', error);
    res.status(500).json({ error: 'Error al obtener equipos con más fallas' });
  }
};

export const getAssetFailureOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assetId = req.params.assetId as string;
    const { start, effectiveEnd } = rangeFromReq(req);

    // machineStopped=1 → solo paros (máquina detenida); por defecto todas las correctivas.
    const machineStoppedOnly = req.query.machineStopped === '1';

    const workOrders = await prisma.workOrder.findMany({
      where: {
        asset_id: assetId,
        maintenance_type: 'CORRECTIVO',
        ...(machineStoppedOnly ? { machine_stopped: true } : {}),
        status: { not: 'ANULADO' },
        OR: [
          { completed_at: { gte: start, lte: effectiveEnd } },
          { completed_at: null, created_at: { gte: start, lte: effectiveEnd } },
        ],
      },
      select: {
        id: true,
        folio: true,
        title: true,
        created_at: true,
        status: true,
        machine_stopped: true,
        accumulated_time_ms: true,
        zone: { select: { name: true } },
        assigned_technicians: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(workOrders);
  } catch (error) {
    console.error('Error fetching asset failure orders:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de fallas del equipo' });
  }
};

export const getKPIs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const reworkWindowDays = parseReworkWindowDays(req.query.reworkDays);
    const { start, effectiveEnd } = rangeFromReq(req);

    const dbGoals = await prisma.kPIGoal.findMany();
    const goals: Record<string, { targetValue: number; unit: string }> = { ...DEFAULT_GOALS };
    dbGoals.forEach((goal) => {
      goals[goal.metricKey] = normalizeGoal(goal.metricKey, goal.targetValue, goal.unit);
    });

    const [periodOrders, openOrders, downtimeOrders, zones, settings] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          status: { not: 'ANULADO' },
          OR: [
            { completed_at: { gte: start, lte: effectiveEnd } },
            { started_at: { gte: start, lte: effectiveEnd } },
            { created_at: { gte: start, lte: effectiveEnd } },
          ],
        },
        include: { asset: { select: { id: true, name: true, zone_id: true } } },
      }),
      prisma.workOrder.findMany({
        where: {
          status: { in: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] },
        },
        select: { id: true },
      }),
      prisma.workOrder.findMany({
        where: {
          machine_stopped: true,
          maintenance_type: 'CORRECTIVO',
          status: { not: 'ANULADO' },
          created_at: { lte: effectiveEnd },
          OR: [
            { completed_at: { gte: start } },
            { completed_at: null, status: { in: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] } },
          ],
        },
        select: {
          created_at: true,
          completed_at: true,
          asset: { select: { id: true, zone_id: true } },
        },
      }),
      prisma.zone.findMany({ select: { id: true } }),
      prisma.systemSettings.findFirst({ select: { response_time_zone_ids: true } }),
    ]);

    const completedOrders = periodOrders.filter(
      (wo) =>
        wo.status === 'FINALIZADO' &&
        wo.completed_at &&
        wo.completed_at >= start &&
        wo.completed_at <= effectiveEnd,
    );

    const correctiveCompleted = completedOrders.filter((wo) => wo.maintenance_type === 'CORRECTIVO');

    // «OT finalizadas» como porcentaje: finalizadas del periodo / generadas del periodo.
    const generatedOrders = periodOrders.filter(
      (wo) => wo.created_at >= start && wo.created_at <= effectiveEnd,
    );
    const completionRate = generatedOrders.length > 0
      ? (completedOrders.length / generatedOrders.length) * 100
      : null;

    const selectedMtbfZones = mtbfZoneIds(settings?.response_time_zone_ids);
    const mtbfZoneCount = await countMtbfZones(selectedMtbfZones);
    const mtbfOrders = periodOrders.filter(wo => isMtbfOrderInScope(wo, selectedMtbfZones));
    // Denominador MTBF = correctivas LEVANTADAS (creadas) en el periodo, excluidas anuladas.
    const correctiveCreated = periodOrders.filter(
      (wo) => wo.maintenance_type === 'CORRECTIVO' && wo.created_at >= start && wo.created_at <= effectiveEnd,
    );
    const mtbfFailures = correctiveCreated.filter(wo => isMtbfOrderInScope(wo, selectedMtbfZones));

    // Histórico empieza en la primera OT de las zonas incluidas.

    const mtbfStart = req.query.period === 'ALL'
      ? new Date(mtbfOrders.reduce((earliest, wo) => Math.min(earliest, wo.created_at.getTime()), effectiveEnd.getTime()))
      : start;
    const hoursPerDay = HOURS_PER_DAY;
    const operationalHours = Math.max(0, effectiveEnd.getTime() - mtbfStart.getTime()) / 86_400_000 * hoursPerDay * mtbfZoneCount;
    const mtbfHours = mtbfFailures.length > 0 && operationalHours > 0
      ? operationalHours / mtbfFailures.length
      : null;

    // MTTR: tiempo activo de labor en correctivas finalizadas (horas)
    const mttrHours = avg(
      correctiveCompleted
        .filter((wo) => Number(wo.accumulated_time_ms) > 0)
        .map((wo) => Number(wo.accumulated_time_ms) / MS_PER_HOUR),
    );

    // Tiempo de respuesta: created_at → started_at (horas) de órdenes CREADAS en el
    // periodo (no cuenta una orden vieja que apenas se inició en el periodo, lo que
    // inflaba el promedio con respuestas de cientos de horas).
    const responseZoneIds = Array.isArray(settings?.response_time_zone_ids)
      ? (settings.response_time_zone_ids as string[])
      : null;
    const restrictResponseZones = responseZoneIds !== null && responseZoneIds.length > 0;
    const startedInPeriod = periodOrders.filter(
      (wo) =>
        wo.started_at &&
        wo.started_at >= start &&
        wo.started_at <= effectiveEnd &&
        wo.created_at >= start &&
        wo.created_at <= effectiveEnd,
    );
    const startedInZone = restrictResponseZones
      ? startedInPeriod.filter((wo) => {
          const zoneId = wo.zone_id ?? wo.asset?.zone_id ?? null;
          return zoneId !== null && responseZoneIds!.includes(zoneId);
        })
      : startedInPeriod;
    const responseHours = avg(
      startedInZone.map((wo) => (wo.started_at!.getTime() - wo.created_at.getTime()) / MS_PER_HOUR),
    );

    // Cumplimiento MTTR (antes etiquetado como SLA)
    const mttrGoalHours = goals.MTTR.targetValue;
    const validRepairTimes = correctiveCompleted.filter(wo => Number(wo.accumulated_time_ms) > 0);
    const mttrCompliance = validRepairTimes.length
      ? (validRepairTimes.filter((wo) => Number(wo.accumulated_time_ms) / MS_PER_HOUR <= mttrGoalHours).length /
          validRepairTimes.length) *
        100
      : null;

    // Backlog: stock abierto actual
    const backlog = openOrders.length;

    // Disponibilidad: paros con machine_stopped, recortados al periodo y SIN contar dos
    // veces los paros superpuestos: por cada línea/zona se unen los intervalos solapados
    // y solo se suma la cobertura efectiva (una línea parada = un tramo, haya 1 o N OT).
    const lineCount = Math.max(zones.length, 1);
    const periodMs = Math.max(effectiveEnd.getTime() - start.getTime(), 1);
    const totalTheoreticalMs = lineCount * periodMs;

    let totalDowntimeMs = 0;
    {
      const groups = new Map<string, Array<[number, number]>>();
      for (const wo of downtimeOrders) {
        const left = Math.max(wo.created_at.getTime(), start.getTime());
        const right = Math.min(
          wo.completed_at ? wo.completed_at.getTime() : effectiveEnd.getTime(),
          effectiveEnd.getTime(),
        );
        if (right <= left) continue;
        const key = wo.asset?.zone_id || `asset:${wo.asset?.id ?? 'sin-activo'}`;
        const list = groups.get(key) ?? [];
        list.push([left, right]);
        groups.set(key, list);
      }
      for (const intervals of groups.values()) {
        intervals.sort((a, b) => a[0] - b[0]);
        let curFrom = intervals[0][0];
        let curTo = intervals[0][1];
        for (let i = 1; i < intervals.length; i++) {
          const [f, t] = intervals[i];
          if (f <= curTo) {
            if (t > curTo) curTo = t;
          } else {
            totalDowntimeMs += curTo - curFrom;
            curFrom = f;
            curTo = t;
          }
        }
        totalDowntimeMs += curTo - curFrom;
      }
    }

    let assetAvailability = 100;
    if (totalTheoreticalMs > 0) {
      assetAvailability = clip(((totalTheoreticalMs - totalDowntimeMs) / totalTheoreticalMs) * 100, 0, 100);
    }

    // Retrabajo: correctivas finalizadas en periodo con falla previa dentro de la ventana configurada
    // (mismo activo y, si existe, mismo problema).
    const correctiveFinalized = correctiveCompleted.filter((wo) => !!wo.asset_id);
    let recurrentCount = 0;
    const recurrentAssetsMap = new Map<string, { id: string; name: string; count: number }>();

    if (correctiveFinalized.length > 0) {
      const assetIds = [...new Set(correctiveFinalized.map((wo) => wo.asset_id!))];
      const lookbackStart = new Date(start);
      lookbackStart.setDate(lookbackStart.getDate() - reworkWindowDays);

      const previousPool = await prisma.workOrder.findMany({
        where: {
          asset_id: { in: assetIds },
          maintenance_type: 'CORRECTIVO',
          status: 'FINALIZADO',
          completed_at: { gte: lookbackStart, lte: effectiveEnd },
        },
        select: {
          id: true,
          asset_id: true,
          failure_problem_id: true,
          completed_at: true,
          asset: { select: { name: true } },
        },
        orderBy: { completed_at: 'asc' },
      });

      for (const order of correctiveFinalized) {
        const windowStart = new Date(order.created_at);
        windowStart.setDate(windowStart.getDate() - reworkWindowDays);

        const previousFailure = previousPool.find((prev) => {
          if (prev.id === order.id || prev.asset_id !== order.asset_id || !prev.completed_at) return false;
          if (prev.completed_at < windowStart || prev.completed_at > order.created_at) return false;
          if (order.failure_problem_id && prev.failure_problem_id) {
            return prev.failure_problem_id === order.failure_problem_id;
          }
          return true;
        });

        if (previousFailure) {
          recurrentCount += 1;
          const assetName = previousFailure.asset?.name || order.asset?.name || 'Desconocido';
          const current = recurrentAssetsMap.get(order.asset_id!);
          if (current) current.count += 1;
          else recurrentAssetsMap.set(order.asset_id!, { id: order.asset_id!, name: assetName, count: 1 });
        }
      }
    }

    const reincidencia = correctiveFinalized.length
      ? (recurrentCount / correctiveFinalized.length) * 100
      : 0;

    const totalOrdersRelevant = await prisma.workOrder.count({
      where: {
        status: { not: 'ANULADO' },
        OR: [
          { completed_at: { gte: start, lte: effectiveEnd } },
          { created_at: { gte: start, lte: effectiveEnd } },
          { started_at: { gte: start, lte: effectiveEnd } },
          { status: { in: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] } },
        ],
      },
    });

    res.json({
      totalOrders: totalOrdersRelevant,
      reworkWindowDays,
      period: {
        start: start.toISOString(),
        end: effectiveEnd.toISOString(),
      },
      metrics: {
        COMPLETED_MONTHLY: {
          value: completionRate === null ? 0 : Number(completionRate.toFixed(1)),
          goal: goals.COMPLETED_MONTHLY,
          sampleSize: generatedOrders.length,
          isNull: completionRate === null,
          methodology: 'OT finalizadas en el periodo ÷ OT generadas (creadas) en el periodo × 100.',
        },
        MTTR: {
          value: Number(mttrHours.toFixed(2)),
          goal: goals.MTTR,
          sampleSize: correctiveCompleted.filter((wo) => wo.accumulated_time_ms > 0).length,
          methodology: 'Promedio de horas de labor (accumulated_time_ms) de las OT correctivas finalizadas con tiempo > 0.',
        },
        MTBF: {
          value: mtbfHours === null ? 0 : Number(mtbfHours.toFixed(2)),
          goal: goals.MTBF,
          goalConfigured: goals.MTBF.targetValue > 0,
          sampleSize: mtbfFailures.length,
          isNull: mtbfHours === null,
          methodology: `MTBF = días transcurridos × ${hoursPerDay} h/día × ${mtbfZoneCount} zona(s) seleccionada(s) en «Zonas de respuesta» / OT correctivas levantadas (creadas) en el periodo, excluidas las anuladas. Sin selección: todas las zonas. Histórico: desde la primera OT de las zonas incluidas.`,
        },
        RESPONSE_TIME: {
          value: Number(responseHours.toFixed(2)),
          goal: goals.RESPONSE_TIME,
          sampleSize: startedInZone.length,
          methodology: 'Promedio de (inicio − creación) en horas, de OT creadas e iniciadas dentro del periodo, en las zonas configuradas en «Zonas de respuesta».',
        },
        SLA: {
          value: mttrCompliance === null ? 0 : Number(mttrCompliance.toFixed(1)),
          goal: goals.SLA,
          sampleSize: validRepairTimes.length,
          missingCount: correctiveCompleted.length - validRepairTimes.length,
          isNull: mttrCompliance === null,
          methodology: 'Porcentaje de OT correctivas finalizadas cuyo tiempo de reparación está dentro de la meta de MTTR.',
        },
        BACKLOG: {
          value: backlog,
          goal: goals.BACKLOG,
          sampleSize: backlog,
          methodology: 'Número de OT abiertas ahora: pendientes + en proceso + en espera.',
        },
        ASSET_AVAILABILITY: {
          value: Number(assetAvailability.toFixed(1)),
          goal: goals.ASSET_AVAILABILITY,
          sampleSize: zones.length,
          isNull: zones.length === 0,
          methodology: '(tiempo calendario − tiempo de paro con máquina detenida) ÷ tiempo calendario × 100. Tiempo calendario = nº de zonas × duración del periodo; paros solapados unidos por zona.',
        },
        REINCIDENCIA: {
          value: Number(reincidencia.toFixed(1)),
          goal: goals.REINCIDENCIA,
          details: Array.from(recurrentAssetsMap.values()).sort((a, b) => b.count - a.count),
          sampleSize: correctiveFinalized.length,
          methodology: 'Correctivas finalizadas con falla previa del mismo equipo dentro de la ventana de retrabajo ÷ correctivas finalizadas × 100.',
        },
      },
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Error al calcular KPIs' });
  }
};

export const updateGoals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { goals } = req.body;
    if (!Array.isArray(goals)) {
      res.status(400).json({ error: 'Formato inválido' });
      return;
    }

    for (const goal of goals) {
      const normalized = normalizeGoal(goal.metricKey, Number(goal.targetValue), goal.unit);
      await prisma.kPIGoal.upsert({
        where: { metricKey: goal.metricKey },
        update: { targetValue: normalized.targetValue, unit: normalized.unit },
        create: {
          metricKey: goal.metricKey,
          targetValue: normalized.targetValue,
          unit: normalized.unit,
        },
      });
    }

    res.json({ message: 'Metas actualizadas correctamente' });
  } catch (error) {
    console.error('Error updating KPI goals:', error);
    res.status(500).json({ error: 'Error al actualizar metas' });
  }
};

const getChartIntervals = (period: string | undefined, opts?: DateRangeOpts) => {
  const { start, effectiveEnd } = getDateRange(period, opts);
  const intervals: { label: string; start: Date; end: Date; days: number }[] = [];

  const plantStartOfDayInstant = (d: Date): Date => {
    const pd = plantDateParts(d);
    return plantWallClockToDate(pd.year, pd.month, pd.day) ?? d;
  };

  const pushDaily = (labelFn: (d: Date) => string) => {
    let guard = 0;
    let cursor = plantStartOfDayInstant(start); // 00:00 real del día civil de planta
    while (cursor.getTime() <= effectiveEnd.getTime() && guard < 4000) {
      guard++;
      const dStart = cursor;
      const dEnd = new Date(
        Math.min(plantAddDays(cursor.getTime(), 1).getTime() - 1, effectiveEnd.getTime()),
      );
      intervals.push({
        label: labelFn(dStart),
        start: dStart,
        end: dEnd,
        days: 1,
      });
      cursor = plantAddDays(cursor.getTime(), 1);
    }
  };

  if (period === 'THIS_WEEK') {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    pushDaily((d) => days[plantUtcWeekday(d.getTime())]);
  } else if (period === 'THIS_MONTH' || period === 'LAST_MONTH') {
    pushDaily((d) => `${plantDateParts(d).day}`);
  } else if (period === 'CUSTOM') {
    const spanDays =
      Math.ceil((effectiveEnd.getTime() - start.getTime()) / 86_400_000) + 1;
    if (spanDays <= 62) {
      pushDaily((d) => {
        const pd = plantDateParts(d);
        return `${pd.day}/${pd.month}`;
      });
    } else {
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      let cursorMs = plantStartOfMonth(start.getTime()).getTime();
      const lastMonthStartMs = plantStartOfMonth(effectiveEnd.getTime()).getTime();
      while (cursorMs <= lastMonthStartMs) {
        const dStart = new Date(cursorMs);
        const dEnd = new Date(plantShiftMonthStart(cursorMs, 1).getTime() - 1);
        const s = dStart.getTime() < start.getTime() ? start : dStart;
        const e = dEnd.getTime() > effectiveEnd.getTime() ? effectiveEnd : dEnd;
        intervals.push({
          label: monthNames[plantDateParts(dStart).month - 1],
          start: s,
          end: e,
          days: Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86_400_000)),
        });
        cursorMs = plantShiftMonthStart(cursorMs, 1).getTime();
      }
    }
  } else {
    const monthsToShow = period === 'THIS_YEAR' ? 12 : period === 'LAST_12_MONTHS' || period === 'ALL' ? 12 : 6;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const nowMs = Date.now();
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const dStartMs = plantShiftMonthStart(nowMs, -i).getTime();
      const dEndMs = plantShiftMonthStart(nowMs, -i + 1).getTime() - 1;
      if (dEndMs < start.getTime()) continue;
      const s = dStartMs < start.getTime() ? start : new Date(dStartMs);
      const e = dEndMs > effectiveEnd.getTime() ? effectiveEnd : new Date(dEndMs);
      intervals.push({
        label: monthNames[plantDateParts(new Date(dStartMs)).month - 1],
        start: s,
        end: e,
        days: Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86_400_000)),
      });
    }
  }

  return intervals;
};

export const getChartData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string;
    const opts = { startDate: req.query.startDate, endDate: req.query.endDate };
    const intervals = getChartIntervals(period, opts);
    if (intervals.length === 0) {
      res.json([]);
      return;
    }

    const globalStart = intervals[0].start;
    const globalEnd = intervals[intervals.length - 1].end;

    const [workOrders, inventoryTransactions, settings] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          status: { not: 'ANULADO' },
          OR: [
            { completed_at: { gte: globalStart, lte: globalEnd } },
            { created_at: { gte: globalStart, lte: globalEnd } },
          ],
        },
        include: { asset: { select: { zone_id: true } } },
      }),
      prisma.inventoryTransaction.findMany({
        where: {
          created_at: { gte: globalStart, lte: globalEnd },
          amount: { lt: 0 },
          reason: { contains: 'Consumo OT' },
        },
        include: { item: true },
      }),
      prisma.systemSettings.findFirst({ select: { response_time_zone_ids: true } }),
    ]);
    const selectedMtbfZones = mtbfZoneIds(settings?.response_time_zone_ids);
    const mtbfZoneCount = await countMtbfZones(selectedMtbfZones);

    const chartData = intervals.map((interval) => {
      const intervalCompleted = workOrders.filter(
        (wo) =>
          wo.status === 'FINALIZADO' &&
          wo.completed_at &&
          wo.completed_at >= interval.start &&
          wo.completed_at <= interval.end,
      );

      const correctiveCompleted = intervalCompleted.filter((wo) => wo.maintenance_type === 'CORRECTIVO');
      const mttrHours = avg(
        correctiveCompleted
          .filter((wo) => Number(wo.accumulated_time_ms) > 0)
          .map((wo) => Number(wo.accumulated_time_ms) / MS_PER_HOUR),
      );

      const intervalTx = inventoryTransactions.filter(
        (tx) => tx.created_at >= interval.start && tx.created_at <= interval.end,
      );
      const costs = intervalTx.reduce((sum, tx) => {
        return sum + Math.abs(tx.amount) * resolvePartsUnitCost(tx);
      }, 0);

      // MTBF de flota: horas operativas (24 h/día) / fallas correctivas creadas.
      const correctiveCreated = workOrders.filter(
        (wo) => wo.maintenance_type === 'CORRECTIVO' && wo.created_at >= interval.start && wo.created_at <= interval.end,
      );
      const failures = correctiveCreated.filter(wo => isMtbfOrderInScope(wo, selectedMtbfZones)).length;
      const hoursPerDay = HOURS_PER_DAY;
      const operationalHours = Math.max(0, interval.end.getTime() - interval.start.getTime()) / 86400000 * hoursPerDay * mtbfZoneCount;
      const mtbfHours = failures > 0 && operationalHours > 0 ? operationalHours / failures : null;

      return {
        month: interval.label,
        costos: Number(costs.toFixed(2)),
        mttr: Number(mttrHours.toFixed(2)),
        mtbf: mtbfHours === null ? 0 : Number(mtbfHours.toFixed(2)),
        mtbfSample: failures,
        mtbfAssumptionHoursPerDay: hoursPerDay,
        mtbfEstimated: true,
      };
    });

    res.json(chartData);
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ error: 'Error al calcular datos para gráficos' });
  }
};

export const getCostsByAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, effectiveEnd } = rangeFromReq(req);

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        created_at: { gte: start, lte: effectiveEnd },
        amount: { lt: 0 },
        reason: { contains: 'Consumo OT' },
      },
      include: { item: true },
    });

    const folios = new Set<number>();
    for (const tx of transactions) {
      const match = tx.reason.match(/(?:FOL-|WO-)(\d+)/i);
      if (match) folios.add(parseInt(match[1], 10));
    }

    const workOrders = await prisma.workOrder.findMany({
      where: { folio: { in: [...folios] } },
      include: { asset: true },
    });

    const woMap = new Map<number, (typeof workOrders)[0]>();
    for (const wo of workOrders) woMap.set(wo.folio, wo);

    const assetCosts: Record<string, { assetId: string; assetName: string; totalCost: number }> = {};
    for (const tx of transactions) {
      const match = tx.reason.match(/(?:FOL-|WO-)(\d+)/i);
      if (!match) continue;
      const wo = woMap.get(parseInt(match[1], 10));
      if (!wo?.asset) continue;
      const cost = Math.abs(tx.amount) * resolvePartsUnitCost(tx);
      if (!assetCosts[wo.asset.id]) {
        assetCosts[wo.asset.id] = {
          assetId: wo.asset.id,
          assetName: wo.asset.name,
          totalCost: 0,
        };
      }
      assetCosts[wo.asset.id].totalCost += cost;
    }

    res.json(
      Object.values(assetCosts)
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5)
        .map((a) => ({ ...a, totalCost: Number(a.totalCost.toFixed(2)) })),
    );
  } catch (error) {
    console.error('Error fetching costs by asset:', error);
    res.status(500).json({ error: 'Error al calcular costos por máquina' });
  }
};

const roundHours = (ms: number): number => Math.round((ms / MS_PER_HOUR) * 10) / 10;

const holdElapsedMs = (wo: { status: string; paused_at: Date | null; updated_at: Date }, now: Date): number => {
  if (wo.status !== 'EN_ESPERA') return 0;
  const holdStart = wo.paused_at ?? wo.updated_at;
  return Math.max(0, now.getTime() - holdStart.getTime());
};

export const getTechnicianPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, effectiveEnd } = rangeFromReq(req);
    const { start: weekStart, effectiveEnd: weekEnd } = getDateRange('THIS_WEEK');
    const now = new Date();

    const [technicians, workOrders] = await Promise.all([
      prisma.user.findMany({
        where: {
          is_active: true,
          role: { in: ['TECNICO', 'GESTIONADOR'] },
        },
        select: { id: true, name: true, role: true },
      }),
      prisma.workOrder.findMany({
        where: {
          status: { not: 'ANULADO' },
          OR: [
            { completed_at: { gte: start, lte: effectiveEnd } },
            { created_at: { gte: start, lte: effectiveEnd } },
            { completed_at: { gte: weekStart, lte: weekEnd } },
            { status: { in: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] } },
          ],
        },
        select: {
          id: true,
          status: true,
          created_at: true,
          completed_at: true,
          updated_at: true,
          paused_at: true,
          accumulated_time_ms: true,
          assigned_technicians: { select: { id: true, name: true } },
        },
      }),
    ]);

    const rows = technicians
      .map((tech) => {
        const assigned = workOrders.filter((wo) =>
          wo.assigned_technicians.some((t) => t.id === tech.id),
        );
        const inPeriodOrOpen = assigned.filter((wo) => {
          if (['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'].includes(wo.status)) return true;
          if (wo.completed_at && wo.completed_at >= start && wo.completed_at <= effectiveEnd) return true;
          return wo.created_at >= start && wo.created_at <= effectiveEnd;
        });

        const open = assigned.filter((wo) =>
          ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'].includes(wo.status),
        );
        const paused = open.filter((wo) => wo.status === 'EN_ESPERA');
        const completedThisWeek = assigned.filter(
          (wo) =>
            wo.status === 'FINALIZADO' &&
            wo.completed_at &&
            wo.completed_at >= weekStart &&
            wo.completed_at <= weekEnd,
        );
        const completedInPeriod = assigned.filter(
          (wo) =>
            wo.status === 'FINALIZADO' &&
            wo.completed_at &&
            wo.completed_at >= start &&
            wo.completed_at <= effectiveEnd,
        );
        const waitMs = paused.reduce((sum, wo) => sum + holdElapsedMs(wo, now), 0);
        const laborMs = completedThisWeek.reduce((sum, wo) => sum + Number(wo.accumulated_time_ms || 0), 0);
        const laborPeriodMs = completedInPeriod.reduce((sum, wo) => sum + Number(wo.accumulated_time_ms || 0), 0);

        const Finalizadas = completedInPeriod.length;
        const EnProceso = inPeriodOrOpen.filter((wo) => wo.status === 'EN_PROCESO').length;
        const Pendientes = inPeriodOrOpen.filter((wo) => wo.status === 'PENDIENTE').length;
        const Pausadas = paused.length;
        const CargaHoy = open.length;
        const FinalizadasSemana = completedThisWeek.length;
        const Total = inPeriodOrOpen.length;

        return {
          id: tech.id,
          name: tech.name,
          Finalizadas,
          EnProceso,
          Pendientes,
          Pausadas,
          Total,
          CargaHoy,
          TiempoEsperaHoras: roundHours(waitMs),
          FinalizadasSemana,
          HorasLaborSemana: roundHours(laborMs),
          /** Horas de labor (accumulated_time_ms; sin pausas) de OT finalizadas en el periodo. */
          HorasLaborPeriodo: roundHours(laborPeriodMs),
          /** Promedio de horas de labor por OT finalizada en el periodo. */
          TiempoPromedioHoras:
            Finalizadas > 0 ? roundHours(laborPeriodMs / Finalizadas) : 0,
        };
      })
      .filter(
        (row) =>
          row.Total > 0 ||
          row.CargaHoy > 0 ||
          row.FinalizadasSemana > 0 ||
          row.Finalizadas > 0
      )
      .sort((a, b) => b.CargaHoy - a.CargaHoy || b.FinalizadasSemana - a.FinalizadasSemana || b.Total - a.Total);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching technician performance:', error);
    res.status(500).json({ error: 'Error al calcular desempeño de técnicos' });
  }
};

/**
 * MTTR/MTBF por línea de producción (L1–L5), para el periodo seleccionado.
 *
 * Alcance acordado:
 * - Paros = correctivas con machine_stopped=true (cualquier estado salvo ANULADO)
 *   creados dentro del periodo (columna «Paros»).
 * - MTTR = promedio de accumulated_time_ms (fallback completed_at − started_at) de los
 *   paros FINALIZADOS dentro del periodo, en horas.
 * - MTBF = días del periodo × 24 h/día × 1 zona (la línea) / correctivas LEVANTADAS
 *   dentro del periodo (excluidas anuladas).
 */
export const getMttrMtbfByLine = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { start, effectiveEnd } = rangeFromReq(req);
    const hoursPerDay = HOURS_PER_DAY;
    const DAY_MS = 86_400_000;
    // Histórico (ALL) arranca en la primera OT; el resto usa el inicio del periodo.
    const mtbfStart = req.query.period === 'ALL'
      ? (await prisma.workOrder.findFirst({
          where: { status: { not: 'ANULADO' } },
          orderBy: { created_at: 'asc' },
          select: { created_at: true },
        }))?.created_at ?? effectiveEnd
      : start;
    const days = Math.max(1, Math.ceil((effectiveEnd.getTime() - mtbfStart.getTime()) / DAY_MS));

    const [workOrders, zones, settings] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          maintenance_type: 'CORRECTIVO',
          status: { not: 'ANULADO' },
          OR: [
            { created_at: { gte: start, lte: effectiveEnd } },
            { completed_at: { gte: start, lte: effectiveEnd } },
          ],
        },
        select: {
          id: true,
          status: true,
          machine_stopped: true,
          created_at: true,
          started_at: true,
          completed_at: true,
          accumulated_time_ms: true,
          zone_id: true,
          zone: { select: { name: true } },
          asset: { select: { zone_id: true, zone: { select: { name: true } } } },
        },
      }),
      prisma.zone.findMany({ select: { id: true, name: true } }),
      prisma.systemSettings.findFirst({ select: { response_time_zone_ids: true } }),
    ]);

    // Zonas marcadas en «Zonas de respuesta» → líneas L1–L5 dentro del alcance.
    const markedZones = mtbfZoneIds(settings?.response_time_zone_ids);
    const lineByZoneId = new Map<string, string>();
    for (const z of zones) {
      const line = resolveProductionLine(z.name);
      if (line) lineByZoneId.set(z.id, line);
    }
    const markedLines = markedZones.length
      ? new Set(markedZones.map((id) => lineByZoneId.get(id)).filter((l): l is string => !!l))
      : new Set<string>(PRODUCTION_LINES);

    // Solo correctivas cuya zona efectiva (OT → equipo) esté dentro de las marcadas.
    const scopedOrders = markedZones.length
      ? workOrders.filter((wo) => {
          const zid = orderZoneId(wo);
          return zid !== null && markedZones.includes(zid);
        })
      : workOrders;

    const lines = [...markedLines].sort().map((line) => {
      const lineOrders = scopedOrders.filter((wo) => {
        const zid = orderZoneId(wo);
        return zid !== null && lineByZoneId.get(zid) === line;
      });

      // Paros (columna «Paros»): correctivas con máquina detenida creadas en el periodo.
      const paros = lineOrders.filter((wo) => wo.machine_stopped === true);
      const failures = paros.filter(
        (wo) => wo.created_at >= start && wo.created_at <= effectiveEnd,
      );

      // MTTR: paros finalizados dentro del periodo con tiempo de reparación válido.
      const finalized = paros.filter(
        (wo) =>
          wo.status === 'FINALIZADO' &&
          wo.completed_at &&
          wo.completed_at >= start &&
          wo.completed_at <= effectiveEnd,
      );

      let totalRepairMs = 0;
      let repairSample = 0;
      for (const wo of finalized) {
        let repairMs = Number(wo.accumulated_time_ms);
        if (!repairMs || repairMs <= 0) {
          const end = wo.completed_at!.getTime();
          const begin = wo.started_at ? wo.started_at.getTime() : wo.created_at.getTime();
          repairMs = end > begin ? end - begin : 0;
        }
        if (repairMs > 0) {
          totalRepairMs += repairMs;
          repairSample += 1;
        }
      }
      const mttrHours = repairSample > 0 ? totalRepairMs / repairSample / MS_PER_HOUR : null;

      // MTBF: días del periodo × 24 h/día × 1 zona / correctivas LEVANTADAS en el periodo.
      const mtbfFailures = lineOrders.filter(
        (wo) => wo.created_at >= start && wo.created_at <= effectiveEnd,
      );
      const operationalHours = days * hoursPerDay;
      const mtbfHours = mtbfFailures.length > 0 && operationalHours > 0
        ? operationalHours / mtbfFailures.length
        : null;

      return {
        line,
        failures: failures.length,
        mttrHours: mttrHours === null ? null : Number(mttrHours.toFixed(2)),
        mttrSample: repairSample,
        mtbfHours: mtbfHours === null ? null : Number(mtbfHours.toFixed(2)),
        mtbfSample: mtbfFailures.length,
        operationalHours: Math.round(operationalHours),
      };
    });

    res.json({
      period: { start: start.toISOString(), end: effectiveEnd.toISOString() },
      days,
      hoursPerDay,
      lines,
    });
  } catch (error) {
    console.error('Error fetching MTTR/MTBF by line:', error);
    res.status(500).json({ error: 'Error al calcular MTTR/MTBF por línea' });
  }
};

/**
 * Desglose por equipo de una línea (L1–L5): MTTR/MTBF por activo en el periodo.
 * Misma definición que /by-line, a nivel equipo:
 * - paros = correctivas con máquina detenida del equipo creadas en el periodo.
 * - MTTR = promedio de accumulated_time_ms de sus paros finalizados.
 * - MTBF = días del periodo × 24 h/día / correctivas levantadas del equipo.
 */
export const getLineAssetsMttrMtbf = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const line = String(req.params.line ?? '').trim().toUpperCase();
    if (!(PRODUCTION_LINES as readonly string[]).includes(line)) {
      res.status(400).json({ error: `Línea inválida. Usa: ${PRODUCTION_LINES.join(', ')}` });
      return;
    }

    const { start, effectiveEnd } = rangeFromReq(req);
    const hoursPerDay = HOURS_PER_DAY;
    const DAY_MS = 86_400_000;
    // Histórico (ALL) arranca en la primera OT; el resto usa el inicio del periodo.
    const mtbfStart = req.query.period === 'ALL'
      ? (await prisma.workOrder.findFirst({
          where: { status: { not: 'ANULADO' } },
          orderBy: { created_at: 'asc' },
          select: { created_at: true },
        }))?.created_at ?? effectiveEnd
      : start;
    const days = Math.max(1, Math.ceil((effectiveEnd.getTime() - mtbfStart.getTime()) / DAY_MS));

    const [settings, zones] = await Promise.all([
      prisma.systemSettings.findFirst({ select: { response_time_zone_ids: true } }),
      prisma.zone.findMany({ select: { id: true, name: true } }),
    ]);
    const markedZones = mtbfZoneIds(settings?.response_time_zone_ids);
    const lineByZoneId = new Map<string, string>();
    for (const z of zones) {
      const l = resolveProductionLine(z.name);
      if (l) lineByZoneId.set(z.id, l);
    }

    const lineAssets = await prisma.asset.findMany({
      where: { zone: { name: { equals: line, mode: 'insensitive' } } },
      select: { id: true, name: true, internal_code: true, status: true },
      orderBy: { name: 'asc' },
    });
    const assetIds = lineAssets.map((a) => a.id);

    const stoppages = assetIds.length
      ? await prisma.workOrder.findMany({
          where: {
            asset_id: { in: assetIds },
            maintenance_type: 'CORRECTIVO',
            status: { not: 'ANULADO' },
            OR: [
              { created_at: { gte: start, lte: effectiveEnd } },
              { completed_at: { gte: start, lte: effectiveEnd } },
            ],
          },
          select: {
            id: true,
            asset_id: true,
            zone_id: true,
            asset: { select: { zone_id: true } },
            status: true,
            machine_stopped: true,
            created_at: true,
            started_at: true,
            completed_at: true,
            accumulated_time_ms: true,
          },
        })
      : [];

    // Solo correctivas cuya zona efectiva (OT → equipo) corresponde a esta línea
    // y está dentro de las zonas marcadas en «Zonas de respuesta».
    const scopedStoppages = stoppages.filter((wo) => {
      const zid = orderZoneId(wo);
      if (lineByZoneId.get(zid ?? '') !== line) return false;
      if (markedZones.length && (zid === null || !markedZones.includes(zid))) return false;
      return true;
    });

    const byAsset = new Map<string, typeof scopedStoppages>();
    for (const wo of scopedStoppages) {
      const list = byAsset.get(wo.asset_id) ?? [];
      list.push(wo);
      byAsset.set(wo.asset_id, list);
    }

    const assets = lineAssets.map((asset) => {
      const orders = byAsset.get(asset.id) ?? [];
      const paros = orders.filter((wo) => wo.machine_stopped === true);
      const failures = paros.filter(
        (wo) => wo.created_at >= start && wo.created_at <= effectiveEnd,
      );
      const finalized = paros.filter(
        (wo) =>
          wo.status === 'FINALIZADO' &&
          wo.completed_at &&
          wo.completed_at >= start &&
          wo.completed_at <= effectiveEnd,
      );

      let totalRepairMs = 0;
      let repairSample = 0;
      for (const wo of finalized) {
        let repairMs = Number(wo.accumulated_time_ms);
        if (!repairMs || repairMs <= 0) {
          const end = wo.completed_at!.getTime();
          const begin = wo.started_at ? wo.started_at.getTime() : wo.created_at.getTime();
          repairMs = end > begin ? end - begin : 0;
        }
        if (repairMs > 0) {
          totalRepairMs += repairMs;
          repairSample += 1;
        }
      }
      const mttrHours = repairSample > 0 ? totalRepairMs / repairSample / MS_PER_HOUR : null;

      // MTBF por equipo: días del periodo × 24 h/día / correctivas LEVANTADAS del equipo.
      const mtbfFailures = orders.filter(
        (wo) => wo.created_at >= start && wo.created_at <= effectiveEnd,
      );
      const operationalHours = days * hoursPerDay;
      const mtbfHours =
        mtbfFailures.length > 0 && operationalHours > 0 ? operationalHours / mtbfFailures.length : null;

      return {
        id: asset.id,
        name: asset.name,
        internalCode: asset.internal_code,
        status: asset.status,
        failures: failures.length,
        mtbfSample: mtbfFailures.length,
        mttrHours: mttrHours === null ? null : Number(mttrHours.toFixed(2)),
        mtbfHours: mtbfHours === null ? null : Number(mtbfHours.toFixed(2)),
        operationalHours: Math.round(operationalHours),
      };
    });

    assets.sort((a, b) => b.failures - a.failures || a.name.localeCompare(b.name));

    res.json({
      line,
      period: { start: start.toISOString(), end: effectiveEnd.toISOString() },
      days,
      hoursPerDay,
      assets,
    });
  } catch (error) {
    console.error('Error fetching line assets MTTR/MTBF:', error);
    res.status(500).json({ error: 'Error al calcular MTTR/MTBF de los equipos de la línea' });
  }
};

/** Zonas incluidas en el KPI «Tiempo de respuesta» (configuración global). null = todas. */
export const getResponseTimeZones = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: { response_time_zone_ids: true },
    });
    const zoneIds = Array.isArray(settings?.response_time_zone_ids)
      ? (settings.response_time_zone_ids as string[])
      : null;
    res.json({ zoneIds });
  } catch (error) {
    console.error('Error fetching response time zones:', error);
    res.status(500).json({ error: 'Error al obtener las zonas del tiempo de respuesta' });
  }
};

/** Guarda las zonas incluidas en el KPI «Tiempo de respuesta» (solo Admin). Vacío = todas. */
export const updateResponseTimeZones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const zoneIds = req.body?.zoneIds;
    if (!Array.isArray(zoneIds)) {
      res.status(400).json({ error: 'zoneIds debe ser un arreglo de ids' });
      return;
    }
    const clean = zoneIds.filter((z): z is string => typeof z === 'string');

    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({ data: { response_time_zone_ids: clean } });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { response_time_zone_ids: clean },
      });
    }

    res.json({ success: true, zoneIds: clean });
  } catch (error) {
    console.error('Error updating response time zones:', error);
    res.status(500).json({ error: 'Error al guardar las zonas del tiempo de respuesta' });
  }
};
