import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRefresh } from '../utils/socket';

export const getMaintenancePlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.maintenancePlan.findMany({
      include: {
        asset: true,
        required_items: {
          include: {
            item: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(plans);
  } catch (error) {
    console.error('Error fetching maintenance plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createMaintenancePlan = async (req: Request, res: Response) => {
  try {
    const { 
      title, description, asset_id, frequency_type, frequency_value, 
      days_in_advance, is_active, required_items 
    } = req.body;

    if (Array.isArray(required_items)) {
      for (const item of required_items) {
        const qty = Number(item.quantity_required);
        if (!Number.isFinite(qty) || qty <= 0) {
          res.status(400).json({ error: 'La cantidad de cada refacción del plan debe ser un número positivo mayor a 0.' });
          return;
        }
      }
    }

    // Calcular primera fecha de vencimiento
    const now = new Date();
    const next_due_date = new Date(now);
    
    if (frequency_type === 'DIAS') next_due_date.setDate(now.getDate() + Number(frequency_value));
    else if (frequency_type === 'SEMANAS') next_due_date.setDate(now.getDate() + (Number(frequency_value) * 7));
    else if (frequency_type === 'MESES') next_due_date.setMonth(now.getMonth() + Number(frequency_value));
    else if (frequency_type === 'ANUAL') next_due_date.setFullYear(now.getFullYear() + Number(frequency_value));

    const plan = await prisma.maintenancePlan.create({
      data: {
        title,
        description,
        asset_id,
        frequency_type,
        frequency_value: Number(frequency_value),
        days_in_advance: Number(days_in_advance) || 3,
        is_active: is_active ?? true,
        next_due_date,
        required_items: {
          create: required_items?.map((item: any) => ({
            item_id: item.item_id,
            quantity_required: Number(item.quantity_required)
          })) || []
        }
      },
      include: {
        asset: true,
        required_items: {
          include: { item: true }
        }
      }
    });

    emitRefresh('refresh_maintenance');
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating maintenance plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMaintenancePlan = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { 
      title, description, frequency_type, frequency_value, 
      days_in_advance, is_active, required_items 
    } = req.body;

    if (Array.isArray(required_items)) {
      for (const item of required_items) {
        const qty = Number(item.quantity_required);
        if (!Number.isFinite(qty) || qty <= 0) {
          res.status(400).json({ error: 'La cantidad de cada refacción del plan debe ser un número positivo mayor a 0.' });
          return;
        }
      }
    }

    // Check if we need to recalculate next_due_date based on new frequency
    // For simplicity, we just update it if frequency changes
    const existing = await prisma.maintenancePlan.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    let next_due_date = existing.next_due_date;
    if (existing.frequency_type !== frequency_type || existing.frequency_value !== Number(frequency_value)) {
      const baseDate = existing.last_triggered_at || new Date();
      next_due_date = new Date(baseDate);
      if (frequency_type === 'DIAS') next_due_date.setDate(next_due_date.getDate() + Number(frequency_value));
      else if (frequency_type === 'SEMANAS') next_due_date.setDate(next_due_date.getDate() + (Number(frequency_value) * 7));
      else if (frequency_type === 'MESES') next_due_date.setMonth(next_due_date.getMonth() + Number(frequency_value));
      else if (frequency_type === 'ANUAL') next_due_date.setFullYear(next_due_date.getFullYear() + Number(frequency_value));
    }

    // Usaremos transaction para borrar items viejos y crear los nuevos
    const plan = await prisma.$transaction(async (tx) => {
      if (required_items) {
        await tx.planItem.deleteMany({
          where: { maintenance_plan_id: id }
        });
      }

      return await tx.maintenancePlan.update({
        where: { id },
        data: {
          title,
          description,
          frequency_type,
          frequency_value: Number(frequency_value),
          days_in_advance: Number(days_in_advance),
          is_active,
          next_due_date,
          ...(required_items && {
            required_items: {
              create: required_items.map((item: any) => ({
                item_id: item.item_id,
                quantity_required: Number(item.quantity_required)
              }))
            }
          })
        },
        include: {
          asset: true,
          required_items: {
            include: { item: true }
          }
        }
      });
    });

    emitRefresh('refresh_maintenance');
    res.json(plan);
  } catch (error) {
    console.error('Error updating maintenance plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMaintenancePlan = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    
    // Check if it has generated orders?
    // Actually we can just delete it, or soft delete.
    // It's better to delete the plan, and WorkOrders will have maintenance_plan_id set to null (if onDelete is SetNull, which is default if optional).
    // Wait, in schema.prisma we didn't specify onDelete for WorkOrder.maintenance_plan. It defaults to SetNull.
    
    await prisma.maintenancePlan.delete({
      where: { id }
    });

    emitRefresh('refresh_maintenance');
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting maintenance plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
