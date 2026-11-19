import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { writeAuditLog } from '../utils/auditLog';

interface IncomingKitItem {
  item_id: string;
  quantity: number;
}

function parseItems(raw: unknown): IncomingKitItem[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: IncomingKitItem[] = [];
  for (const entry of raw) {
    const itemId = String((entry as any)?.item_id ?? '').trim();
    const quantity = Number((entry as any)?.quantity ?? 1);
    if (!itemId || seen.has(itemId)) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    seen.add(itemId);
    items.push({ item_id: itemId, quantity });
  }
  return items;
}

/** GET /api/kits — kits con sus repuestos y existencias. */
export const getKits = async (_req: Request, res: Response): Promise<void> => {
  try {
    const kits = await prisma.kit.findMany({
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
      include: {
        items: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                internal_code: true,
                stock: true,
                qty_mode: true,
                uom: true,
              },
            },
          },
        },
      },
    });

    res.json(kits.map((kit) => ({
      id: kit.id,
      name: kit.name,
      description: kit.description,
      is_active: kit.is_active,
      items: kit.items.map((row) => ({
        id: row.id,
        item_id: row.item_id,
        quantity: row.quantity,
        name: row.item.name,
        internal_code: row.item.internal_code,
        stock: row.item.stock,
        qty_mode: row.item.qty_mode,
        unit: row.item.uom ?? null,
        // Cuántos kits completos se pueden armar con el stock actual.
        available_kits: Math.floor(row.item.stock / (row.quantity || 1)),
      })),
    })));
  } catch (error) {
    console.error('Error listando kits:', error);
    res.status(500).json({ error: 'No se pudieron obtener los kits' });
  }
};

/** POST /api/kits — { name, description?, items: [{ item_id, quantity }] } */
export const createKit = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    if (!name) {
      res.status(400).json({ error: 'Escribe el nombre del kit.' });
      return;
    }
    const existing = await prisma.kit.findUnique({ where: { name } });
    if (existing) {
      res.status(409).json({ error: 'Ya existe un kit con ese nombre.' });
      return;
    }
    const items = parseItems(req.body?.items) ?? [];
    if (items.length === 0) {
      res.status(400).json({ error: 'Agrega al menos un repuesto al kit.' });
      return;
    }

    const created = await prisma.kit.create({
      data: {
        name,
        description: typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 300) : null,
        items: { create: items },
      },
      include: {
        items: {
          include: { item: { select: { id: true, name: true, internal_code: true, stock: true, uom: true } } },
        },
      },
    });
    emitRefresh('refresh_kits');
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando kit:', error);
    res.status(500).json({ error: 'No se pudo crear el kit' });
  }
};

/** PUT /api/kits/:id — { name?, description?, is_active?, items? } */
export const updateKit = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const kit = await prisma.kit.findUnique({ where: { id } });
    if (!kit) {
      res.status(404).json({ error: 'Kit no encontrado' });
      return;
    }

    const data: { name?: string; description?: string | null; is_active?: boolean } = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim() && req.body.name.trim() !== kit.name) {
      const name = req.body.name.trim().slice(0, 60);
      const duplicate = await prisma.kit.findUnique({ where: { name } });
      if (duplicate) {
        res.status(409).json({ error: 'Ya existe un kit con ese nombre.' });
        return;
      }
      data.name = name;
    }
    if (req.body?.description !== undefined) {
      data.description = req.body.description ? String(req.body.description).trim().slice(0, 300) : null;
    }
    if (typeof req.body?.is_active === 'boolean') data.is_active = req.body.is_active;

    const items = parseItems(req.body?.items);
    if (items && items.length === 0 && req.body?.items !== undefined) {
      res.status(400).json({ error: 'Agrega al menos un repuesto al kit.' });
      return;
    }

    if (items) {
      await prisma.$transaction([
        prisma.kitItem.deleteMany({ where: { kit_id: id } }),
        prisma.kitItem.createMany({ data: items.map((item) => ({ ...item, kit_id: id })) }),
      ]);
    }

    const updated = await prisma.kit.update({ where: { id }, data });
    emitRefresh('refresh_kits');
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando kit:', error);
    res.status(500).json({ error: 'No se pudo actualizar el kit' });
  }
};

/** DELETE /api/kits/:id */
export const deleteKit = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const kit = await prisma.kit.findUnique({ where: { id } });
    if (!kit) {
      res.status(404).json({ error: 'Kit no encontrado' });
      return;
    }
    await prisma.kit.delete({ where: { id } });
    emitRefresh('refresh_kits');
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando kit:', error);
    res.status(500).json({ error: 'No se pudo eliminar el kit' });
  }
};

/**
 * GET /api/kits/:id/availability?factor=N — ¿alcanza el stock para N kits?
 * Se usa antes de consumir para avisar qué repuesto falta.
 */
export const getKitAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const factor = Math.max(1, Math.min(100, Number(req.query.factor ?? 1) || 1));

    const kit = await prisma.kit.findUnique({
      where: { id },
      include: { items: { include: { item: { select: { id: true, name: true, stock: true } } } } },
    });
    if (!kit) {
      res.status(404).json({ error: 'Kit no encontrado' });
      return;
    }

    const shortages = kit.items
      .map((row) => {
        const needed = row.quantity * factor;
        return {
          item_id: row.item_id,
          name: row.item.name,
          needed,
          stock: row.item.stock,
          missing: Math.max(0, needed - row.item.stock),
        };
      })
      .filter((row) => row.missing > 0);

    res.json({ ok: shortages.length === 0, factor, shortages });
  } catch (error) {
    console.error('Error verificando disponibilidad del kit:', error);
    res.status(500).json({ error: 'No se pudo verificar la disponibilidad' });
  }
};

/**
 * POST /api/kits/:id/consume — descuenta el kit completo y lo liga a una OT.
 * Body: { work_order_id, quantity? }
 *
 * Todo o nada: si un repuesto no alcanza, no se descuenta ninguno y no queda
 * movimiento de inventario. Cada consumo deja su propio movimiento por repuesto,
 * con el costo congelado al momento del consumo.
 */
export const consumeKit = async (req: Request, res: Response): Promise<void> => {
  const kitId = req.params.id as string;
  const userId = (req as any).user?.userId ?? null;
  const workOrderId = String((req.body as any)?.work_order_id ?? '').trim();
  const rawQuantity = Number((req.body as any)?.quantity ?? 1);
  const quantity = Math.max(1, Math.min(50, Math.round(Number.isFinite(rawQuantity) ? rawQuantity : 1)));

  if (!workOrderId) {
    res.status(400).json({ error: 'Indica la orden de trabajo que consume el kit.' });
    return;
  }

  try {
    const [kit, workOrder] = await Promise.all([
      prisma.kit.findUnique({
        where: { id: kitId },
        include: {
          items: {
            include: {
              item: {
                select: {
                  id: true,
                  name: true,
                  internal_code: true,
                  stock: true,
                  qty_mode: true,
                  purchase_cost: true,
                  uom: true,
                },
              },
            },
          },
        },
      }),
      prisma.workOrder.findUnique({
        where: { id: workOrderId },
        select: { id: true, folio: true, title: true, status: true },
      }),
    ]);

    if (!kit) {
      res.status(404).json({ error: 'Kit no encontrado' });
      return;
    }
    if (!workOrder) {
      res.status(404).json({ error: 'La orden de trabajo no existe' });
      return;
    }
    if (workOrder.status === 'FINALIZADO' || workOrder.status === 'ANULADO') {
      res.status(400).json({ error: 'No se puede consumir un kit en una orden cerrada o anulada.' });
      return;
    }
    if (kit.items.length === 0) {
      res.status(400).json({ error: 'El kit no tiene repuestos configurados.' });
      return;
    }

    const consumed = await prisma.$transaction(
      async (tx) => {
        const rows: Array<{
          item_id: string;
          name: string;
          internal_code: string;
          amount: number;
          unit_cost: number;
          uom: string | null;
          transaction_id: string;
        }> = [];

        for (const kitItem of kit.items) {
          const needed = kitItem.quantity * quantity;

          // Descuento atómico con guarda: si no alcanza, count = 0 y se revierte todo.
          const updated = await tx.item.updateMany({
            where: { id: kitItem.item_id, stock: { gte: needed } },
            data: { stock: { decrement: needed } },
          });
          if (updated.count === 0) {
            throw Object.assign(
              new Error(
                `Stock insuficiente de «${kitItem.item.name}»: se necesitan ${needed} ${kitItem.item.uom ?? ''} y hay ${kitItem.item.stock}.`.replace(/\s+/g, ' ')
              ),
              { status: 409 }
            );
          }

          const unitCost = kitItem.item.purchase_cost ?? 0;
          const transaction = await tx.inventoryTransaction.create({
            data: {
              item_id: kitItem.item_id,
              user_id: userId,
              amount: -needed,
              reason: `Kit «${kit.name}» ×${quantity} · OT ${workOrder.folio}`,
              unit_cost: unitCost,
              work_order_id: workOrder.id,
            },
          });

          rows.push({
            item_id: kitItem.item_id,
            name: kitItem.item.name,
            internal_code: kitItem.item.internal_code,
            amount: needed,
            unit_cost: unitCost,
            uom: kitItem.item.uom ?? null,
            transaction_id: transaction.id,
          });
        }

        return rows;
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    await writeAuditLog({
      userId,
      userName: null,
      action: 'KIT_CONSUMED',
      entity: 'work_order',
      entityId: workOrder.id,
      summary: `Kit «${kit.name}» ×${quantity} consumido en la OT ${workOrder.folio} · ${consumed.length} repuesto(s) descontados`,
      meta: {
        kit_id: kit.id,
        kit_name: kit.name,
        quantity,
        work_order_folio: workOrder.folio,
        items: consumed,
      },
    });

    emitRefresh('refresh_inventory');
    emitRefresh('refresh_work_orders');

    res.status(201).json({
      message: `Kit «${kit.name}» consumido: ${consumed.length} repuesto(s) descontados.`,
      consumed,
    });
  } catch (error: any) {
    if (error?.status === 409) {
      res.status(409).json({ error: error.message });
      return;
    }
    console.error('Error consumiendo kit:', error);
    res.status(500).json({ error: 'No se pudo consumir el kit' });
  }
};