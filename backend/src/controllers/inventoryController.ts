import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { generateInventoryCode } from '../utils/codeGenerator';
import { imageSearch } from '@mudbill/duckduckgo-images-api';
import axios from 'axios';
import { emitRefresh } from '../utils/socket';

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
    const { name, website_url, phone, email, address, is_active } = req.body;
    const internal_id = await generateInventoryCode('Vendor', 'PROV-', 3);
    const vendor = await prisma.vendor.create({
      data: { internal_id, name, website_url, phone, email, address, is_active }
    });
    emitRefresh('refresh_inventory');
    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
};

export const updateVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { name, website_url, phone, email, address, is_active } = req.body;
    const vendor = await prisma.vendor.update({
      where: { id },
      data: { name, website_url, phone, email, address, is_active }
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
    const items = await prisma.item.findMany({
      include: {
        category: true,
        vendor: true,
        location: true
      }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener repuestos' });
  }
};

export const createItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      name, description, category_id, vendor_id, location_id,
      purchase_cost, stock, minimum_inventory, is_active, uom
    } = req.body;

    const internal_code = await generateInventoryCode('Item', 'MTTO-', 4);

    const itemData: any = {
      internal_code,
      name,
      description,
      purchase_cost: purchase_cost ? parseFloat(purchase_cost) : null,
      stock: stock ? parseFloat(stock) : 0,
      minimum_inventory: minimum_inventory ? parseFloat(minimum_inventory) : 0,
      is_active: is_active === undefined ? true : (is_active === 'true' || is_active === true),
      uom: uom || 'PIEZAS'
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

    const newItem = await prisma.item.create({ data: itemData });
    emitRefresh('refresh_inventory');
    res.status(201).json(newItem);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'El internal_code ya existe' });
      return;
    }
    res.status(500).json({ error: 'Error al crear repuesto' });
  }
};

export const updateItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { 
      name, description, category_id, vendor_id, location_id,
      purchase_cost, minimum_inventory, is_active, uom
    } = req.body;

    const itemData: any = {};
    if (name) itemData.name = name;
    if (description !== undefined) itemData.description = description || null;
    if (purchase_cost !== undefined) itemData.purchase_cost = purchase_cost ? parseFloat(purchase_cost) : null;
    if (minimum_inventory !== undefined) itemData.minimum_inventory = parseFloat(minimum_inventory);
    if (is_active !== undefined) itemData.is_active = is_active === 'true' || is_active === true;
    if (uom) itemData.uom = uom;

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

// ==========================================
// SUMMARY
// ==========================================
export const getInventorySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await prisma.item.findMany({
      select: {
        id: true,
        stock: true,
        minimum_inventory: true
      }
    });
    
    const lowStockCount = items.filter(item => item.stock <= item.minimum_inventory).length;
    
    res.json({
      total_items: items.length,
      low_stock_count: lowStockCount
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
    const transactions = await prisma.inventoryTransaction.findMany({
      include: {
        item: true,
        user: { select: { id: true, name: true, email: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 1000,
    });
    res.json(transactions);
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
};

export const createTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { item_id, amount, reason, client_request_id } = req.body;
    const user_id = (req as any).user.userId; // Tomamos el ID del usuario autenticado

    const transactionAmount = parseFloat(amount);
    const requestId =
      typeof client_request_id === 'string' && client_request_id.trim()
        ? client_request_id.trim().slice(0, 64)
        : null;

    if (!item_id || isNaN(transactionAmount) || !reason) {
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
      if (transactionAmount < 0) {
        const currentItem = await tx.item.findUnique({ where: { id: item_id } });
        if (!currentItem || currentItem.stock < Math.abs(transactionAmount)) {
          throw new Error('INSUFFICIENT_STOCK');
        }
      }

      // 1. Crear el registro en el historial
      const newTx = await tx.inventoryTransaction.create({
        data: {
          item_id,
          user_id,
          amount: transactionAmount,
          reason,
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
    res.status(201).json({ transaction, stock_actual: item.stock });
  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_STOCK') {
      res.status(400).json({ error: 'Inventario insuficiente. No es posible retirar una cantidad mayor a las existencias actuales.' });
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
