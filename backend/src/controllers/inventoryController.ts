import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { generateInventoryCode } from '../utils/codeGenerator';
import { imageSearch } from '@mudbill/duckduckgo-images-api';
import axios from 'axios';
import { emitRefresh } from '../utils/socket';
import { writeAuditLog } from '../utils/auditLog';
import { parseQty } from '../utils/qtyMode';

// ==========================================
// ITEM CATEGORY
// ==========================================
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.itemCategory.findMany();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, is_active } = req.body;
    const internal_id = await generateInventoryCode('ItemCategory', 'CAT-', 3);
    const category = await prisma.itemCategory.create({
      data: { internal_id, name, is_active }
    });
    emitRefresh('refresh_inventory');
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, is_active } = req.body;
    const category = await prisma.itemCategory.update({
      where: { id },
      data: { name, is_active }
    });
    emitRefresh('refresh_inventory');
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const itemsCount = await prisma.item.count({ where: { category_id: id } });
    if (itemsCount > 0) {
      res.status(400).json({ error: `No puedes eliminar esta categoría porque tiene ${itemsCount} repuesto(s) asociado(s). Reasígnalos primero.` });
      return;
    }
    await prisma.itemCategory.delete({ where: { id } });
    emitRefresh('refresh_inventory');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
};

// ==========================================
// ITEM LOCATION
// ==========================================
export const getLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const locations = await prisma.itemLocation.findMany();
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ubicaciones' });
  }
};

export const createLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, is_active } = req.body;
    const internal_id = await generateInventoryCode('ItemLocation', 'LOC-', 3);
    const location = await prisma.itemLocation.create({
      data: { internal_id, name, is_active }
    });
    emitRefresh('refresh_inventory');
    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear ubicación' });
  }
};

export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, is_active } = req.body;
    const location = await prisma.itemLocation.update({
      where: { id },
      data: { name, is_active }
    });
    emitRefresh('refresh_inventory');
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar ubicación' });
  }
};

export const deleteLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const itemsCount = await prisma.item.count({ where: { location_id: id } });
    if (itemsCount > 0) {
      res.status(400).json({ error: `No puedes eliminar esta ubicación porque tiene ${itemsCount} repuesto(s) asociado(s). Reasígnalos primero.` });
      return;
    }
    await prisma.itemLocation.delete({ where: { id } });
    emitRefresh('refresh_inventory');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar ubicación' });
  }
};

// ==========================================
// VENDOR
// ==========================================
export const getVendors = async (req: Request, res: Response): Promise<void> => {
  try {
    const vendors = await prisma.vendor.findMany();
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
};

export const createVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, website_url, phone, email, address, is_active, logo_url } = req.body;
    const internal_id = await generateInventoryCode('Vendor', 'PROV-', 3);
    const data: {
      internal_id: string;
      name: string;
      website_url?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      is_active: boolean;
      logo_url?: string | null;
    } = {
      internal_id,
      name,
      website_url: website_url || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      is_active:
        is_active === undefined || is_active === ''
          ? true
          : is_active === true || is_active === 'true',
    };
    if (typeof logo_url === 'string' && logo_url.trim()) {
      data.logo_url = logo_url.trim();
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files?.['logo']?.[0]) {
      data.logo_url = `/uploads/vendors/${files['logo'][0].filename}`;
    }
    const vendor = await prisma.vendor.create({ data });
    emitRefresh('refresh_inventory');
    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
};

export const updateVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, website_url, phone, email, address, is_active, logo_url } = req.body;
    const data: {
      name?: string;
      website_url?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      is_active?: boolean;
      logo_url?: string | null;
    } = {};
    if (name !== undefined) data.name = name;
    if (website_url !== undefined) data.website_url = website_url || null;
    if (phone !== undefined) data.phone = phone || null;
    if (email !== undefined) data.email = email || null;
    if (address !== undefined) data.address = address || null;
    if (is_active !== undefined && is_active !== '') {
      data.is_active = is_active === true || is_active === 'true';
    }
    if (typeof logo_url === 'string') {
      data.logo_url = logo_url.trim() || null;
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files?.['logo']?.[0]) {
      data.logo_url = `/uploads/vendors/${files['logo'][0].filename}`;
    }
    const vendor = await prisma.vendor.update({
      where: { id },
      data,
    });
    emitRefresh('refresh_inventory');
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
};

export const deleteVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const itemsCount = await prisma.item.count({ where: { vendor_id: id } });
    if (itemsCount > 0) {
      res.status(400).json({ error: `No puedes eliminar este proveedor porque tiene ${itemsCount} repuesto(s) asociado(s). Reasígnalos primero.` });
      return;
    }
    await prisma.vendor.delete({ where: { id } });
    emitRefresh('refresh_inventory');
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
};

// ==========================================
// ITEM (REPUESTOS)
// ==========================================
export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, q, categoryId, locationId, vendorId, critical, criticalAsset, noVendor } = req.query;
    const and: Record<string, unknown>[] = [];
    if (categoryId) and.push({ category_id: String(categoryId) });
    if (locationId) and.push({ location_id: String(locationId) });
    if (vendorId) and.push({ vendor_id: String(vendorId) });
    if (noVendor === '1' || noVendor === 'true') and.push({ vendor_id: null });
    // Refacciones "críticas": asignadas a al menos un equipo marcado como crítico.
    if (criticalAsset === '1' || criticalAsset === 'true') {
      and.push({ asset_parts: { some: { asset: { is_critical: true } } } });
    }
    if (critical === '1' || critical === 'true') {
      and.push({
        is_active: true,
        // stock <= minimum — Prisma no compara columnas fácil; filtramos en SQL raw o post.
      });
    }
    if (q) {
      const term = String(q).trim();
      if (term) {
        const or: Record<string, unknown>[] = [
          { name: { contains: term, mode: 'insensitive' } },
          { internal_code: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
        ];
        // Deep-link desde Ctrl+K usa UUID; equals por id (solo si parece UUID válido).
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term)) {
          or.unshift({ id: term });
        }
        and.push({ OR: or });
      }
    }
    const where = and.length ? { AND: and } : {};
    const include = { category: true, vendor: true, location: true };
    const wantsPage = page != null || limit != null;

    if (wantsPage) {
      const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
      // Críticos: cargar página amplia y filtrar (mínimo vs stock) — acotado.
      if (critical === '1' || critical === 'true') {
        const all = await prisma.item.findMany({
          where: { ...where, is_active: true },
          include,
          orderBy: { name: 'asc' },
        });
        const filtered = all.filter((i) => i.stock <= (i.minimum_inventory ?? 0));
        const total = filtered.length;
        const data = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);
        res.json({
          data,
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
        });
        return;
      }
      const [total, items] = await Promise.all([
        prisma.item.count({ where }),
        prisma.item.findMany({
          where,
          include,
          orderBy: { name: 'asc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({
        data: items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      });
      return;
    }

    const items = await prisma.item.findMany({ where, include });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener repuestos' });
  }
};

export const getItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const item = await prisma.item.findUnique({
      where: { id },
      include: { category: true, vendor: true, location: true },
    });
    if (!item) {
      res.status(404).json({ error: 'Repuesto no encontrado' });
      return;
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el repuesto' });
  }
};

const INITIAL_STOCK_REASON = 'Levantamiento de inventario (stock inicial)';

export const createItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      name, description, category_id, vendor_id, location_id,
      purchase_cost, stock, minimum_inventory, is_active, uom, qty_mode
    } = req.body;
    const user_id = (req as any).user?.userId as string | undefined;

    const mode = qty_mode === 'DECIMAL' ? 'DECIMAL' : 'INTEGER';
    const stockParsed = parseQty(stock !== undefined && stock !== '' ? stock : 0, mode, {
      allowZero: true,
      fieldLabel: 'El stock inicial',
    });
    if (!stockParsed.ok) {
      res.status(400).json({ error: stockParsed.error });
      return;
    }
    const initialStock = stockParsed.value;
    if (initialStock > 0 && !user_id) {
      res.status(401).json({ error: 'Sesión requerida para registrar stock inicial' });
      return;
    }

    const minParsed = parseQty(
      minimum_inventory !== undefined && minimum_inventory !== '' ? minimum_inventory : 0,
      mode,
      { allowZero: true, fieldLabel: 'El stock mínimo' }
    );
    if (!minParsed.ok) {
      res.status(400).json({ error: minParsed.error });
      return;
    }

    const internal_code = await generateInventoryCode('Item', 'MTTO-', 4);

    const itemData: any = {
      internal_code,
      name,
      description,
      purchase_cost: purchase_cost ? parseFloat(purchase_cost) : null,
      // El stock solo se aplica vía movimiento (levantamiento); nunca se escribe a ciegas.
      stock: 0,
      minimum_inventory: minParsed.value,
      is_active: is_active === undefined ? true : (is_active === 'true' || is_active === true),
      uom: uom || 'PIEZAS',
      qty_mode: mode,
    };

    if (category_id) itemData.category = { connect: { id: category_id } };
    if (vendor_id) itemData.vendor = { connect: { id: vendor_id } };
    
    let finalLocationId = location_id;
    if (!finalLocationId) {
      let unassignedLoc = await prisma.itemLocation.findFirst({ where: { name: 'Sin Asignación' } });
      if (!unassignedLoc) {
        unassignedLoc = await prisma.itemLocation.create({
          data: { name: 'Sin Asignación', internal_id: await generateInventoryCode('ItemLocation', 'LOC-', 3) }
        });
      }
      finalLocationId = unassignedLoc.id;
    }
    itemData.location = { connect: { id: finalLocationId } };

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.['image']) {
      itemData.image_url = `/uploads/inventory/${files['image'][0].filename}`;
    }

    const newItem = await prisma.$transaction(async (tx) => {
      const created = await tx.item.create({ data: itemData });

      if (initialStock > 0 && user_id) {
        await tx.inventoryTransaction.create({
          data: {
            item_id: created.id,
            user_id,
            amount: initialStock,
            reason: INITIAL_STOCK_REASON,
          },
        });
        return tx.item.update({
          where: { id: created.id },
          data: { stock: initialStock },
        });
      }

      return created;
    });

    if (initialStock > 0 && user_id) {
      const actor = await prisma.user.findUnique({ where: { id: user_id }, select: { name: true } });
      await writeAuditLog({
        userId: user_id,
        userName: actor?.name,
        action: 'INVENTORY_IN',
        entity: 'inventory',
        entityId: newItem.id,
        summary: `Entrada ${initialStock} · ${newItem.name || newItem.id}: ${INITIAL_STOCK_REASON}`,
        meta: { amount: initialStock, reason: INITIAL_STOCK_REASON },
      });
    }

    emitRefresh('refresh_inventory');
    res.status(201).json(newItem);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'El internal_code ya existe' });
      return;
    }
    console.error('Error al crear repuesto:', error);
    res.status(500).json({ error: 'Error al crear repuesto' });
  }
};

export const updateItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { 
      name, description, category_id, vendor_id, location_id,
      purchase_cost, minimum_inventory, is_active, uom, qty_mode
    } = req.body;

    const existing = await prisma.item.findUnique({ where: { id }, select: { qty_mode: true } });
    if (!existing) {
      res.status(404).json({ error: 'Artículo no encontrado' });
      return;
    }
    const mode =
      qty_mode === 'DECIMAL' || qty_mode === 'INTEGER' ? qty_mode : existing.qty_mode;

    const itemData: any = {};
    if (name) itemData.name = name;
    if (description !== undefined) itemData.description = description || null;
    if (purchase_cost !== undefined) itemData.purchase_cost = purchase_cost ? parseFloat(purchase_cost) : null;
    if (minimum_inventory !== undefined) {
      const minParsed = parseQty(minimum_inventory, mode, {
        allowZero: true,
        fieldLabel: 'El stock mínimo',
      });
      if (!minParsed.ok) {
        res.status(400).json({ error: minParsed.error });
        return;
      }
      itemData.minimum_inventory = minParsed.value;
    }
    if (is_active !== undefined) itemData.is_active = is_active === 'true' || is_active === true;
    if (uom) itemData.uom = uom;
    if (qty_mode === 'DECIMAL' || qty_mode === 'INTEGER') itemData.qty_mode = qty_mode;

    if (category_id !== undefined) itemData.category = category_id ? { connect: { id: category_id } } : { disconnect: true };
    if (vendor_id !== undefined) itemData.vendor = vendor_id ? { connect: { id: vendor_id } } : { disconnect: true };
    
    if (location_id !== undefined) {
      let finalLocationId = location_id;
      if (!finalLocationId) {
        let unassignedLoc = await prisma.itemLocation.findFirst({ where: { name: 'Sin Asignación' } });
        if (!unassignedLoc) {
          unassignedLoc = await prisma.itemLocation.create({
            data: { name: 'Sin Asignación', internal_id: await generateInventoryCode('ItemLocation', 'LOC-', 3) }
          });
        }
        finalLocationId = unassignedLoc.id;
      }
      itemData.location = { connect: { id: finalLocationId } };
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.['image']) {
      itemData.image_url = `/uploads/inventory/${files['image'][0].filename}`;
    }

    const updatedItem = await prisma.item.update({
      where: { id },
      data: itemData
    });
    emitRefresh('refresh_inventory');
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar repuesto' });
  }
};

export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) {
      res.status(404).json({ error: 'Repuesto no encontrado' });
      return;
    }

    // asset_parts tiene onDelete: Cascade (se limpia solo); el resto bloquea para no perder historial.
    const [txCount, planCount, poCount] = await Promise.all([
      prisma.inventoryTransaction.count({ where: { item_id: id } }),
      prisma.planItem.count({ where: { item_id: id } }),
      prisma.purchaseOrderItem.count({ where: { item_id: id } }),
    ]);

    if (txCount > 0 || planCount > 0 || poCount > 0) {
      const refs: string[] = [];
      if (txCount > 0) refs.push(`${txCount} movimiento(s) de inventario`);
      if (planCount > 0) refs.push(`${planCount} plan(es) de mantenimiento`);
      if (poCount > 0) refs.push(`${poCount} orden(es) de compra`);
      res.status(400).json({
        error: `No puedes eliminar «${item.name}» porque tiene ${refs.join(', ')} asociado(s). Márcalo como descontinuado para conservar el historial.`,
      });
      return;
    }

    await prisma.item.delete({ where: { id } });
    emitRefresh('refresh_inventory');
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar repuesto:', error);
    res.status(500).json({ error: 'Error al eliminar repuesto' });
  }
};

// ==========================================
// SUMMARY
// ==========================================
export const getInventorySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await prisma.item.findMany({
      select: {
        id: true,
        stock: true,
        minimum_inventory: true,
        purchase_cost: true
      }
    });
    
    const lowStockCount = items.filter(item => item.stock <= item.minimum_inventory).length;
    const totalValue = items.reduce((sum, item) => sum + (item.stock * (item.purchase_cost ?? 0)), 0);
    
    res.json({
      total_items: items.length,
      low_stock_count: lowStockCount,
      total_value: Math.round(totalValue * 100) / 100
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener resumen de inventario' });
  }
};

// ==========================================
// INVENTORY TRANSACTIONS
// ==========================================
export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, itemId, movement, q, startDate, endDate } = req.query;
    const and: Record<string, unknown>[] = [];

    if (itemId) and.push({ item_id: String(itemId) });
    if (movement === 'IN') and.push({ amount: { gt: 0 } });
    if (movement === 'OUT') and.push({ amount: { lt: 0 } });
    if (startDate || endDate) {
      and.push({
        created_at: {
          ...(startDate ? { gte: new Date(String(startDate).length <= 10 ? `${startDate}T00:00:00.000` : String(startDate)) } : {}),
          ...(endDate ? { lte: new Date(String(endDate).length <= 10 ? `${endDate}T23:59:59.999` : String(endDate)) } : {}),
        },
      });
    }
    if (q) {
      const term = String(q).trim();
      if (term) {
        and.push({
          OR: [
            { reason: { contains: term, mode: 'insensitive' } },
            { item: { name: { contains: term, mode: 'insensitive' } } },
            { user: { name: { contains: term, mode: 'insensitive' } } },
          ],
        });
      }
    }

    const where = and.length ? { AND: and } : {};
    const include = {
      item: true,
      user: { select: { id: true, name: true, email: true } },
    };
    const orderBy = { created_at: 'desc' as const };
    const wantsPage = page != null || limit != null;

    if (wantsPage) {
      const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
      const [total, transactions] = await Promise.all([
        prisma.inventoryTransaction.count({ where }),
        prisma.inventoryTransaction.findMany({
          where,
          include,
          orderBy,
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({
        data: transactions,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      });
      return;
    }

    // Sin page/limit: lista filtrada (p. ej. historial de un ítem).
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include,
      orderBy,
    });
    res.json(transactions);
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
};

/** Flujo de costos: total entrado y total salido (en dinero) según los filtros. */
export const getTransactionsSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId, movement, q, startDate, endDate } = req.query;
    const and: Record<string, unknown>[] = [];

    if (itemId) and.push({ item_id: String(itemId) });
    if (movement === 'IN') and.push({ amount: { gt: 0 } });
    if (movement === 'OUT') and.push({ amount: { lt: 0 } });
    if (startDate || endDate) {
      and.push({
        created_at: {
          ...(startDate ? { gte: new Date(String(startDate).length <= 10 ? `${startDate}T00:00:00.000` : String(startDate)) } : {}),
          ...(endDate ? { lte: new Date(String(endDate).length <= 10 ? `${endDate}T23:59:59.999` : String(endDate)) } : {}),
        },
      });
    }
    if (q) {
      const term = String(q).trim();
      if (term) {
        and.push({
          OR: [
            { reason: { contains: term, mode: 'insensitive' } },
            { item: { name: { contains: term, mode: 'insensitive' } } },
            { user: { name: { contains: term, mode: 'insensitive' } } },
          ],
        });
      }
    }

    const where = and.length ? { AND: and } : {};
    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      select: { amount: true, unit_cost: true },
    });

    let totalIn = 0;
    let totalOut = 0;
    let countIn = 0;
    let countOut = 0;
    for (const tx of transactions) {
      const value = Math.abs(tx.amount) * (tx.unit_cost ?? 0);
      if (tx.amount > 0) {
        totalIn += value;
        countIn += 1;
      } else if (tx.amount < 0) {
        totalOut += value;
        countOut += 1;
      }
    }

    res.json({
      totalIn: Math.round(totalIn * 100) / 100,
      totalOut: Math.round(totalOut * 100) / 100,
      countIn,
      countOut,
    });
  } catch (error) {
    console.error('Error al obtener resumen de transacciones:', error);
    res.status(500).json({ error: 'Error al obtener resumen de transacciones' });
  }
};

export const createTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { item_id, amount, reason, client_request_id } = req.body;
    const user_id = (req as any).user.userId; // Tomamos el ID del usuario autenticado

    const requestId =
      typeof client_request_id === 'string' && client_request_id.trim()
        ? client_request_id.trim().slice(0, 64)
        : null;

    if (!item_id || amount === undefined || amount === '' || !reason) {
      res.status(400).json({ error: 'Faltan campos requeridos (item_id, amount, reason)' });
      return;
    }

    // Idempotencia offline: si ya se aplicó esta salida, devolver la misma tx.
    if (requestId) {
      const existing = await prisma.inventoryTransaction.findUnique({
        where: { client_request_id: requestId },
      });
      if (existing) {
        const item = await prisma.item.findUnique({ where: { id: existing.item_id } });
        res.status(200).json({
          transaction: existing,
          stock_actual: item?.stock ?? 0,
          idempotent: true,
        });
        return;
      }
    }

    // Usamos una transacción de Prisma para asegurar que el stock se descuente o sume de manera segura
    const [transaction, item] = await prisma.$transaction(async (tx) => {
      // Validar si es una salida que excede el stock
      const currentItem = await tx.item.findUnique({ where: { id: item_id } });
      if (!currentItem) {
        throw new Error('ITEM_NOT_FOUND');
      }

      const signedRaw = parseFloat(amount);
      if (!Number.isFinite(signedRaw) || signedRaw === 0) {
        throw new Error('La cantidad debe ser distinta de 0');
      }
      const absParsed = parseQty(Math.abs(signedRaw), currentItem.qty_mode, {
        fieldLabel: 'La cantidad',
      });
      if (!absParsed.ok) {
        throw new Error(absParsed.error);
      }
      const transactionAmount = signedRaw < 0 ? -absParsed.value : absParsed.value;

      if (transactionAmount < 0 && currentItem.stock < Math.abs(transactionAmount)) {
        throw new Error('INSUFFICIENT_STOCK');
      }

      // Snapshot del costo de catálogo al momento del movimiento (histórico congelado).
      const snappedCost = currentItem.purchase_cost ?? 0;

      // 1. Crear el registro en el historial
      const newTx = await tx.inventoryTransaction.create({
        data: {
          item_id,
          user_id,
          amount: transactionAmount,
          reason,
          unit_cost: snappedCost,
          ...(requestId ? { client_request_id: requestId } : {}),
        }
      });

      // 2. Actualizar el stock del Item
      const updatedItem = await tx.item.update({
        where: { id: item_id },
        data: {
          stock: {
            increment: transactionAmount
          }
        }
      });

      return [newTx, updatedItem];
    });

    emitRefresh('refresh_inventory');
    const actor = await prisma.user.findUnique({ where: { id: user_id }, select: { name: true } });
    const loggedAmount = transaction.amount;
    await writeAuditLog({
      userId: user_id,
      userName: actor?.name,
      action: loggedAmount >= 0 ? 'INVENTORY_IN' : 'INVENTORY_OUT',
      entity: 'inventory',
      entityId: item_id,
      summary: `${loggedAmount >= 0 ? 'Entrada' : 'Salida'} ${Math.abs(loggedAmount)} · ${item.name || item_id}: ${reason}`,
      meta: { amount: loggedAmount, reason, client_request_id: requestId },
    });
    res.status(201).json({ transaction, stock_actual: item.stock });
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_STOCK') {
      res.status(400).json({ error: 'Inventario insuficiente. No es posible retirar una cantidad mayor a las existencias actuales.' });
      return;
    }
    if (error.message === 'ITEM_NOT_FOUND') {
      res.status(404).json({ error: 'Artículo no encontrado' });
      return;
    }
    if (typeof error.message === 'string' && error.message.includes('enteros')) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (typeof error.message === 'string' && error.message.includes('cantidad')) {
      res.status(400).json({ error: error.message });
      return;
    }
    // Carrera: dos syncs con el mismo client_request_id
    if (error?.code === 'P2002' && error?.meta?.target?.includes?.('client_request_id')) {
      const requestId =
        typeof req.body?.client_request_id === 'string' ? req.body.client_request_id.trim() : null;
      if (requestId) {
        const existing = await prisma.inventoryTransaction.findUnique({
          where: { client_request_id: requestId },
        });
        if (existing) {
          const item = await prisma.item.findUnique({ where: { id: existing.item_id } });
          res.status(200).json({
            transaction: existing,
            stock_actual: item?.stock ?? 0,
            idempotent: true,
          });
          return;
        }
      }
    }
    res.status(500).json({ error: 'Error al registrar transacción de inventario' });
  }
};
// ==========================================
// IMAGE SEARCH (WEB)
// ==========================================
export const searchImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      res.status(400).json({ error: 'Falta el parámetro de búsqueda "q"' });
      return;
    }

    const images = await imageSearch({ query: q, safeSearch: 'Off' } as any);
    // Filter and return only top 10 URLs
    const topImages = images.slice(0, 10).map((img: any) => ({
      url: img.image,
      width: img.width,
      height: img.height,
      title: img.title
    }));

    res.json(topImages);
  } catch (error) {
    console.error('Error al buscar imágenes:', error);
    res.status(500).json({ error: 'Error al buscar imágenes en la web' });
  }
};

export const proxyImage = async (req: Request, res: Response): Promise<void> => {
  const { url } = req.query;
  try {
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'Falta el parámetro "url"' });
      return;
    }

    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        // Send generic user agent to prevent 403 blocks from CDNs
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    res.set('Content-Type', response.headers['content-type'] as string);
    res.set('Cache-Control', 'public, max-age=31557600'); // Cache for 1 year
    response.data.pipe(res);
  } catch (error) {
    console.error('Error proxying image:', url);
    res.status(500).json({ error: 'No se pudo descargar la imagen original' });
  }
};
