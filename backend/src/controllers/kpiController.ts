import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

const MS_PER_HOUR = 3_600_000;
const REWORK_WINDOW_DAYS = 7;
const PRODUCTIVE_HOURS_PER_YEAR = 8467.27;
const HOURS_PER_YEAR = 365 * 24;

const DEFAULT_GOALS: Record<string, { targetValue: number; unit: string }> = {
  COMPLETED_MONTHLY: { targetValue: 50, unit: 'órdenes' },
  MTTR: { targetValue: 4, unit: 'horas' },
  RESPONSE_TIME: { targetValue: 1, unit: 'horas' },
  SLA: { targetValue: 90, unit: '%' },
  BACKLOG: { targetValue: 10, unit: 'órdenes' },
  ASSET_AVAILABILITY: { targetValue: 95, unit: '%' },
  REINCIDENCIA: { targetValue: 10, unit: '%' },
};

const clip = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getDateRange = (period: string | undefined): { start: Date; end: Date; effectiveEnd: Date } => {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  if (period === 'THIS_WEEK') {
    start = new Date(now);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'THIS_MONTH') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === 'LAST_MONTH') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === 'THIS_YEAR') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (period === 'LAST_12_MONTHS') {
    start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(now);
  } else if (period === 'ALL') {
    start = new Date(0);
    end = new Date(now);
  }

  const effectiveEnd = end.getTime() > now.getTime() ? now : end;
  return { start, end, effectiveEnd };
};

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

const overlapMs = (from: Date, to: Date, start: Date, end: Date) => {
  const left = Math.max(from.getTime(), start.getTime());
  const right = Math.min(to.getTime(), end.getTime());
  return Math.max(0, right - left);
};

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const getTopFailingAssets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string;
    const { start, effectiveEnd } = getDateRange(period);

    const workOrders = await prisma.workOrder.findMany({
      where: {
        maintenance_type: 'CORRECTIVO',
        status: { not: 'ANULADO' },
        OR: [
          { completed_at: { gte: start, lte: effectiveEnd } },
          { completed_at: null, created_at: { gte: start, lte: effectiveEnd } },
        ],
      },
      select: {
        asset_id: true,
        asset: { select: { name: true } },
      },
    });

    const failureCount: Record<string, { assetId: string; assetName: string; count: number }> = {};
    workOrders.forEach((wo) => {
      if (!wo.asset_id || !wo.asset) return;
      if (!failureCount[wo.asset_id]) {
        failureCount[wo.asset_id] = { assetId: wo.asset_id, assetName: wo.asset.name, count: 0 };
      }
      failureCount[wo.asset_id].count += 1;
    });

    res.json(Object.values(failureCount).sort((a, b) => b.count - a.count).slice(0, 10));
  } catch (error) {
    console.error('Error fetching top failing assets:', error);
    res.status(500).json({ error: 'Error al obtener equipos con más fallas' });
  }
};

export const getAssetFailureOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assetId = req.params.assetId as string;
    const period = req.query.period as string;
    const { start, effectiveEnd } = getDateRange(period);

    const workOrders = await prisma.workOrder.findMany({
      where: {
        asset_id: assetId,
        maintenance_type: 'CORRECTIVO',
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
    const period = req.query.period as string;
    const { start, effectiveEnd } = getDateRange(period);

    const dbGoals = await prisma.kPIGoal.findMany();
    const goals: Record<string, { targetValue: number; unit: string }> = { ...DEFAULT_GOALS };
    dbGoals.forEach((goal) => {
      goals[goal.metricKey] = normalizeGoal(goal.metricKey, goal.targetValue, goal.unit);
    });

    const [periodOrders, openOrders, downtimeOrders, zones] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          status: { not: 'ANULADO' },
          OR: [
            { completed_at: { gte: start, lte: effectiveEnd } },
            { started_at: { gte: start, lte: effectiveEnd } },
            { created_at: { gte: start, lte: effectiveEnd } },
          ],
        },
        include: { asset: { select: { id: true, name: true } } },
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
          started_at: true,
        },
      }),
      prisma.zone.findMany({ select: { id: true } }),
    ]);

    const completedOrders = periodOrders.filter(
      (wo) =>
        wo.status === 'FINALIZADO' &&
        wo.completed_at &&
        wo.completed_at >= start &&
        wo.completed_at <= effectiveEnd,
    );

    const correctiveCompleted = completedOrders.filter((wo) => wo.maintenance_type === 'CORRECTIVO');

    // MTTR: tiempo activo de labor en correctivas finalizadas (horas)
    const mttrHours = avg(
      correctiveCompleted
        .filter((wo) => wo.accumulated_time_ms > 0)
        .map((wo) => wo.accumulated_time_ms / MS_PER_HOUR),
    );

    // Tiempo de respuesta: created_at → started_at (horas)
    const startedInPeriod = periodOrders.filter(
      (wo) => wo.started_at && wo.started_at >= start && wo.started_at <= effectiveEnd,
    );
    const responseHours = avg(
      startedInPeriod.map((wo) => (wo.started_at!.getTime() - wo.created_at.getTime()) / MS_PER_HOUR),
    );

    // Cumplimiento MTTR (antes etiquetado como SLA)
    const mttrGoalHours = goals.MTTR.targetValue;
    const mttrCompliance = correctiveCompleted.length
      ? (correctiveCompleted.filter((wo) => wo.accumulated_time_ms / MS_PER_HOUR <= mttrGoalHours).length /
          correctiveCompleted.length) *
        100
      : null;

    // Backlog: stock abierto actual
    const backlog = openOrders.length;

    // Disponibilidad: solo paros con machine_stopped, recortados al periodo
    const lineCount = Math.max(zones.length, 1);
    const periodMs = Math.max(effectiveEnd.getTime() - start.getTime(), 1);
    const totalTheoreticalMs = lineCount * periodMs * (PRODUCTIVE_HOURS_PER_YEAR / HOURS_PER_YEAR);

    let totalDowntimeMs = 0;
    downtimeOrders.forEach((wo) => {
      const from = wo.created_at;
      const to = wo.completed_at || effectiveEnd;
      totalDowntimeMs += overlapMs(from, to, start, effectiveEnd);
    });

    let assetAvailability = 100;
    if (totalTheoreticalMs > 0) {
      assetAvailability = clip(((totalTheoreticalMs - totalDowntimeMs) / totalTheoreticalMs) * 100, 0, 100);
    }

    // Retrabajo: correctivas finalizadas en periodo con falla previa ≤ 7 días (mismo activo y, si existe, mismo problema)
    const correctiveFinalized = correctiveCompleted.filter((wo) => !!wo.asset_id);
    let recurrentCount = 0;
    const recurrentAssetsMap = new Map<string, { id: string; name: string; count: number }>();

    if (correctiveFinalized.length > 0) {
      const assetIds = [...new Set(correctiveFinalized.map((wo) => wo.asset_id!))];
      const lookbackStart = new Date(start);
      lookbackStart.setDate(lookbackStart.getDate() - REWORK_WINDOW_DAYS);

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
        windowStart.setDate(windowStart.getDate() - REWORK_WINDOW_DAYS);

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
      period: {
        start: start.toISOString(),
        end: effectiveEnd.toISOString(),
      },
      metrics: {
        COMPLETED_MONTHLY: {
          value: completedOrders.length,
          goal: goals.COMPLETED_MONTHLY,
          sampleSize: completedOrders.length,
        },
        MTTR: {
          value: Number(mttrHours.toFixed(2)),
          goal: goals.MTTR,
          sampleSize: correctiveCompleted.filter((wo) => wo.accumulated_time_ms > 0).length,
        },
        RESPONSE_TIME: {
          value: Number(responseHours.toFixed(2)),
          goal: goals.RESPONSE_TIME,
          sampleSize: startedInPeriod.length,
        },
        SLA: {
          value: mttrCompliance === null ? 0 : Number(mttrCompliance.toFixed(1)),
          goal: goals.SLA,
          sampleSize: correctiveCompleted.length,
          isNull: mttrCompliance === null,
        },
        BACKLOG: {
          value: backlog,
          goal: goals.BACKLOG,
          sampleSize: backlog,
        },
        ASSET_AVAILABILITY: {
          value: Number(assetAvailability.toFixed(1)),
          goal: goals.ASSET_AVAILABILITY,
          sampleSize: downtimeOrders.length,
        },
        REINCIDENCIA: {
          value: Number(reincidencia.toFixed(1)),
          goal: goals.REINCIDENCIA,
          details: Array.from(recurrentAssetsMap.values()).sort((a, b) => b.count - a.count),
          sampleSize: correctiveFinalized.length,
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

const getChartIntervals = (period: string | undefined) => {
  const { start, effectiveEnd } = getDateRange(period);
  const intervals: { label: string; start: Date; end: Date; days: number }[] = [];

  if (period === 'THIS_WEEK') {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const dStart = new Date(start);
      dStart.setDate(start.getDate() + i);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(dStart);
      dEnd.setHours(23, 59, 59, 999);
      if (dStart > effectiveEnd) break;
      intervals.push({
        label: days[dStart.getDay()],
        start: dStart,
        end: dEnd > effectiveEnd ? effectiveEnd : dEnd,
        days: 1,
      });
    }
  } else if (period === 'THIS_MONTH' || period === 'LAST_MONTH') {
    const cursor = new Date(start);
    while (cursor <= effectiveEnd) {
      const dStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const dEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59, 999);
      intervals.push({
        label: `${cursor.getDate()}`,
        start: dStart,
        end: dEnd > effectiveEnd ? effectiveEnd : dEnd,
        days: 1,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const monthsToShow = period === 'THIS_YEAR' ? 12 : period === 'LAST_12_MONTHS' || period === 'ALL' ? 12 : 6;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const dStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      if (dEnd < start) continue;
      intervals.push({
        label: monthNames[dStart.getMonth()],
        start: dStart < start ? start : dStart,
        end: dEnd > effectiveEnd ? effectiveEnd : dEnd,
        days: Math.max(1, Math.ceil(((dEnd > effectiveEnd ? effectiveEnd : dEnd).getTime() - (dStart < start ? start : dStart).getTime()) / 86_400_000)),
      });
    }
  }

  return intervals;
};

export const getChartData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string;
    const intervals = getChartIntervals(period);
    if (intervals.length === 0) {
      res.json([]);
      return;
    }

    const globalStart = intervals[0].start;
    const globalEnd = intervals[intervals.length - 1].end;

    const [workOrders, inventoryTransactions, operativeAssets] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          status: { not: 'ANULADO' },
          OR: [
            { completed_at: { gte: globalStart, lte: globalEnd } },
            { created_at: { gte: globalStart, lte: globalEnd } },
          ],
        },
      }),
      prisma.inventoryTransaction.findMany({
        where: {
          created_at: { gte: globalStart, lte: globalEnd },
          amount: { lt: 0 },
          reason: { contains: 'Consumo OT' },
        },
        include: { item: true },
      }),
      prisma.asset.count({ where: { status: 'OPERATIVO' } }),
    ]);

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
          .filter((wo) => wo.accumulated_time_ms > 0)
          .map((wo) => wo.accumulated_time_ms / MS_PER_HOUR),
      );

      const intervalTx = inventoryTransactions.filter(
        (tx) => tx.created_at >= interval.start && tx.created_at <= interval.end,
      );
      const costs = intervalTx.reduce((sum, tx) => {
        const costPerUnit = tx.item?.purchase_cost || 0;
        return sum + Math.abs(tx.amount) * costPerUnit;
      }, 0);

      // MTBF aproximado de flota: horas operativas / fallas correctivas con paro o correctivas finalizadas
      const failures = correctiveCompleted.length;
      const operationalHours = interval.days * 24 * Math.max(operativeAssets, 1);
      const mtbfHours = failures > 0 ? operationalHours / failures : null;

      return {
        month: interval.label,
        costos: Number(costs.toFixed(2)),
        mttr: Number(mttrHours.toFixed(2)),
        mtbf: mtbfHours === null ? 0 : Number(mtbfHours.toFixed(2)),
        mtbfSample: failures,
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
    const period = req.query.period as string;
    const { start, effectiveEnd } = getDateRange(period);

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
      const match = tx.reason.match(/WO-(\d+)/);
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
      const match = tx.reason.match(/WO-(\d+)/);
      if (!match) continue;
      const wo = woMap.get(parseInt(match[1], 10));
      if (!wo?.asset) continue;
      const cost = Math.abs(tx.amount) * (tx.item?.purchase_cost || 0);
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

export const getTechnicianPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string;
    const { start, effectiveEnd } = getDateRange(period);

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
            { status: { in: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] } },
          ],
        },
        include: {
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

        return {
          id: tech.id,
          name: tech.name,
          Finalizadas: inPeriodOrOpen.filter((wo) => wo.status === 'FINALIZADO').length,
          EnProceso: inPeriodOrOpen.filter((wo) => wo.status === 'EN_PROCESO').length,
          Pendientes: inPeriodOrOpen.filter((wo) => wo.status === 'PENDIENTE' || wo.status === 'EN_ESPERA').length,
          Total: inPeriodOrOpen.length,
        };
      })
      .filter((row) => row.Total > 0)
      .sort((a, b) => b.Total - a.Total);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching technician performance:', error);
    res.status(500).json({ error: 'Error al calcular desempeño de técnicos' });
  }
};
