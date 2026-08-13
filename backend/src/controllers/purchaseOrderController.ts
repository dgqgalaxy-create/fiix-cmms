import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';
import { parseDateInput } from '../utils/parseDateInput';

const poDetailInclude = {
  vendor: true,
  created_by: {
    select: { id: true, name: true, email: true, role: true },
  },
  items: {
    include: {
      item: true,
    },
  },
  documents: {
    orderBy: { created_at: 'desc' as const },
    include: { uploaded_by: { select: { id: true, name: true } } },
  },
};

export const getPurchaseOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, status, q } = req.query;
    const and: Record<string, unknown>[] = [];

    if (status && status !== 'TODOS') and.push({ status: String(status) });
    if (q) {
      const term = String(q).trim();
      if (term) {
        const folioNum = Number(term.replace(/^po-?/i, ''));
        and.push({
          OR: [
            ...(Number.isFinite(folioNum) && folioNum > 0 ? [{ folio: folioNum }] : []),
            { vendor: { name: { contains: term, mode: 'insensitive' } } },
            { sap_sp_folio: { contains: term, mode: 'insensitive' } },
            { sap_oc_folio: { contains: term, mode: 'insensitive' } },
            {
              items: {
                some: {
                  item: {
                    OR: [
                      { name: { contains: term, mode: 'insensitive' } },
                      { internal_code: { contains: term, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          ],
        });
      }
    }

    const where = and.length ? { AND: and } : {};
    const include = poDetailInclude;
    const orderBy = { created_at: 'desc' as const };
    const wantsPage = page != null || limit != null;

    if (wantsPage) {
      const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
      const [total, orders] = await Promise.all([
        prisma.purchaseOrder.count({ where }),
        prisma.purchaseOrder.findMany({
          where,
          include,
          orderBy,
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({
        data: orders,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      });
      return;
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include,
      orderBy,
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
    const isAdmin = req.user?.role === 'ADMINISTRADOR';

    if (!user_id || !vendor_id || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Faltan datos obligatorios (proveedor e ítems)' });
      return;
    }

    const itemIds = [...new Set(items.map((i: any) => String(i.item_id || '')).filter(Boolean))];
    if (itemIds.length !== items.length) {
      res.status(400).json({ error: 'Hay líneas sin ítem válido' });
      return;
    }

    const catalog = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, purchase_cost: true },
    });
    const byId = new Map(catalog.map((c) => [c.id, c]));
    if (catalog.length !== itemIds.length) {
      res.status(400).json({ error: 'Uno o más ítems no existen en inventario' });
      return;
    }

    const lineData: { item_id: string; quantity: number; unit_cost: number; syncCost?: number }[] = [];
    for (const raw of items) {
      const item_id = String(raw.item_id);
      const quantity = Number(raw.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        res.status(400).json({ error: 'La cantidad de cada línea debe ser mayor a 0' });
        return;
      }
      const catalogCost = byId.get(item_id)?.purchase_cost ?? 0;
      let unit_cost = catalogCost;
      if (isAdmin) {
        const clientCost = Number(raw.unit_cost);
        if (Number.isFinite(clientCost) && clientCost >= 0) {
          unit_cost = clientCost;
        }
      }
      lineData.push({
        item_id,
        quantity,
        unit_cost,
        syncCost: isAdmin && unit_cost !== catalogCost ? unit_cost : undefined,
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      for (const line of lineData) {
        if (line.syncCost !== undefined) {
          await tx.item.update({
            where: { id: line.item_id },
            data: { purchase_cost: line.syncCost },
          });
        }
      }
      return tx.purchaseOrder.create({
        data: {
          vendor_id,
          created_by_id: user_id,
          // Admin crea ya aprobada (sin paso de aprobación). Gestionador queda en borrador.
          status: isAdmin ? 'APROBADA' : 'BORRADOR',
          expected_date: expected_date ? parseDateInput(expected_date) : null,
          items: {
            create: lineData.map(({ item_id, quantity, unit_cost }) => ({
              item_id,
              quantity,
              unit_cost,
            })),
          },
        },
        include: poDetailInclude,
      });
    });

    emitRefresh('refresh_purchase_orders');
    emitRefresh('refresh_inventory');
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Error al crear la orden de compra' });
  }
};

/** Actualiza SP (SAP), OC (SAP) y fecha estimada. */
export const updatePurchaseOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { sap_sp_folio, sap_oc_folio, expected_date } = req.body ?? {};

    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Orden de compra no encontrada' });
      return;
    }

    const data: {
      sap_sp_folio?: string | null;
      sap_oc_folio?: string | null;
      expected_date?: Date | null;
    } = {};

    if (sap_sp_folio !== undefined) {
      const v = sap_sp_folio == null ? '' : String(sap_sp_folio).trim();
      data.sap_sp_folio = v || null;
    }
    if (sap_oc_folio !== undefined) {
      const v = sap_oc_folio == null ? '' : String(sap_oc_folio).trim();
      data.sap_oc_folio = v || null;
    }
    if (expected_date !== undefined) {
      if (expected_date === null || expected_date === '') {
        data.expected_date = null;
      } else {
        data.expected_date = parseDateInput(String(expected_date));
      }
    }

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'Indica sap_sp_folio, sap_oc_folio o expected_date' });
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data,
      include: poDetailInclude,
    });

    emitRefresh('refresh_purchase_orders');
    res.json(updated);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Error al actualizar la orden de compra' });
  }
};

export const uploadPurchaseOrderDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const docTypeRaw = String(req.body?.doc_type || '').toUpperCase();
    const file = req.file;

    if (!['SP', 'OC', 'OTRO'].includes(docTypeRaw)) {
      res.status(400).json({ error: 'doc_type debe ser SP, OC u OTRO' });
      return;
    }
    if (!file) {
      res.status(400).json({ error: 'Adjunta un archivo (PDF o Word)' });
      return;
    }

    const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Orden de compra no encontrada' });
      return;
    }

    const doc = await prisma.purchaseOrderDocument.create({
      data: {
        purchase_order_id: id,
        doc_type: docTypeRaw as 'SP' | 'OC' | 'OTRO',
        file_url: `/uploads/purchase-orders/${file.filename}`,
        file_name: file.originalname || file.filename,
        uploaded_by_id: userId || null,
      },
      include: { uploaded_by: { select: { id: true, name: true } } },
    });

    emitRefresh('refresh_purchase_orders');
    res.status(201).json(doc);
  } catch (error) {
    console.error('Error uploading purchase order document:', error);
    res.status(500).json({ error: 'Error al subir el documento' });
  }
};

export const deletePurchaseOrderDocument = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const docId = req.params.docId as string;

    const doc = await prisma.purchaseOrderDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.purchase_order_id !== id) {
      res.status(404).json({ error: 'Documento no encontrado' });
      return;
    }

    await prisma.purchaseOrderDocument.delete({ where: { id: docId } });

    if (doc.file_url?.includes('/uploads/')) {
      const abs = path.join(__dirname, '../..', doc.file_url.replace(/^\//, ''));
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch (err) {
        console.warn('No se pudo borrar archivo de OC:', abs, err);
      }
    }

    emitRefresh('refresh_purchase_orders');
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting purchase order document:', error);
    res.status(500).json({ error: 'Error al eliminar el documento' });
  }
};

/**
 * Actualiza costos unitarios de un borrador:
 * - sync_from_inventory: toma purchase_cost actual del catálogo (cualquier rol con compras).
 * - items[{id, unit_cost}]: solo Admin; además guarda el nuevo costo en el ítem de inventario.
 */
export const updatePurchaseOrderLineCosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user_id = req.user?.userId;
    const isAdmin = req.user?.role === 'ADMINISTRADOR';
    const syncFromInventory = Boolean(req.body?.sync_from_inventory);
    const itemsPayload = Array.isArray(req.body?.items) ? req.body.items : null;

    if (!user_id) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: { include: { item: { select: { id: true, purchase_cost: true } } } },
      },
    });

    if (!order) {
      res.status(404).json({ error: 'Orden de compra no encontrada' });
      return;
    }
    if (order.status !== 'BORRADOR') {
      res.status(400).json({
        error:
          order.status === 'RECIBIDA' || order.status === 'CANCELADA'
            ? 'Esta orden ya está cerrada: el precio de compra quedó congelado y no cambia aunque actualices el inventario'
            : 'Solo se pueden actualizar precios en órdenes en borrador. Aprobadas/enviadas mantienen el costo congelado de la compra',
      });
      return;
    }

    if (!syncFromInventory && !itemsPayload) {
      res.status(400).json({ error: 'Indica sync_from_inventory o items con unit_cost' });
      return;
    }

    if (itemsPayload && !isAdmin) {
      res.status(403).json({
        error: 'Solo un Administrador puede modificar el costo unitario de la compra',
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      if (syncFromInventory) {
        for (const line of order.items) {
          const cost = line.item?.purchase_cost ?? 0;
          await tx.purchaseOrderItem.update({
            where: { id: line.id },
            data: { unit_cost: cost },
          });
        }
        return;
      }

      for (const raw of itemsPayload as any[]) {
        const lineId = String(raw.id || '');
        const unit_cost = Number(raw.unit_cost);
        if (!lineId || !Number.isFinite(unit_cost) || unit_cost < 0) {
          throw Object.assign(new Error('Costo unitario inválido'), { status: 400 });
        }
        const line = order.items.find((i) => i.id === lineId);
        if (!line) {
          throw Object.assign(new Error('Línea no pertenece a esta orden'), { status: 400 });
        }
        await tx.purchaseOrderItem.update({
          where: { id: lineId },
          data: { unit_cost },
        });
        await tx.item.update({
          where: { id: line.item_id },
          data: { purchase_cost: unit_cost },
        });
      }
    });

    const updated = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: poDetailInclude,
    });

    emitRefresh('refresh_purchase_orders');
    emitRefresh('refresh_inventory');
    res.json(updated);
  } catch (error: any) {
    if (error?.status === 400) {
      res.status(400).json({ error: error.message });
      return;
    }
    console.error('Error updating PO line costs:', error);
    res.status(500).json({ error: 'Error al actualizar los costos de la orden' });
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

    // Evitar duplicar líneas ya presentes en OC abiertas (borrador/aprobada/enviada)
    const openPoLines = await prisma.purchaseOrderItem.findMany({
      where: {
        purchase_order: { status: { in: ['BORRADOR', 'APROBADA', 'ENVIADA'] } },
        item_id: { in: critical.map((c) => c.id) },
      },
      select: { item_id: true },
    });
    const alreadyOnOpenPo = new Set(openPoLines.map((l) => l.item_id));

    const skippedAlreadyOnPo: Array<{ id: string; internal_code: string; name: string }> = [];
    const skippedNoVendor: Array<{ id: string; internal_code: string; name: string }> = [];
    const byVendor = new Map<string, typeof critical>();

    for (const item of critical) {
      if (alreadyOnOpenPo.has(item.id)) {
        skippedAlreadyOnPo.push({
          id: item.id,
          internal_code: item.internal_code,
          name: item.name,
        });
        continue;
      }
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
        error:
          skippedAlreadyOnPo.length > 0 && skippedNoVendor.length === 0
            ? 'Todos los ítems críticos ya están en una OC abierta (borrador/aprobada/enviada).'
            : 'Los ítems en stock crítico no tienen proveedor asignado o ya están en OC abiertas. Revisa el catálogo e intenta de nuevo.',
        skipped_no_vendor: skippedNoVendor,
        skipped_already_on_po: skippedAlreadyOnPo,
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
              create: items.map((item) => {
                let qty = Math.max(item.minimum_inventory - item.stock, 1);
                if (item.qty_mode === 'INTEGER') {
                  qty = Math.max(Math.ceil(qty), 1);
                }
                return {
                  item_id: item.id,
                  quantity: qty,
                  unit_cost: item.purchase_cost ?? 0,
                };
              }),
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
      skipped_already_on_po: skippedAlreadyOnPo,
      summary: {
        drafts: created.length,
        items_included: created.reduce((sum, o) => sum + o.items.length, 0),
        items_skipped: skippedNoVendor.length + skippedAlreadyOnPo.length,
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

    // Solo Admin aprueba. Gestionador no puede autoaprobar ni aprobar borradores ajenos.
    if (status === 'APROBADA' && req.user?.role !== 'ADMINISTRADOR') {
      res.status(403).json({
        error: 'Solo un Administrador puede aprobar órdenes de compra',
      });
      return;
    }

    // Admin y Gestionador pueden recibir; Técnico no.
    if (status === 'RECIBIDA' && req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'GESTIONADOR') {
      res.status(403).json({ error: 'No tienes permisos para recibir órdenes de compra' });
      return;
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
                unit_cost: orderItem.unit_cost,
                reason: `Recepción de Orden de Compra PO-${existingOrder.folio} (pedido: ${orderItem.quantity}, recibido: ${receivedQty})`,
                created_at: receivedAt!,
              },
            });
          }
        }

        return tx.purchaseOrder.findUnique({
          where: { id },
          include: poDetailInclude,
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
      include: poDetailInclude,
    });

    emitRefresh('refresh_purchase_orders');
    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({ error: 'Error al actualizar el estado de la orden' });
  }
};
