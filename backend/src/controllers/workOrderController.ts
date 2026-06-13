import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getWorkOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workOrders = await prisma.workOrder.findMany({
      include: {
        asset: true,
        created_by: { select: { id: true, name: true } },
        assigned_to: { select: { id: true, name: true } }
      }
    });
    res.json(workOrders);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener órdenes de trabajo' });
  }
};

export const getWorkOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        asset: true,
        created_by: { select: { id: true, name: true } },
        assigned_to: { select: { id: true, name: true } }
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
    const { title, description, asset_id, assigned_to_id } = req.body;
    
    if (!req.user) {
      res.status(401).json({ error: 'No autorizado' });
      return;
    }

    const newWorkOrder = await prisma.workOrder.create({
      data: {
        title,
        description,
        asset_id,
        status: 'PENDIENTE',
        created_by_id: req.user.userId,
        assigned_to_id
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
    const { title, description, asset_id, status, hold_reason, resolution_notes } = req.body;
    const userRole = req.user?.role;

    // Regla estricta: Los técnicos no pueden editar datos de origen.
    if (userRole === 'TECNICO') {
      if (title !== undefined || description !== undefined || asset_id !== undefined) {
        res.status(403).json({ error: 'Prohibido: Los Técnicos no pueden alterar el título, descripción o el activo de la orden.' });
        return;
      }
    }

    // Multer inyecta los archivos aquí
    const files = (req as any).files as { [fieldname: string]: Express.Multer.File[] };
    
    const updateData: any = { status, resolution_notes };
    
    if (status === 'EN_ESPERA') {
      updateData.hold_reason = hold_reason;
    }
    
    if (status === 'FINALIZADO') {
      updateData.completed_at = new Date();
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
