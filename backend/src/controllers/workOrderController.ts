import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getRequesters = async (req: Request, res: Response): Promise<void> => {
  try {
    const requesters = await prisma.workOrder.findMany({
      where: { requester_name: { not: null } },
      select: { requester_name: true },
      distinct: ['requester_name']
    });
    const names = requesters.map(r => r.requester_name).filter(Boolean);
    res.json(names);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener solicitantes' });
  }
};

export const getWorkOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    const whereClause: any = {};
    const workOrders = await prisma.workOrder.findMany({
      where: whereClause,
      include: {
        asset: true,
        zone: true,
        created_by: { select: { id: true, name: true } },
        assigned_technicians: { select: { id: true, name: true } },
        failure_problem: true,
        failure_cause: true,
        failure_remedy: true
      },
      orderBy: { created_at: 'desc' } // Opcional, pero bueno para ordenar las más recientes primero
    });
    res.json(workOrders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener órdenes de trabajo' });
  }
};

export const getWorkOrdersSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    let whereClause: any = {};

    if (startDate && endDate) {
      whereClause.created_at = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    const groupResult = await prisma.workOrder.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
      where: whereClause,
    });

    const summary: Record<string, number> = {
      PENDIENTE: 0,
      EN_PROCESO: 0,
      EN_ESPERA: 0,
      FINALIZADO: 0,
      ANULADO: 0,
    };

    groupResult.forEach(item => {
      summary[item.status] = item._count.id;
    });

    res.json(summary);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener resumen de órdenes de trabajo' });
  }
};

export const getWorkOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        asset: true,
        zone: true,
        created_by: { select: { id: true, name: true } },
        assigned_technicians: { select: { id: true, name: true } },
        failure_problem: true,
        failure_cause: true,
        failure_remedy: true
      }
    });
    if (!workOrder) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }
    res.json(workOrder);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener orden de trabajo' });
  }
};

export const createWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, asset_id, zone_id, priority, maintenance_type, machine_stopped, requester_name, production_group } = req.body;
    let { assigned_technicians_ids } = req.body;
    
    if (assigned_technicians_ids && !Array.isArray(assigned_technicians_ids)) {
      assigned_technicians_ids = [assigned_technicians_ids];
    }
    
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] };
    let request_image_url: string | undefined;
    
    if (files && files['request_image']) {
      request_image_url = `/uploads/${files['request_image'][0].filename}`;
    }

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        title,
        description,
        asset_id,
        zone_id,
        priority,
        maintenance_type,
        machine_stopped: machine_stopped === true || machine_stopped === 'true',
        requester_name,
        production_group,
        status: 'PENDIENTE',
        request_image_url,
        created_by_id: req.user.userId,
        assigned_technicians: assigned_technicians_ids && assigned_technicians_ids.length > 0
          ? { connect: assigned_technicians_ids.map((id: string) => ({ id })) }
          : undefined
      }
    });
    res.status(201).json(newWorkOrder);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear orden de trabajo' });
  }
};

export const updateWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, description, asset_id, status, hold_reason, resolution_notes, assigned_technicians_ids, zone_id, priority, maintenance_type, machine_stopped, requester_name, production_group, signature_clean_area, signature_delivery, used_items, failure_problem_id, failure_cause_id, failure_remedy_id } = req.body;
    const userRole = req.user?.role;
    const userId = req.user?.userId;

    // Buscar la orden actual para validaciones de estado
    const currentWorkOrder = await prisma.workOrder.findUnique({ 
      where: { id },
      include: { assigned_technicians: true }
    });
    if (!currentWorkOrder) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }

    // Regla estricta: Los técnicos no pueden editar datos de origen.
    if (userRole === 'TECNICO') {
      if (currentWorkOrder.status === 'FINALIZADO') {
        res.status(403).json({ error: 'Prohibido: No puedes editar una orden que ya está finalizada.' });
        return;
      }
      
      if (title !== undefined || description !== undefined || asset_id !== undefined || assigned_technicians_ids !== undefined || zone_id !== undefined || priority !== undefined || maintenance_type !== undefined || requester_name !== undefined || production_group !== undefined) {
        res.status(403).json({ error: 'Prohibido: Los Técnicos no pueden alterar campos operativos o de asignación manual masiva.' });
        return;
      }
    }

    if (status === 'EN_PROCESO' && userRole !== 'TECNICO') {
      const willHaveTechnicians = assigned_technicians_ids 
        ? assigned_technicians_ids.length > 0 
        : currentWorkOrder.assigned_technicians.length > 0;
        
      if (!willHaveTechnicians) {
        res.status(400).json({ error: 'Debes asignar al menos un técnico para pasar la orden a EN PROCESO.' });
        return;
      }
    }

    // Multer inyecta los archivos aquí
    const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] };
    
    const updateData: any = { status, resolution_notes };

    if (zone_id !== undefined) updateData.zone_id = zone_id;
    if (priority !== undefined) updateData.priority = priority;
    if (maintenance_type !== undefined) updateData.maintenance_type = maintenance_type;
    if (machine_stopped !== undefined) updateData.machine_stopped = machine_stopped === true || machine_stopped === 'true';
    if (requester_name !== undefined) updateData.requester_name = requester_name;
    if (production_group !== undefined) updateData.production_group = production_group;
    if (signature_clean_area !== undefined) updateData.signature_clean_area = signature_clean_area;
    if (signature_delivery !== undefined) updateData.signature_delivery = signature_delivery;
    if (failure_problem_id !== undefined) updateData.failure_problem_id = failure_problem_id;
    if (failure_cause_id !== undefined) updateData.failure_cause_id = failure_cause_id;
    if (failure_remedy_id !== undefined) updateData.failure_remedy_id = failure_remedy_id;
    
    // Auto-asignación: Si un técnico la cambia a EN_PROCESO, se auto-asigna si la lista estaba vacía
    if (userRole === 'TECNICO' && status === 'EN_PROCESO' && currentWorkOrder.status === 'PENDIENTE') {
      if (currentWorkOrder.assigned_technicians.length === 0) {
        updateData.assigned_technicians = { connect: [{ id: userId }] };
      }
    }

    // Solo permitir que Administradores y Gestionadores reasignen masivamente
    if (userRole !== 'TECNICO' && assigned_technicians_ids !== undefined) {
      updateData.assigned_technicians = { set: assigned_technicians_ids.map((tid: string) => ({ id: tid })) };
    }
    
    if (status === 'EN_ESPERA') {
      updateData.hold_reason = hold_reason;
    }
    
    if (status === 'FINALIZADO' && currentWorkOrder.status !== 'FINALIZADO') {
      updateData.completed_at = new Date();

      // Parsear used_items si viene como string (ej. desde FormData)
      let parsedUsedItems = used_items;
      if (typeof used_items === 'string') {
        try {
          parsedUsedItems = JSON.parse(used_items);
        } catch (e) {
          parsedUsedItems = [];
        }
      }

      // Descontar inventario si se enviaron repuestos usados
      if (parsedUsedItems && Array.isArray(parsedUsedItems) && userId) {
        for (const part of parsedUsedItems) {
          if (part.item_id && part.amount) {
            const amountToDeduct = Math.abs(Number(part.amount));
            // 1. Crear transacción de salida
            await prisma.inventoryTransaction.create({
              data: {
                item_id: part.item_id,
                user_id: userId,
                amount: -amountToDeduct,
                reason: `Consumo OT WO-${currentWorkOrder.folio.toString().padStart(4, '0')}`
              }
            });
            // 2. Descontar del stock
            await prisma.item.update({
              where: { id: part.item_id },
              data: { stock: { decrement: amountToDeduct } }
            });
          }
        }
      }
    }

    if (status === 'EN_PROCESO' && currentWorkOrder.status !== 'EN_PROCESO') {
      if (!currentWorkOrder.started_at) {
        updateData.started_at = new Date();
      }
      updateData.last_resumed_at = new Date();
    }

    if ((status === 'EN_ESPERA' || status === 'FINALIZADO') && currentWorkOrder.status === 'EN_PROCESO') {
      if (currentWorkOrder.last_resumed_at) {
        const timeDiffMs = new Date().getTime() - currentWorkOrder.last_resumed_at.getTime();
        updateData.accumulated_time_ms = currentWorkOrder.accumulated_time_ms + timeDiffMs;
      }
      updateData.last_resumed_at = null;
    }

    // Construir URLs de las imágenes
    if (files && files['before_image']) {
      updateData.before_image_url = `/uploads/${files['before_image'][0].filename}`;
    }
    if (files && files['after_image']) {
      updateData.after_image_url = `/uploads/${files['after_image'][0].filename}`;
    }

    const updated = await prisma.workOrder.update({
      where: { id },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar orden de trabajo' });
  }
};

export const deleteWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Verificamos si existe
    const currentWorkOrder = await prisma.workOrder.findUnique({ where: { id } });
    if (!currentWorkOrder) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }

    await prisma.workOrder.delete({ where: { id } });
    res.json({ message: 'Orden eliminada con éxito' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar orden de trabajo' });
  }
};

export const joinWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const currentWorkOrder = await prisma.workOrder.findUnique({ 
      where: { id },
      include: { assigned_technicians: true }
    });

    if (!currentWorkOrder) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }

    if (currentWorkOrder.status === 'FINALIZADO' || currentWorkOrder.status === 'ANULADO') {
      res.status(400).json({ error: 'No puedes unirte a una orden finalizada o anulada' });
      return;
    }

    // Connect user
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        assigned_technicians: {
          connect: [{ id: userId }]
        }
      },
      include: {
        asset: true,
        zone: true,
        created_by: { select: { id: true, name: true } },
        assigned_technicians: { select: { id: true, name: true } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al unirse a la orden' });
  }
};
