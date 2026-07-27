import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitRefresh, emitWorkOrderUpdated } from '../utils/socket';
import { triggerNewWorkOrderNotification } from '../services/NotificationService';
import { computeWorkOrderSla, getSlaSettings } from '../services/SlaService';
import { formatWorkOrderFolio } from '../utils/folio';
import { parseDateInput } from '../utils/parseDateInput';
import { writeAuditLog } from '../utils/auditLog';

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
    // Listado ligero: sin firmas base64 ni árboles RCA (van en getWorkOrderById).
    const workOrders = await prisma.workOrder.findMany({
      select: {
        id: true,
        folio: true,
        title: true,
        description: true,
        status: true,
        hold_reason: true,
        priority: true,
        maintenance_type: true,
        machine_stopped: true,
        requester_name: true,
        production_group: true,
        scheduled_date: true,
        due_date: true,
        started_at: true,
        paused_at: true,
        last_resumed_at: true,
        accumulated_time_ms: true,
        completed_at: true,
        created_at: true,
        updated_at: true,
        request_image_url: true,
        before_image_url: true,
        after_image_url: true,
        resolution_notes: true,
        maintenance_plan_id: true,
        asset: { select: { id: true, name: true, internal_code: true } },
        zone: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } },
        assigned_technicians: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const { sla_policy } = await getSlaSettings();
    const withSla = workOrders.map((wo) => ({
      ...wo,
      sla: computeWorkOrderSla(wo, sla_policy),
    }));
    res.json(withSla);
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
        failure_remedy: true,
        inventory_transactions: {
          where: { amount: { lt: 0 } },
          include: {
            item: { select: { id: true, name: true, internal_code: true, uom: true, purchase_cost: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      }
    });
    if (!workOrder) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }
    const parts_cost_total = workOrder.inventory_transactions.reduce((sum, tx) => {
      const qty = Math.abs(tx.amount);
      const unit = tx.unit_cost ?? tx.item.purchase_cost ?? 0;
      return sum + qty * unit;
    }, 0);
    const { sla_policy } = await getSlaSettings();
    res.json({
      ...workOrder,
      parts_cost_total: parseFloat(parts_cost_total.toFixed(2)),
      sla: computeWorkOrderSla(workOrder, sla_policy),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener orden de trabajo' });
  }
};

export const createPublicWorkOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { asset_id, zone_id, requester_name, title, description, machine_stopped, production_group, maintenance_type, priority, location } = req.body;

    if (!asset_id || !title) {
      res.status(400).json({ error: 'asset_id and title are required' });
      return;
    }

    const fullDescription = location ? `Ubicación: ${location}\n\n${description || ''}` : description;

    // We need a created_by_id because the schema requires it. We assign it to an admin.
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMINISTRADOR' } });
    if (!adminUser) {
      res.status(500).json({ error: 'No admin user found to assign as creator' });
      return;
    }

    const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    let request_image_url: string | undefined;
    if (files && files['request_image']) {
      request_image_url = `/uploads/${files['request_image'][0].filename}`;
    }

    if (requester_name) {
      const nameTrimmed = requester_name.trim();
      const existingReq = await prisma.requester.findUnique({ where: { name: nameTrimmed } });
      if (!existingReq) {
        await prisma.requester.create({ data: { name: nameTrimmed } });
      }
    }

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        title,
        description: fullDescription,
        asset_id,
        zone_id,
        machine_stopped: machine_stopped === true || machine_stopped === 'true',
        requester_name,
        created_by_id: adminUser.id,
        status: 'PENDIENTE' as any,
        priority: (priority || 'NORMAL') as any,
        maintenance_type: (maintenance_type || 'CORRECTIVO') as any,
        production_group: (production_group || 'NA') as any,
        request_image_url,
      },
      include: {
        asset: true,
        zone: true,
      }
    });

    emitWorkOrderUpdated(newWorkOrder.id);
    
    // Disparar notificaciones
    try {
      await triggerNewWorkOrderNotification(newWorkOrder);
    } catch (notifyError) {
      console.error('Error enviando notificaciones de solicitud pública:', notifyError);
    }

    res.status(201).json(newWorkOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la orden de trabajo pública' });
  }
};

export const createWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, asset_id, zone_id, priority, maintenance_type, machine_stopped, requester_name, production_group, scheduled_date, due_date } = req.body;
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

    if (requester_name) {
      const nameTrimmed = requester_name.trim();
      const existingReq = await prisma.requester.findUnique({ where: { name: nameTrimmed } });
      if (!existingReq) {
        await prisma.requester.create({ data: { name: nameTrimmed } });
      }
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
        scheduled_date: scheduled_date ? parseDateInput(scheduled_date) : null,
        due_date: due_date ? parseDateInput(due_date) : null,
        request_image_url,
        created_by_id: req.user.userId,
        assigned_technicians: assigned_technicians_ids && assigned_technicians_ids.length > 0
          ? { connect: assigned_technicians_ids.map((id: string) => ({ id })) }
          : undefined
      },
      include: {
        asset: true,
        zone: true,
      }
    });

    emitWorkOrderUpdated(newWorkOrder.id);
    try {
      await triggerNewWorkOrderNotification(newWorkOrder);
    } catch (notifyError) {
      console.error('Error enviando notificaciones de nueva orden:', notifyError);
    }
    
    res.status(201).json(newWorkOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear orden de trabajo' });
  }
};

export const updateWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { title, description, asset_id, status, hold_reason, resolution_notes, zone_id, priority, maintenance_type, machine_stopped, requester_name, production_group, signature_clean_area, signature_delivery, used_items, failure_problem_id, failure_cause_id, failure_remedy_id, scheduled_date, due_date } = req.body;
    let { assigned_technicians_ids } = req.body;
    if (typeof assigned_technicians_ids === 'string') {
      try {
        assigned_technicians_ids = JSON.parse(assigned_technicians_ids);
      } catch {
        assigned_technicians_ids = assigned_technicians_ids ? [assigned_technicians_ids] : [];
      }
    }
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

    if (currentWorkOrder.status === 'FINALIZADO') {
      if (status === 'ANULADO') {
        res.status(400).json({ error: 'No se puede anular una orden finalizada.' });
        return;
      }
      if (status && status !== 'FINALIZADO') {
        res.status(400).json({ error: 'No se puede cambiar el estado de una orden finalizada.' });
        return;
      }
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

    // Transiciones críticas: solo si el estado en BD sigue siendo el esperado
    if (status && status !== currentWorkOrder.status) {
      const allowedFrom: Record<string, string[]> = {
        PENDIENTE: ['EN_PROCESO', 'ANULADO'],
        EN_PROCESO: ['EN_ESPERA', 'FINALIZADO', 'ANULADO'],
        EN_ESPERA: ['EN_PROCESO', 'FINALIZADO', 'ANULADO'],
        FINALIZADO: [],
        ANULADO: [],
      };
      const from = currentWorkOrder.status;
      if (!(allowedFrom[from] || []).includes(status)) {
        res.status(409).json({
          error: `No se puede pasar de ${from} a ${status}. Otro usuario pudo haber actualizado la orden.`,
          current_status: from,
        });
        return;
      }

      // Pausar / finalizar / reanudar: el usuario debe estar asignado (usar Unirme/Colaborar).
      // Aceptar PENDIENTE → EN_PROCESO sí auto-asigna más abajo.
      const isAssigned = currentWorkOrder.assigned_technicians.some((t) => t.id === userId);
      if (
        userId &&
        !isAssigned &&
        (from === 'EN_PROCESO' || from === 'EN_ESPERA') &&
        status !== 'ANULADO'
      ) {
        res.status(403).json({
          error: 'Debes unirte a la orden (Colaborar) antes de pausar, reanudar o finalizar.',
        });
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
    if (scheduled_date !== undefined) updateData.scheduled_date = scheduled_date ? parseDateInput(scheduled_date) : null;
    if (due_date !== undefined) updateData.due_date = due_date ? parseDateInput(due_date) : null;
    
    // Solo permitir que Administradores y Gestionadores reasignen masivamente
    if (userRole !== 'TECNICO' && assigned_technicians_ids !== undefined) {
      updateData.assigned_technicians = { set: assigned_technicians_ids.map((tid: string) => ({ id: tid })) };
    }

    // Auto-asignación al aceptar la orden (pasar de PENDIENTE a EN_PROCESO):
    // si no quedará ningún técnico asignado, se auto-asigna a quien la acepta,
    // sin importar su rol (técnico, gestionador o administrador).
    if (status === 'EN_PROCESO' && currentWorkOrder.status === 'PENDIENTE' && userId) {
      const willHaveTechnicians = (userRole !== 'TECNICO' && assigned_technicians_ids !== undefined)
        ? assigned_technicians_ids.length > 0
        : currentWorkOrder.assigned_technicians.length > 0;

      if (!willHaveTechnicians) {
        updateData.assigned_technicians = { set: [{ id: userId }] };
      }
    }
    
    if (status === 'EN_ESPERA') {
      updateData.hold_reason = hold_reason;
      if (currentWorkOrder.status !== 'EN_ESPERA') {
        updateData.paused_at = new Date();
      }
    }

    if (status && status !== 'EN_ESPERA' && currentWorkOrder.status === 'EN_ESPERA') {
      updateData.paused_at = null;
    }
    
    let didConsumeInventory = false;

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

      // Descontar inventario si se enviaron repuestos usados (atómico + ligado a la OT)
      if (parsedUsedItems && Array.isArray(parsedUsedItems) && parsedUsedItems.length > 0 && userId) {
        const folioLabel = formatWorkOrderFolio(currentWorkOrder.folio);
        try {
          await prisma.$transaction(async (tx) => {
            for (const part of parsedUsedItems) {
              if (!part.item_id || !part.amount) continue;
              const amountToDeduct = Math.abs(Number(part.amount));
              if (amountToDeduct <= 0) continue;

              const item = await tx.item.findUnique({ where: { id: part.item_id } });
              if (!item) {
                throw new Error(`Repuesto no encontrado (${part.item_id})`);
              }
              if (item.stock < amountToDeduct) {
                throw new Error(`Stock insuficiente de "${item.name}". Disponible: ${item.stock} ${item.uom}`);
              }

              await tx.inventoryTransaction.create({
                data: {
                  item_id: part.item_id,
                  user_id: userId,
                  work_order_id: id,
                  unit_cost: item.purchase_cost ?? 0,
                  amount: -amountToDeduct,
                  reason: `Consumo OT ${folioLabel}`,
                },
              });
              await tx.item.update({
                where: { id: part.item_id },
                data: { stock: { decrement: amountToDeduct } },
              });
              didConsumeInventory = true;
            }
          });
        } catch (consumeError: any) {
          res.status(400).json({ error: consumeError.message || 'No se pudo descontar el inventario al cerrar la OT' });
          return;
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

    // Comparar-y-actualizar: si el estado cambió en paralelo, 409
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const fresh = await tx.workOrder.findUnique({ where: { id } });
        if (!fresh) {
          throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
        }
        if (status && status !== currentWorkOrder.status && fresh.status !== currentWorkOrder.status) {
          throw Object.assign(new Error('CONFLICT'), {
            code: 'CONFLICT',
            current_status: fresh.status,
          });
        }
        return tx.workOrder.update({
          where: { id },
          data: updateData,
        });
      });

      emitWorkOrderUpdated(id);
      if (didConsumeInventory) emitRefresh('refresh_inventory');

      const actorName = userId
        ? (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name
        : null;
      const folioLabel = formatWorkOrderFolio(currentWorkOrder.folio);
      const statusPart =
        status && status !== currentWorkOrder.status
          ? `${currentWorkOrder.status} → ${status}`
          : 'datos actualizados';
      const assignPart =
        userRole !== 'TECNICO' && assigned_technicians_ids !== undefined
          ? `; técnicos: ${assigned_technicians_ids.length}`
          : '';
      await writeAuditLog({
        userId,
        userName: actorName,
        action: status && status !== currentWorkOrder.status ? 'UPDATE_WO_STATUS' : 'UPDATE_WORK_ORDER',
        entity: 'work_order',
        entityId: id,
        summary: `${folioLabel}: ${statusPart}${assignPart}`,
        meta: {
          from_status: currentWorkOrder.status,
          to_status: status || currentWorkOrder.status,
          assigned_technicians_ids: assigned_technicians_ids ?? null,
        },
      });

      res.json(updated);
    } catch (txError: any) {
      if (txError?.code === 'NOT_FOUND') {
        res.status(404).json({ error: 'Orden no encontrada' });
        return;
      }
      if (txError?.code === 'CONFLICT') {
        res.status(409).json({
          error: 'Otro usuario ya actualizó el estado de esta orden. Recarga e inténtalo de nuevo.',
          current_status: txError.current_status,
        });
        return;
      }
      throw txError;
    }
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

    if (currentWorkOrder.status === 'FINALIZADO') {
      res.status(400).json({ error: 'No se puede eliminar una orden finalizada.' });
      return;
    }

    await prisma.workOrder.delete({ where: { id } });
    emitWorkOrderUpdated(id);
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

    emitWorkOrderUpdated(id);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al unirse a la orden' });
  }
};
