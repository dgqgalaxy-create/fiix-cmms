import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getTopFailingAssets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string;
    const { start, end } = getDateRange(period);

    const workOrders = await prisma.workOrder.findMany({
      where: {
        created_at: { gte: start, lte: end },
        maintenance_type: 'CORRECTIVO', // Assuming CORRECTIVO = Falla
        status: { not: 'ANULADO' } // Ignore cancelled ones
      },
      select: {
        asset_id: true,
        asset: {
          select: { name: true }
        }
      }
    });

    const failureCount: Record<string, { assetId: string; assetName: string; count: number }> = {};

    workOrders.forEach(wo => {
      if (wo.asset_id && wo.asset) {
        if (!failureCount[wo.asset_id]) {
          failureCount[wo.asset_id] = { assetId: wo.asset_id, assetName: wo.asset.name, count: 0 };
        }
        failureCount[wo.asset_id].count += 1;
      }
    });

    const sortedAssets = Object.values(failureCount).sort((a, b) => b.count - a.count).slice(0, 10);

    res.json(sortedAssets);
  } catch (error) {
    console.error('Error fetching top failing assets:', error);
    res.status(500).json({ error: 'Error al obtener equipos con más fallas' });
  }
};

export const getAssetFailureOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const assetId = req.params.assetId as string;
    const period = req.query.period as string;
    const { start, end } = getDateRange(period);

    const workOrders = await prisma.workOrder.findMany({
      where: {
        asset_id: assetId,
        created_at: { gte: start, lte: end },
        maintenance_type: 'CORRECTIVO',
        status: { not: 'ANULADO' }
      },
      select: {
        id: true,
        folio: true,
        title: true,
        created_at: true,
        status: true,
        accumulated_time_ms: true,
        zone: {
          select: { name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    res.json(workOrders);
  } catch (error) {
    console.error('Error fetching asset failure orders:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de fallas del equipo' });
  }
};

const DEFAULT_GOALS = {
  COMPLETED_MONTHLY: { targetValue: 50, unit: 'órdenes' },
  MTTR: { targetValue: 14400000, unit: 'ms' }, // 4 horas
  RESPONSE_TIME: { targetValue: 3600000, unit: 'ms' }, // 1 hora
  SLA: { targetValue: 90, unit: '%' },
  BACKLOG: { targetValue: 10, unit: 'órdenes' },
  ASSET_AVAILABILITY: { targetValue: 95, unit: '%' }
};

const getDateRange = (period: string | undefined): { start: Date; end: Date } => {
  const now = new Date();
  let start = new Date(0); // Epoch
  let end = new Date(now); // Cap at now by default for metrics? Wait, let's keep exact bounds

  if (period === 'THIS_WEEK') {
    start = new Date(now);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0,0,0,0);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23,59,59,999);
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
    start = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === 'ALL') {
    start = new Date(0);
    end = new Date(now.getFullYear() + 1, 0, 1); // Far future
  } else {
    // Default THIS_MONTH
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { start, end };
};

export const getKPIs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string;
    const { start, end } = getDateRange(period);

    // 1. Fetch Goals
    const dbGoals = await prisma.kPIGoal.findMany();
    const goals: Record<string, { targetValue: number; unit: string }> = { ...DEFAULT_GOALS };
    dbGoals.forEach(g => {
      goals[g.metricKey] = { targetValue: g.targetValue, unit: g.unit || '' };
    });

    // 2. Fetch data inside date range
    const allWorkOrders = await prisma.workOrder.findMany({
      where: {
        created_at: { gte: start, lte: end }
      }
    });
    const allAssets = await prisma.asset.findMany();

    // KPI 1: Órdenes Completadas
    const completed = allWorkOrders.filter(wo => 
      wo.status === 'FINALIZADO' && wo.completed_at && new Date(wo.completed_at) >= start && new Date(wo.completed_at) <= end
    ).length;

    // KPI 2: MTTR (Tiempo Medio de Reparación)
    const finalizedOrders = allWorkOrders.filter(wo => wo.status === 'FINALIZADO');
    const mttr = finalizedOrders.length > 0 
      ? finalizedOrders.reduce((sum, wo) => sum + wo.accumulated_time_ms, 0) / finalizedOrders.length 
      : 0;

    // KPI 3: Tiempo Medio de Respuesta
    const startedOrders = allWorkOrders.filter(wo => wo.started_at != null);
    const responseTime = startedOrders.length > 0
      ? startedOrders.reduce((sum, wo) => sum + (new Date(wo.started_at!).getTime() - new Date(wo.created_at).getTime()), 0) / startedOrders.length
      : 0;

    // KPI 4: Cumplimiento de SLA (% finalizadas debajo del MTTR meta)
    const mttrGoal = goals.MTTR.targetValue;
    const slaCompliantOrders = finalizedOrders.filter(wo => wo.accumulated_time_ms <= mttrGoal);
    const sla = finalizedOrders.length > 0 
      ? (slaCompliantOrders.length / finalizedOrders.length) * 100 
      : 100;

    // KPI 5: Backlog
    const backlog = allWorkOrders.filter(wo => wo.status === 'PENDIENTE' || wo.status === 'EN_ESPERA').length;

    // KPI 6: Disponibilidad de Activos (Global, not strictly date dependent)
    const operationalAssets = allAssets.filter(a => a.status === 'OPERATIVO');
    const assetAvailability = allAssets.length > 0 
      ? (operationalAssets.length / allAssets.length) * 100 
      : 100;

    res.json({
      totalOrders: allWorkOrders.length,
      metrics: {
        COMPLETED_MONTHLY: { value: completed, goal: goals.COMPLETED_MONTHLY },
        MTTR: { value: mttr, goal: goals.MTTR },
        RESPONSE_TIME: { value: responseTime, goal: goals.RESPONSE_TIME },
        SLA: { value: sla, goal: goals.SLA },
        BACKLOG: { value: backlog, goal: goals.BACKLOG },
        ASSET_AVAILABILITY: { value: assetAvailability, goal: goals.ASSET_AVAILABILITY },
      }
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
      await prisma.kPIGoal.upsert({
        where: { metricKey: goal.metricKey },
        update: { targetValue: goal.targetValue, unit: goal.unit },
        create: { metricKey: goal.metricKey, targetValue: goal.targetValue, unit: goal.unit }
      });
    }

    res.json({ message: 'Metas actualizadas correctamente' });
  } catch (error) {
    console.error('Error updating KPI goals:', error);
    res.status(500).json({ error: 'Error al actualizar metas' });
  }
};

const getChartIntervals = (period: string | undefined) => {
  const { start, end } = getDateRange(period);
  const intervals: { label: string; start: Date; end: Date; days: number }[] = [];
  
  if (period === 'THIS_WEEK') {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const dStart = new Date(start);
      dStart.setDate(start.getDate() + i);
      const dEnd = new Date(dStart);
      dEnd.setHours(23, 59, 59, 999);
      intervals.push({ label: days[dStart.getDay()], start: dStart, end: dEnd, days: 1 });
    }
  } else if (period === 'THIS_MONTH' || period === 'LAST_MONTH') {
    const numDays = end.getDate();
    for (let i = 1; i <= numDays; i++) {
      const dStart = new Date(start.getFullYear(), start.getMonth(), i);
      const dEnd = new Date(start.getFullYear(), start.getMonth(), i, 23, 59, 59, 999);
      intervals.push({ label: `${i}`, start: dStart, end: dEnd, days: 1 });
    }
  } else if (period === 'THIS_YEAR') {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let i = 0; i < 12; i++) {
      const dStart = new Date(start.getFullYear(), i, 1);
      const dEnd = new Date(start.getFullYear(), i + 1, 0, 23, 59, 59, 999);
      intervals.push({ label: monthNames[i], start: dStart, end: dEnd, days: dEnd.getDate() });
    }
  } else {
    // Default to LAST_6_MONTHS logic for ALL and unknown
    const monthsToShow = period === 'LAST_12_MONTHS' ? 12 : 6;
    const now = new Date();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const dStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const dEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      intervals.push({ label: monthNames[dStart.getMonth()], start: dStart, end: dEnd, days: dEnd.getDate() });
    }
  }
  return intervals;
};

export const getChartData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const period = req.query.period as string;
    const intervals = getChartIntervals(period);
    const globalStart = intervals[0].start;
    const globalEnd = intervals[intervals.length - 1].end;

    const workOrders = await prisma.workOrder.findMany({
      where: { created_at: { gte: globalStart, lte: globalEnd } }
    });

    const inventoryTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        created_at: { gte: globalStart, lte: globalEnd },
        amount: { lt: 0 },
        reason: { contains: 'Consumo OT' }
      },
      include: { item: true }
    });

    const totalAssets = await prisma.asset.count({ where: { status: 'OPERATIVO' } });

    const chartData = intervals.map(interval => {
      const intervalWOs = workOrders.filter(wo => {
        const d = new Date(wo.created_at);
        return d >= interval.start && d <= interval.end;
      });

      const intervalTx = inventoryTransactions.filter(tx => {
        const d = new Date(tx.created_at);
        return d >= interval.start && d <= interval.end;
      });

      const costs = intervalTx.reduce((sum, tx) => {
        const costPerUnit = tx.item.purchase_cost || 0;
        return sum + (Math.abs(tx.amount) * costPerUnit);
      }, 0);

      const finalizedWOs = intervalWOs.filter(wo => wo.status === 'FINALIZADO');
      const mttrMs = finalizedWOs.length > 0 
        ? finalizedWOs.reduce((sum, wo) => sum + wo.accumulated_time_ms, 0) / finalizedWOs.length
        : 0;
      const mttrHours = mttrMs / 3600000;

      const totalOperationalHours = interval.days * 24 * totalAssets;
      const correctiveWOs = intervalWOs.filter(wo => wo.maintenance_type === 'CORRECTIVO').length;
      const mtbfHours = correctiveWOs > 0 ? (totalOperationalHours / correctiveWOs) : totalOperationalHours;

      return {
        month: interval.label,
        costos: Number(costs.toFixed(2)),
        mttr: Number(mttrHours.toFixed(2)),
        mtbf: Number(mtbfHours.toFixed(2))
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
    const { start, end } = getDateRange(period);

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        created_at: { gte: start, lte: end },
        amount: { lt: 0 },
        reason: { startsWith: 'Consumo OT' }
      },
      include: { item: true }
    });

    const workOrders = await prisma.workOrder.findMany({
      include: { asset: true }
    });

    const woMap = new Map<number, typeof workOrders[0]>();
    for (const wo of workOrders) {
      woMap.set(wo.folio, wo);
    }

    const assetCosts: Record<string, { assetId: string, assetName: string, totalCost: number }> = {};

    for (const tx of transactions) {
      const match = tx.reason.match(/WO-(\d+)/);
      if (match) {
        const folio = parseInt(match[1], 10);
        const wo = woMap.get(folio);
        if (wo && wo.asset) {
          const cost = Math.abs(tx.amount) * (tx.item.purchase_cost || 0);
          
          if (!assetCosts[wo.asset.id]) {
            assetCosts[wo.asset.id] = {
              assetId: wo.asset.id,
              assetName: wo.asset.name,
              totalCost: 0
            };
          }
          assetCosts[wo.asset.id].totalCost += cost;
        }
      }
    }

    const sortedAssets = Object.values(assetCosts)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5)
      .map(a => ({ ...a, totalCost: Number(a.totalCost.toFixed(2)) }));

    res.json(sortedAssets);
  } catch (error) {
    console.error('Error fetching costs by asset:', error);
    res.status(500).json({ error: 'Error al calcular costos por máquina' });
  }
};
