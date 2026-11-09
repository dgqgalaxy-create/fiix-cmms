import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { writeAuditLog } from '../utils/auditLog';

/** GET /api/work-orders/cost-categories — categorías activas. */
export const getCostCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.costCategory.findMany({
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });
    res.json(categories);
  } catch (error) {
    console.error('Error listando categorías de costo:', error);
    res.status(500).json({ error: 'No se pudieron obtener las categorías de costo' });
  }
};

/**
 * POST /api/work-orders/cost-categories — crea la categoría si no existe
 * (permite crearla sobre la marcha desde el formulario de costos).
 */
export const createCostCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    if (!name) {
      res.status(400).json({ error: 'Escribe el nombre de la categoría.' });
      return;
    }
    const existing = await prisma.costCategory.findUnique({ where: { name } });
    if (existing) {
      if (!existing.is_active) {
        const reactivated = await prisma.costCategory.update({
          where: { id: existing.id },
          data: { is_active: true },
        });
        res.json(reactivated);
        return;
      }
      res.json(existing);
      return;
    }
    const created = await prisma.costCategory.create({ data: { name } });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando categoría de costo:', error);
    res.status(500).json({ error: 'No se pudo crear la categoría de costo' });
  }
};

/** PATCH /api/work-orders/cost-categories/:id — renombrar o desactivar. */
export const updateCostCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const data: { name?: string; is_active?: boolean } = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      const name = req.body.name.trim().slice(0, 60);
      const duplicate = await prisma.costCategory.findUnique({ where: { name } });
      if (duplicate && duplicate.id !== id) {
        res.status(409).json({ error: 'Ya existe una categoría con ese nombre.' });
        return;
      }
      data.name = name;
    }
    if (typeof req.body?.is_active === 'boolean') data.is_active = req.body.is_active;

    const updated = await prisma.costCategory.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando categoría de costo:', error);
    res.status(500).json({ error: 'No se pudo actualizar la categoría' });
  }
};

/** GET /api/work-orders/:id/costs — costos adicionales de una orden. */
export const getWorkOrderCosts = async (req: Request, res: Response): Promise<void> => {
  try {
    const workOrderId = req.params.id as string;
    const costs = await prisma.workOrderCost.findMany({
      where: { work_order_id: workOrderId },
      orderBy: { created_at: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } },
      },
    });
    const total = costs.reduce((sum, cost) => sum + cost.amount, 0);
    res.json({ costs, total });
  } catch (error) {
    console.error('Error listando costos de la orden:', error);
    res.status(500).json({ error: 'No se pudieron obtener los costos' });
  }
};

/** POST /api/work-orders/:id/costs — { category_id | category, description, amount, incurred_at } */
export const addWorkOrderCost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workOrderId = req.params.id as string;
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
      return;
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: { id: true, folio: true },
    });
    if (!workOrder) {
      res.status(404).json({ error: 'Orden de trabajo no encontrada' });
      return;
    }

    let categoryId: string | null = req.body?.category_id ? String(req.body.category_id) : null;
    const categoryName = typeof req.body?.category === 'string' ? req.body.category.trim() : '';

    if (!categoryId && categoryName) {
      const existing = await prisma.costCategory.findUnique({ where: { name: categoryName } });
      const category = existing ?? await prisma.costCategory.create({ data: { name: categoryName } });
      if (!category.is_active) {
        await prisma.costCategory.update({ where: { id: category.id }, data: { is_active: true } });
      }
      categoryId = category.id;
    }

    const incurredAt = req.body?.incurred_at ? new Date(req.body.incurred_at) : new Date();

    const created = await prisma.workOrderCost.create({
      data: {
        work_order_id: workOrderId,
        category_id: categoryId,
        description: typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 300) : null,
        amount,
        incurred_at: Number.isNaN(incurredAt.getTime()) ? new Date() : incurredAt,
        created_by_id: req.user?.userId ?? null,
      },
      include: { category: { select: { id: true, name: true } } },
    });

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'ADD_WORK_ORDER_COST',
      entity: 'work_order',
      entityId: workOrderId,
      summary: `Costo adicional ${created.category?.name ?? 'sin categoría'}: $${amount.toFixed(2)} (OT-${workOrder.folio})`,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error registrando costo:', error);
    res.status(500).json({ error: 'No se pudo registrar el costo' });
  }
};

/** DELETE /api/work-orders/:id/costs/:costId */
export const deleteWorkOrderCost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workOrderId = req.params.id as string;
    const costId = req.params.costId as string;
    const cost = await prisma.workOrderCost.findFirst({
      where: { id: costId, work_order_id: workOrderId },
    });
    if (!cost) {
      res.status(404).json({ error: 'Costo no encontrado' });
      return;
    }
    await prisma.workOrderCost.delete({ where: { id: costId } });
    await writeAuditLog({
      userId: req.user?.userId,
      action: 'DELETE_WORK_ORDER_COST',
      entity: 'work_order',
      entityId: workOrderId,
      summary: `Costo adicional eliminado: $${cost.amount.toFixed(2)}`,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando costo:', error);
    res.status(500).json({ error: 'No se pudo eliminar el costo' });
  }
};