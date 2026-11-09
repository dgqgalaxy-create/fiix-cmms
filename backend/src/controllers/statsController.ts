import { Request, Response } from 'express';
import prisma from '../config/prisma';

/** Rango de fechas del query: from/to en ISO o YYYY-MM-DD. Por defecto, últimos 90 días. */
function range(req: Request): { from: Date; to: Date } {
  const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : new Date();
  const from = typeof req.query.from === 'string' && req.query.from
    ? new Date(req.query.from)
    : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  return { from, to };
}

const OPEN_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] as const;

/**
 * GET /api/stats/aging — antigüedad de las OT abiertas por tramos.
 * Responde cuántas órdenes llevan 0-1, 2-3, 4-7, 8-15 y más de 15 días.
 */
export const getAging = async (_req: Request, res: Response): Promise<void> => {
  try {
    const openOrders = await prisma.workOrder.findMany({
      where: { status: { in: [...OPEN_STATUSES] } },
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        priority: true,
        created_at: true,
        scheduled_date: true,
        asset: { select: { id: true, name: true, internal_code: true } },
        assigned_technicians: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'asc' },
    });

    const now = Date.now();
    const buckets = [
      { key: '0-1', label: '0 a 1 día', min: 0, max: 1, count: 0 },
      { key: '2-3', label: '2 a 3 días', min: 2, max: 3, count: 0 },
      { key: '4-7', label: '4 a 7 días', min: 4, max: 7, count: 0 },
      { key: '8-15', label: '8 a 15 días', min: 8, max: 15, count: 0 },
      { key: '16+', label: 'Más de 15 días', min: 16, max: Number.POSITIVE_INFINITY, count: 0 },
    ];

    const orders = openOrders.map((order) => {
      const days = Math.floor((now - order.created_at.getTime()) / (24 * 60 * 60 * 1000));
      const bucket = buckets.find((item) => days >= item.min && days <= item.max);
      if (bucket) bucket.count += 1;
      return {
        id: order.id,
        folio: order.folio,
        title: order.title,
        status: order.status,
        priority: order.priority,
        days,
        created_at: order.created_at,
        scheduled_date: order.scheduled_date,
        asset: order.asset,
        technicians: order.assigned_technicians,
        bucket: bucket?.key ?? '16+',
      };
    });

    res.json({
      total: orders.length,
      buckets,
      oldest: orders.slice().sort((a, b) => b.days - a.days).slice(0, 20),
      orders,
    });
  } catch (error) {
    console.error('Error calculando aging de OT:', error);
    res.status(500).json({ error: 'No se pudo calcular la antigüedad de las órdenes' });
  }
};

/**
 * GET /api/stats/consumption — consumo de repuestos en el periodo (salidas de almacén),
 * agrupado por repuesto, con cantidad y costo.
 */
export const getConsumption = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = range(req);
    const rows = await prisma.inventoryTransaction.findMany({
      where: { created_at: { gte: from, lte: to }, amount: { lt: 0 } },
      select: {
        amount: true,
        created_at: true,
        item: {
          select: {
            id: true,
            name: true,
            internal_code: true,
            uom: true,
            purchase_cost: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    });

    const byItem = new Map<string, {
      id: string;
      name: string;
      internal_code: string;
      uom: string;
      category: string | null;
      quantity: number;
      cost: number;
      movements: number;
    }>();

    for (const row of rows) {
      if (!row.item) continue;
      const current = byItem.get(row.item.id) ?? {
        id: row.item.id,
        name: row.item.name,
        internal_code: row.item.internal_code,
        uom: row.item.uom,
        category: row.item.category?.name ?? null,
        quantity: 0,
        cost: 0,
        movements: 0,
      };
      const quantity = Math.abs(row.amount);
      current.quantity += quantity;
      current.movements += 1;
      current.cost += quantity * (row.item.purchase_cost ?? 0);
      byItem.set(row.item.id, current);
    }

    const items = [...byItem.values()].sort((a, b) => b.cost - a.cost);
    const byCategory = new Map<string, { category: string; quantity: number; cost: number }>();
    for (const item of items) {
      const key = item.category ?? 'Sin categoría';
      const current = byCategory.get(key) ?? { category: key, quantity: 0, cost: 0 };
      current.quantity += item.quantity;
      current.cost += item.cost;
      byCategory.set(key, current);
    }

    res.json({
      from,
      to,
      total_cost: items.reduce((sum, item) => sum + item.cost, 0),
      total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      items: items.slice(0, 50),
      categories: [...byCategory.values()].sort((a, b) => b.cost - a.cost),
    });
  } catch (error) {
    console.error('Error calculando consumo de repuestos:', error);
    res.status(500).json({ error: 'No se pudo calcular el consumo' });
  }
};

/**
 * GET /api/stats/reliability — MTBF, MTTR y disponibilidad por activo.
 * Combina los paros (AssetDowntime) con las OT correctivas del periodo.
 */
export const getReliability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = range(req);
    const periodMs = Math.max(1, to.getTime() - from.getTime());

    const [stops, correctiveOrders] = await Promise.all([
      prisma.assetDowntime.findMany({
        where: { started_at: { gte: from, lte: to } },
        select: { asset_id: true, started_at: true, ended_at: true },
      }),
      prisma.workOrder.findMany({
        where: {
          maintenance_type: 'CORRECTIVO',
          created_at: { gte: from, lte: to },
        },
        select: { asset_id: true, accumulated_time_ms: true, completed_at: true },
      }),
    ]);

    const assets = await prisma.asset.findMany({
      select: { id: true, name: true, internal_code: true, is_critical: true },
    });

    const now = new Date();
    const map = new Map<string, { stops: number; downtimeMs: number; failures: number; repairMs: number }>();
    for (const stop of stops) {
      const current = map.get(stop.asset_id) ?? { stops: 0, downtimeMs: 0, failures: 0, repairMs: 0 };
      current.stops += 1;
      current.downtimeMs += Math.max(0, (stop.ended_at ?? now).getTime() - stop.started_at.getTime());
      map.set(stop.asset_id, current);
    }
    for (const order of correctiveOrders) {
      const current = map.get(order.asset_id) ?? { stops: 0, downtimeMs: 0, failures: 0, repairMs: 0 };
      current.failures += 1;
      current.repairMs += Number(order.accumulated_time_ms ?? 0);
      map.set(order.asset_id, current);
    }

    const rows = assets
      .map((asset) => {
        const data = map.get(asset.id);
        if (!data) return null;
        const uptimeMs = Math.max(0, periodMs - data.downtimeMs);
        const failures = data.failures || data.stops;
        return {
          asset,
          stops: data.stops,
          failures,
          downtime_hours: data.downtimeMs / (60 * 60 * 1000),
          mtbf_hours: failures > 0 ? uptimeMs / failures / (60 * 60 * 1000) : null,
          mttr_hours: failures > 0 ? data.repairMs / failures / (60 * 60 * 1000) : null,
          availability_pct: (uptimeMs / periodMs) * 100,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => (a.mtbf_hours ?? Infinity) - (b.mtbf_hours ?? Infinity));

    res.json({ from, to, assets: rows });
  } catch (error) {
    console.error('Error calculando confiabilidad:', error);
    res.status(500).json({ error: 'No se pudo calcular la confiabilidad' });
  }
};

/**
 * GET /api/stats/costs — costo de las OT del periodo:
 * repuestos consumidos + mano de obra (tiempo acumulado × tarifa promedio de los asignados).
 */
export const getCosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = range(req);

    const orders = await prisma.workOrder.findMany({
      where: { created_at: { gte: from, lte: to } },
      select: {
        id: true,
        folio: true,
        title: true,
        status: true,
        maintenance_type: true,
        accumulated_time_ms: true,
        created_at: true,
        completed_at: true,
        asset: { select: { id: true, name: true, internal_code: true } },
        assigned_technicians: { select: { id: true, name: true, hourly_rate: true } },
      },
    });

    const orderIds = orders.map((order) => order.id);
    const parts = orderIds.length
      ? await prisma.inventoryTransaction.findMany({
          where: { work_order_id: { in: orderIds }, amount: { lt: 0 } },
          select: { work_order_id: true, amount: true, item: { select: { purchase_cost: true } } },
        })
      : [];

    const partsByOrder = new Map<string, number>();
    for (const row of parts) {
      if (!row.work_order_id) continue;
      const cost = Math.abs(row.amount) * (row.item?.purchase_cost ?? 0);
      partsByOrder.set(row.work_order_id, (partsByOrder.get(row.work_order_id) ?? 0) + cost);
    }

    const rows = orders.map((order) => {
      const rates = order.assigned_technicians
        .map((tech) => tech.hourly_rate)
        .filter((rate): rate is number => typeof rate === 'number' && rate > 0);
      const averageRate = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
      const hours = Number(order.accumulated_time_ms ?? 0) / (60 * 60 * 1000);
      const laborCost = hours * averageRate;
      const partsCost = partsByOrder.get(order.id) ?? 0;
      return {
        id: order.id,
        folio: order.folio,
        title: order.title,
        status: order.status,
        maintenance_type: order.maintenance_type,
        asset: order.asset,
        hours,
        average_rate: averageRate,
        labor_cost: laborCost,
        parts_cost: partsCost,
        total_cost: laborCost + partsCost,
        technicians: order.assigned_technicians.map((tech) => tech.name),
        created_at: order.created_at,
        completed_at: order.completed_at,
      };
    }).sort((a, b) => b.total_cost - a.total_cost);

    const byAsset = new Map<string, { asset: { id: string; name: string; internal_code: string }; labor: number; parts: number; total: number; orders: number }>();
    for (const row of rows) {
      const key = row.asset.id;
      const current = byAsset.get(key) ?? { asset: row.asset, labor: 0, parts: 0, total: 0, orders: 0 };
      current.labor += row.labor_cost;
      current.parts += row.parts_cost;
      current.total += row.total_cost;
      current.orders += 1;
      byAsset.set(key, current);
    }

    res.json({
      from,
      to,
      totals: {
        labor: rows.reduce((sum, row) => sum + row.labor_cost, 0),
        parts: rows.reduce((sum, row) => sum + row.parts_cost, 0),
        total: rows.reduce((sum, row) => sum + row.total_cost, 0),
        orders: rows.length,
        hours: rows.reduce((sum, row) => sum + row.hours, 0),
      },
      orders: rows.slice(0, 100),
      assets: [...byAsset.values()].sort((a, b) => b.total - a.total),
    });
  } catch (error) {
    console.error('Error calculando costos de OT:', error);
    res.status(500).json({ error: 'No se pudieron calcular los costos' });
  }
};
