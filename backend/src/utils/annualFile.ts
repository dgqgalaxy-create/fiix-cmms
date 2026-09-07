import prisma from '../config/prisma';
import { plantWallClockToDate } from './plantTimezone';

/**
 * Expediente anual: órdenes del año (con fotos) y sus consumos de refacciones,
 * con límites de año en hora de planta (America/Mexico_City).
 * Solo lectura; NUNCA modifica datos.
 */
export type AnnualConsumptionRow = {
  work_order_folio: number;
  work_order_title: string;
  asset_name: string | null;
  item_code: string;
  item_name: string;
  amount: number;
  unit_cost: number | null;
  created_at: string;
};

export type AnnualOrderRow = {
  folio: number;
  title: string;
  status: string;
  priority: string;
  maintenance_type: string;
  machine_stopped: boolean;
  asset_name: string | null;
  asset_code: string | null;
  zone_name: string | null;
  requester_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  labor_minutes: number;
  resolution_notes: string | null;
  created_by_name: string | null;
  photo_before: string | null;
  photo_after: string | null;
  photo_request: string | null;
};

export type AnnualFileData = {
  year: number;
  period: { start: string; end: string };
  counts: { orders: number; consumptions: number; photos: number };
  orders: AnnualOrderRow[];
  consumptions: AnnualConsumptionRow[];
  /** URLs de fotos (evidencia) de las órdenes del año. */
  photos: string[];
};

export async function buildAnnualFileData(year: number): Promise<AnnualFileData> {
  const start = plantWallClockToDate(year, 1, 1);
  const rawEnd = plantWallClockToDate(year + 1, 1, 1);
  if (!start || !rawEnd) {
    throw new Error(`Año inválido: ${year}`);
  }
  const end = new Date(rawEnd.getTime() - 1);

  const orders = await prisma.workOrder.findMany({
    where: { created_at: { gte: start, lte: end } },
    include: {
      asset: { select: { id: true, name: true, internal_code: true } },
      zone: { select: { name: true } },
      created_by: { select: { name: true } },
    },
    orderBy: { folio: 'asc' },
  });

  const orderRows: AnnualOrderRow[] = orders.map((wo) => ({
    folio: wo.folio,
    title: wo.title,
    status: wo.status,
    priority: wo.priority,
    maintenance_type: wo.maintenance_type,
    machine_stopped: wo.machine_stopped,
    asset_name: wo.asset?.name ?? null,
    asset_code: wo.asset?.internal_code ?? null,
    zone_name: wo.zone?.name ?? null,
    requester_name: wo.requester_name,
    created_at: wo.created_at.toISOString(),
    started_at: wo.started_at?.toISOString() ?? null,
    completed_at: wo.completed_at?.toISOString() ?? null,
    labor_minutes: Math.round(wo.accumulated_time_ms / 60000),
    resolution_notes: wo.resolution_notes,
    created_by_name: wo.created_by?.name ?? null,
    photo_before: wo.before_image_url,
    photo_after: wo.after_image_url,
    photo_request: wo.request_image_url,
  }));

  const photos = [
    ...orders.map((o) => o.request_image_url),
    ...orders.map((o) => o.before_image_url),
    ...orders.map((o) => o.after_image_url),
  ].filter((u): u is string => !!u && u.trim() !== '');

  const consumptions = await prisma.inventoryTransaction.findMany({
    where: { created_at: { gte: start, lte: end }, amount: { lt: 0 } },
    include: { item: true, work_order: { include: { asset: { select: { name: true } } } } },
    orderBy: { created_at: 'asc' },
  });

  // Solo consumos ligados a órdenes del año (o cualquier consumo OT en el periodo).
  const consumptionRows: AnnualConsumptionRow[] = consumptions.map((tx) => ({
    work_order_folio: tx.work_order?.folio ?? 0,
    work_order_title: tx.work_order?.title ?? '',
    asset_name: tx.work_order?.asset?.name ?? null,
    item_code: tx.item?.internal_code ?? '',
    item_name: tx.item?.name ?? '',
    amount: Math.abs(tx.amount),
    unit_cost: tx.unit_cost ?? null,
    created_at: tx.created_at.toISOString(),
  }));

  return {
    year,
    period: { start: start.toISOString(), end: end.toISOString() },
    counts: {
      orders: orderRows.length,
      consumptions: consumptionRows.length,
      photos: photos.length,
    },
    orders: orderRows,
    consumptions: consumptionRows,
    photos,
  };
}
