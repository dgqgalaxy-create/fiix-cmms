import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

const DEFAULT_GOALS = {
  COMPLETED_MONTHLY: { targetValue: 50, unit: 'órdenes' },
  MTTR: { targetValue: 14400000, unit: 'ms' }, // 4 horas
  RESPONSE_TIME: { targetValue: 3600000, unit: 'ms' }, // 1 hora
  SLA: { targetValue: 90, unit: '%' },
  BACKLOG: { targetValue: 10, unit: 'órdenes' },
  ASSET_AVAILABILITY: { targetValue: 95, unit: '%' }
};

export const getKPIs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Fetch Goals
    const dbGoals = await prisma.kPIGoal.findMany();
    const goals: Record<string, { targetValue: number; unit: string }> = { ...DEFAULT_GOALS };
    dbGoals.forEach(g => {
      goals[g.metricKey] = { targetValue: g.targetValue, unit: g.unit || '' };
    });

    // 2. Fetch data for calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const allWorkOrders = await prisma.workOrder.findMany();
    const allAssets = await prisma.asset.findMany();

    // KPI 1: Órdenes Completadas (Mes actual)
    const completedMonthly = allWorkOrders.filter(wo => 
      wo.status === 'FINALIZADO' && wo.completed_at && new Date(wo.completed_at) >= startOfMonth
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
      : 100; // If no orders, SLA is 100%

    // KPI 5: Backlog
    const backlog = allWorkOrders.filter(wo => wo.status === 'PENDIENTE' || wo.status === 'EN_ESPERA').length;

    // KPI 6: Disponibilidad de Activos
    const operationalAssets = allAssets.filter(a => a.status === 'OPERATIVO');
    const assetAvailability = allAssets.length > 0 
      ? (operationalAssets.length / allAssets.length) * 100 
      : 100;

    res.json({
      totalOrders: allWorkOrders.length,
      metrics: {
        COMPLETED_MONTHLY: { value: completedMonthly, goal: goals.COMPLETED_MONTHLY },
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

    const { goals } = req.body; // Array of { metricKey, targetValue, unit }
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
