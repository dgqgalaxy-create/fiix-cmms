import type { Prisma } from '@prisma/client';

export type StockTx = Prisma.TransactionClient;

export type StockConsumeResult = { ok: true } | { ok: false; available: number };

/**
 * Resta `amount` del stock del ítem SOLO si hay suficiente disponible.
 *
 * El UPDATE condicional es atómico: aunque varios procesos retiren el mismo ítem a la
 * vez (cierres de OT, salidas manuales, etc.), la condición `stock >= amount` se evalúa
 * contra el valor vigente bajo bloqueo de fila, por lo que nunca deja el stock negativo
 * (no depende de leer y luego escribir).
 *
 * Devuelve `{ ok: false, available }` cuando no alcanza (available = stock vigente).
 */
export async function tryConsumeStock(
  tx: StockTx,
  itemId: string,
  amount: number
): Promise<StockConsumeResult> {
  const updated = await tx.item.updateMany({
    where: { id: itemId, stock: { gte: amount } },
    data: { stock: { decrement: amount } },
  });
  if (updated.count === 0) {
    const item = await tx.item.findUnique({ where: { id: itemId }, select: { stock: true } });
    return { ok: false, available: item?.stock ?? 0 };
  }
  return { ok: true };
}

/**
 * Suma `amount` al stock del ítem (entradas manuales, recepción de OC, reversiones de
 * movimientos). Devuelve el nuevo stock.
 */
export async function addStock(tx: StockTx, itemId: string, amount: number): Promise<number> {
  const updated = await tx.item.update({
    where: { id: itemId },
    data: { stock: { increment: amount } },
  });
  return updated.stock;
}
