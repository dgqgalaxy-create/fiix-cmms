import prisma from '../config/prisma';

/** Marca que la orden tuvo actividad (comentario, cambio de estado, etc.). */
export async function touchWorkOrderActivity(workOrderId: string): Promise<void> {
  try {
    await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { last_activity_at: new Date() },
      select: { id: true },
    });
  } catch (error) {
    // No debe romper la operación principal.
    console.error('No se pudo marcar la actividad de la OT:', error);
  }
}

/**
 * Agrega `has_updates` a las órdenes: true si tuvieron actividad después de la
 * última vez que este usuario abrió el detalle.
 */
export async function withUnreadState<T extends { id: string; created_at?: Date | string | null }>(
  rows: T[],
  userId: string | undefined
): Promise<(T & { has_updates: boolean })[]> {
  if (!userId || rows.length === 0) {
    return rows.map((row) => ({ ...row, has_updates: false }));
  }

  const views = await prisma.workOrderView.findMany({
    where: { user_id: userId, work_order_id: { in: rows.map((row) => row.id) } },
    select: { work_order_id: true, last_seen_at: true },
  });
  const seenAt = new Map(views.map((view) => [view.work_order_id, view.last_seen_at.getTime()]));

  return rows.map((row) => {
    const activity = (row as any).last_activity_at
      ? new Date((row as any).last_activity_at).getTime()
      : null;
    if (!activity) return { ...row, has_updates: false };
    const baseline = seenAt.get(row.id) ?? 0;
    return { ...row, has_updates: activity > baseline };
  });
}
