import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { parseDateInput } from '../utils/parseDateInput';

export const getPurchaseOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        vendor: true,
        created_by: {
          select: { id: true, name: true, email: true, role: true }
        },
        items: {
          include: {
            item: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Error al obtener las órdenes de compra' });
  }
};

export const createPurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { vendor_id, expected_date, items } = req.body;
    const user_id = req.user?.userId;

    if (!user_id || !vendor_id || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Faltan datos obligatorios (proveedor e ítems)' });
      return;
    }

    const order = await prisma.purchaseOrder.create({
      data: {
        vendor_id,
        created_by_id: user_id,
        // yyyy-MM-dd del <input type="date">: local noon (no UTC midnight → día anterior en MX)
        expected_date: expected_date ? parseDateInput(expected_date) : null,
        items: {
          create: items.map((i: any) => ({
            item_id: i.item_id,
            quantity: i.quantity,
            unit_cost: i.unit_cost || 0
          }))
        }
      },
      include: {
        vendor: true,
        items: { include: { item: true } }
      }
    });

    emitRefresh('refresh_purchase_orders');
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Error al crear la orden de compra' });
  }
};

/** Crea borradores de OC agrupados por proveedor con ítems bajo stock mínimo. */
export const createDraftsFromLowStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user_id = req.user?.userId;
    if (!user_id) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const critical = (await prisma.item.findMany({
      where: { is_active: true },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    })).filter((item) => item.stock <= item.minimum_inventory);

    if (critical.length === 0) {
      res.status(400).json({ error: 'No hay ítems activos con stock crítico' });
      return;
    }

    const skippedNoVendor: Array<{ id: string; internal_code: string; name: string }> = [];
    const byVendor = new Map<string, typeof critical>();

    for (const item of critical) {
      if (!item.vendor_id) {
        skippedNoVendor.push({
          id: item.id,
          internal_code: item.internal_code,
          name: item.name,
        });
        continue;
      }
      const list = byVendor.get(item.vendor_id) || [];
      list.push(item);
      byVendor.set(item.vendor_id, list);
    }

    if (byVendor.size === 0) {
      res.status(400).json({
        error: 'Los ítems en stock crítico no tienen proveedor asignado. Asigna proveedor en el catálogo e intenta de nuevo.',
        skipped_no_vendor: skippedNoVendor,
      });
      return;
    }

    const created = await prisma.$transaction(async (tx) => {
      const orders = [];
      for (const [vendorId, items] of byVendor.entries()) {
        const order = await tx.purchaseOrder.create({
          data: {
            vendor_id: vendorId,
            created_by_id: user_id,
            status: 'BORRADOR',
            items: {
              create: items.map((item) => ({
                item_id: item.id,
                quantity: Math.max(item.minimum_inventory - item.stock, 1),
                unit_cost: item.purchase_cost ?? 0,
              })),
            },
          },
          include: {
            vendor: { select: { id: true, name: true } },
            items: { include: { item: { select: { id: true, name: true, internal_code: true, uom: true } } } },
          },
        });
        orders.push(order);
      }
      return orders;
    });

    emitRefresh('refresh_purchase_orders');
    res.status(201).json({
      created,
      skipped_no_vendor: skippedNoVendor,
      summary: {
        drafts: created.length,
        items_included: created.reduce((sum, o) => sum + o.items.length, 0),
        items_skipped: skippedNoVendor.length,
      },
    });
  } catch (error) {
    console.error('Error creating draft POs from low stock:', error);
    res.status(500).json({ error: 'Error al generar borradores de orden de compra' });
  }
};

export const updatePurchaseOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status, received_items } = req.body;
    const user_id = req.user?.userId;

    if (!user_id) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    // Only Admin and Gestionador can approve or receive
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'GESTIONADOR') {
      if (status === 'APROBADA' || status === 'RECIBIDA') {
        res.status(403).json({ error: 'No tienes permisos para aprobar o recibir órdenes de compra' });
        return;
      }
    }

    const existingOrder = await prisma.purchaseOrder.findUnique({
      where: { id: id },
      include: { items: true }
    });

    if (!existingOrder) {
      res.status(404).json({ error: 'Orden de compra no encontrada' });
      return;
    }

    if (existingOrder.status === 'RECIBIDA' || existingOrder.status === 'CANCELADA') {
      res.status(400).json({ error: 'La orden ya está cerrada o cancelada' });
      return;
    }

    const updateData: any = { status };
    // Momento real de recepción (puede ser antes de la fecha pactada / expected_date).
    const receivedAt = status === 'RECIBIDA' ? new Date() : null;
    if (receivedAt) {
      updateData.received_at = receivedAt;
    }

    // Wrap in transaction if we are receiving it, to update inventory stock
    if (status === 'RECIBIDA') {
      // Map optional per-line received quantities (fallback = ordered quantity).
      const receivedMap = new Map<string, number>();
      if (Array.isArray(received_items)) {
        for (const row of received_items) {
          const lineId = typeof row?.id === 'string' ? row.id : null;
          const qty = Number(row?.received_quantity);
          if (!lineId) {
            res.status(400).json({ error: 'Cada ítem recibido debe incluir id de línea' });
            return;
          }
          if (!Number.isFinite(qty) || qty < 0) {
            res.status(400).json({ error: 'received_quantity debe ser un número ≥ 0' });
            return;
          }
          const belongs = existingOrder.items.some((i) => i.id === lineId);
          if (!belongs) {
            res.status(400).json({ error: 'Hay líneas que no pertenecen a esta orden de compra' });
            return;
          }
          receivedMap.set(lineId, qty);
        }
      }

      const updatedOrder = await prisma.$transaction(async (tx) => {
        await tx.purchaseOrder.update({
          where: { id: id },
          data: updateData
        });

        for (const orderItem of existingOrder.items) {
          const receivedQty = receivedMap.has(orderItem.id)
            ? (receivedMap.get(orderItem.id) as number)
            : orderItem.quantity;

          await tx.purchaseOrderItem.update({
            where: { id: orderItem.id },
            data: { received_quantity: receivedQty },
          });

          if (receivedQty > 0) {
            await tx.item.update({
              where: { id: orderItem.item_id },
              data: {
                stock: { increment: receivedQty },
                purchase_cost: orderItem.unit_cost,
              },
            });

            // Fecha del movimiento = instante de recepción (no la fecha pactada de la OC).
            await tx.inventoryTransaction.create({
              data: {
                item_id: orderItem.item_id,
                user_id: user_id,
                amount: receivedQty,
                reason: `Recepción de Orden de Compra PO-${existingOrder.folio} (pedido: ${orderItem.quantity}, recibido: ${receivedQty})`,
                created_at: receivedAt!,
              },
            });
          }
        }

        return tx.purchaseOrder.findUnique({
          where: { id },
          include: {
            vendor: true,
            created_by: { select: { id: true, name: true, email: true, role: true } },
            items: { include: { item: true } },
          },
        });
      });

      emitRefresh('refresh_purchase_orders');
      emitRefresh('refresh_inventory');
      res.json(updatedOrder);
      return;
    }

    // If not receiving, just update the status
    const updatedOrder = await prisma.purchaseOrder.update({
      where: { id: id },
      data: updateData,
      include: {
        vendor: true,
        items: { include: { item: true } }
      }
    });

    emitRefresh('refresh_purchase_orders');
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({ error: 'Error al actualizar el estado de la orden' });
  }
};
