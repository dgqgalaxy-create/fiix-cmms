import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';

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
        expected_date: expected_date ? new Date(expected_date) : null,
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
    const { status } = req.body;
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
    if (status === 'RECIBIDA') {
      updateData.received_at = new Date();
    }

    // Wrap in transaction if we are receiving it, to update inventory stock
    if (status === 'RECIBIDA') {
      await prisma.$transaction(async (tx) => {
        // Update Order
        await tx.purchaseOrder.update({
          where: { id: id },
          data: updateData
        });

        // Loop over items to increase stock and update unit_cost
        for (const orderItem of existingOrder.items) {
          // Increase stock
          await tx.item.update({
            where: { id: orderItem.item_id },
            data: {
              stock: { increment: orderItem.quantity },
              purchase_cost: orderItem.unit_cost // Actualizamos al último precio de compra
            }
          });

          // Register transaction
          await tx.inventoryTransaction.create({
            data: {
              item_id: orderItem.item_id,
              user_id: user_id,
              amount: orderItem.quantity,
              reason: `Recepción de Orden de Compra PO-${existingOrder.folio}`
            }
          });
        }
      });
      emitRefresh('refresh_purchase_orders');
      emitRefresh('refresh_inventory');
      res.json({ message: 'Orden recibida y el inventario ha sido actualizado' });
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
