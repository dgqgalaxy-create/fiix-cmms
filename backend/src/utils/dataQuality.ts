import prisma from '../config/prisma';
import { writeAuditLog } from './auditLog';

/**
 * Centro de calidad de datos (solo lectura): detecta problemas accionables.
 *  1) Diferencias de inventario: stock del ítem vs saldo de sus movimientos.
 *  2) Repuestos sin precio (purchase_cost nulo/0) que tienen movimiento o stock.
 *  3) Fotos faltantes: órdenes FINALIZADO sin foto «después» (evidencia).
 *  4) Tiempos atípicos: labor acumulada o vida total de la OT fuera de rango.
 * Las correcciones se hacen con las herramientas existentes (registrar movimiento/
 * reversión, editar repuesto, adjuntar foto) para conservar trazabilidad.
 */

export const DATA_QUALITY_LIMITS = {
  maxRowsPerSection: 50,
  /** Labor acumulada (ms) que se considera atípica: > 3 días. */
  laborMsAtypical: 3 * 86_400_000,
  /** Tiempo total creado→finalizado que se considera atípico: > 30 días. */
  lifespanMsAtypical: 30 * 86_400_000,
};

export type QualityRow = { id: string; label: string; detail: string; amount: number };

export type DataQualityReport = {
  generatedAt: string;
  counts: { stockMismatches: number; noPrice: number; photosMissing: number; atypicalTimes: number };
  items: {
    stockMismatches: QualityRow[];
    noPrice: QualityRow[];
    photosMissing: QualityRow[];
    atypicalTimes: QualityRow[];
  };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function buildDataQualityReport(): Promise<DataQualityReport> {
  const { maxRowsPerSection, laborMsAtypical, lifespanMsAtypical } = DATA_QUALITY_LIMITS;

  // ---- 1) Stock vs saldo de movimientos ----
  const stockMismatches: QualityRow[] = [];
  {
    const items = await prisma.item.findMany({
      select: { id: true, internal_code: true, name: true, stock: true },
    });
    const balances = await prisma.inventoryTransaction.groupBy({
      by: ['item_id'],
      _sum: { amount: true },
    });
    const balanceByItem = new Map(balances.map((b) => [b.item_id, b._sum.amount ?? 0]));
    for (const it of items) {
      const ledger = balanceByItem.get(it.id) ?? 0;
      const delta = round2(it.stock - ledger);
      if (Math.abs(delta) > 0.009) {
        stockMismatches.push({
          id: it.id,
          label: `${it.internal_code} · ${it.name}`,
          detail: `stock ${round2(it.stock)} vs movimientos ${round2(ledger)} (diferencia ${delta})`,
          amount: delta,
        });
      }
    }
    stockMismatches.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }

  // ---- 2) Repuestos sin precio ----
  const noPrice: QualityRow[] = [];
  {
    const items = await prisma.item.findMany({
      select: {
        id: true,
        internal_code: true,
        name: true,
        purchase_cost: true,
        stock: true,
        _count: { select: { inventory_transactions: true } },
      },
      where: { OR: [{ purchase_cost: null }, { purchase_cost: 0 }] },
      orderBy: { internal_code: 'asc' },
      take: maxRowsPerSection,
    });
    for (const it of items) {
      if (it._count.inventory_transactions === 0 && it.stock <= 0) continue; // irrelevante
      noPrice.push({
        id: it.id,
        label: `${it.internal_code} · ${it.name}`,
        detail: `sin precio (stock ${round2(it.stock)}, ${it._count.inventory_transactions} movimientos)`,
        amount: it._count.inventory_transactions,
      });
    }
    noPrice.sort((a, b) => b.amount - a.amount);
  }

  // ---- 3) Fotos faltantes: FINALIZADO sin foto «después» ----
  const photosMissing: QualityRow[] = [];
  {
    const wos = await prisma.workOrder.findMany({
      where: { status: 'FINALIZADO', after_image_url: null },
      select: { id: true, folio: true, title: true, completed_at: true },
      orderBy: { folio: 'desc' },
      take: maxRowsPerSection,
    });
    for (const wo of wos) {
      photosMissing.push({
        id: wo.id,
        label: `FOL-${String(wo.folio).padStart(4, '0')} · ${wo.title}`,
        detail: `finalizada ${wo.completed_at?.toISOString()?.slice(0, 10) ?? 's/fecha'} sin foto «después»`,
        amount: 0,
      });
    }
  }

  // ---- 4) Tiempos atípicos ----
  const atypicalTimes: QualityRow[] = [];
  {
    const wos = await prisma.workOrder.findMany({
      where: { status: 'FINALIZADO', completed_at: { not: null } },
      select: {
        id: true,
        folio: true,
        title: true,
        created_at: true,
        completed_at: true,
        accumulated_time_ms: true,
      },
      orderBy: { folio: 'desc' },
    });
    for (const wo of wos) {
      const created = wo.created_at?.getTime() ?? wo.completed_at!.getTime();
      const lifespan = Math.max(0, wo.completed_at!.getTime() - created);
      const laborH = round2((wo.accumulated_time_ms ?? 0) / 3_600_000);
      const lifespanDays = round2(lifespan / 86_400_000);
      const isLabor = (wo.accumulated_time_ms ?? 0) > laborMsAtypical;
      const isLife = lifespan > lifespanMsAtypical;
      if (!isLabor && !isLife) continue;
      atypicalTimes.push({
        id: wo.id,
        label: `FOL-${String(wo.folio).padStart(4, '0')} · ${wo.title}`,
        detail: `${isLabor ? `labor ${laborH} h` : ''}${isLabor && isLife ? ' · ' : ''}${
          isLife ? `vida total ${lifespanDays} días` : ''
        }`,
        amount: isLabor ? wo.accumulated_time_ms ?? 0 : lifespan,
      });
    }
    atypicalTimes.sort((a, b) => b.amount - a.amount);
  }

  const cap = (rows: QualityRow[]) => rows.slice(0, maxRowsPerSection);
  const sections = {
    stockMismatches: cap(stockMismatches),
    noPrice: cap(noPrice),
    photosMissing: cap(photosMissing),
    atypicalTimes: cap(atypicalTimes),
  };

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      stockMismatches: stockMismatches.length,
      noPrice: noPrice.length,
      photosMissing: photosMissing.length,
      atypicalTimes: atypicalTimes.length,
    },
    items: sections,
  };
}

/**
 * Corrección 1: alinea el stock del ítem con el saldo de sus movimientos (la fuente
 * fiable es el historial). Audita antes/después. No crea movimientos (un movimiento
 * cambiaría también el saldo y no corregiría la diferencia).
 */
export async function fixStockToLedger(
  itemId: string,
  opts?: { reason?: string | null; actorId?: string | null; actorName?: string | null }
): Promise<{ before: number; after: number; ledger: number }> {
  const balance = await prisma.inventoryTransaction.aggregate({
    where: { item_id: itemId },
    _sum: { amount: true },
  });
  const ledger = Math.round((balance._sum.amount ?? 0) * 100) / 100;

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('ITEM_NOT_FOUND');
    const before = Math.round(item.stock * 100) / 100;
    if (Math.abs(before - ledger) < 0.009) return { before, after: before };
    const after = await tx.item.update({
      where: { id: itemId },
      data: { stock: ledger },
      select: { stock: true },
    });
    return { before, after: Math.round(after.stock * 100) / 100 };
  });

  const reason = opts?.reason?.trim() || 'Corrección de saldo desde el centro de calidad de datos';
  await writeAuditLog({
    userId: opts?.actorId ?? null,
    userName: opts?.actorName ?? null,
    action: 'INVENTORY_STOCK_CORRECTION',
    entity: 'inventory',
    entityId: itemId,
    summary: `Stock corregido: ${updated.before} → ${updated.after} (saldo de movimientos) · ${reason}`,
    meta: { item_id: itemId, before: updated.before, after: updated.after, motivo: reason },
  });
  return { ...updated, ledger };
}

/** Corrección 2: asigna un precio (purchase_cost) a un repuesto que no lo tenía. Audita antes/después. */
export async function fixItemPrice(
  itemId: string,
  price: number,
  opts?: { reason?: string | null; actorId?: string | null; actorName?: string | null }
): Promise<{ before: number | null; after: number }> {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('El precio debe ser un número mayor a 0');
  }
  const normalized = Math.round(price * 100) / 100;

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({ where: { id: itemId } });
    if (!item) throw new Error('ITEM_NOT_FOUND');
    const before = item.purchase_cost;
    const afterItem = await tx.item.update({
      where: { id: itemId },
      data: { purchase_cost: normalized },
      select: { purchase_cost: true },
    });
    return { before, after: afterItem.purchase_cost ?? normalized };
  });

  const reason = opts?.reason?.trim() || 'Precio asignado desde el centro de calidad de datos';
  await writeAuditLog({
    userId: opts?.actorId ?? null,
    userName: opts?.actorName ?? null,
    action: 'ITEM_PRICE_CORRECTION',
    entity: 'inventory',
    entityId: itemId,
    summary: `Precio del repuesto: ${updated.before ?? 'sin precio'} → ${updated.after} · ${reason}`,
    meta: { item_id: itemId, before: updated.before, after: updated.after, motivo: reason },
  });
  return updated;
}
