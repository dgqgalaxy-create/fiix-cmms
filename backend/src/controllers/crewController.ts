import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitRefresh } from '../utils/socket';

/** GET /api/crews — cuadrillas con sus miembros y cuántas OT tienen asignadas. */
export const getCrews = async (_req: Request, res: Response): Promise<void> => {
  try {
    const crews = await prisma.crew.findMany({
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
      include: {
        zone: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
        _count: { select: { work_orders: true } },
      },
    });
    res.json(crews.map((crew) => ({
      id: crew.id,
      name: crew.name,
      description: crew.description,
      is_active: crew.is_active,
      zone: crew.zone,
      work_orders_count: crew._count.work_orders,
      members: crew.members.map((member) => ({
        id: member.id,
        user_id: member.user_id,
        role_label: member.role_label,
        name: member.user.name,
        email: member.user.email,
        role: member.user.role,
      })),
    })));
  } catch (error) {
    console.error('Error listando cuadrillas:', error);
    res.status(500).json({ error: 'No se pudieron obtener las cuadrillas' });
  }
};

/** POST /api/crews — { name, description?, zone_id?, members?: [{ user_id, role_label? }] } */
export const createCrew = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    if (!name) {
      res.status(400).json({ error: 'Escribe el nombre de la cuadrilla.' });
      return;
    }
    const existing = await prisma.crew.findUnique({ where: { name } });
    if (existing) {
      res.status(409).json({ error: 'Ya existe una cuadrilla con ese nombre.' });
      return;
    }

    const memberIds: string[] = Array.isArray(req.body?.members)
      ? ([...new Set(req.body.members.map((m: any) => String(m?.user_id ?? m)).filter(Boolean))] as string[])
      : [];

    const created = await prisma.crew.create({
      data: {
        name,
        description: typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 300) : null,
        zone_id: req.body?.zone_id ? String(req.body.zone_id) : null,
        members: memberIds.length
          ? { create: memberIds.map((userId) => ({ user_id: userId })) }
          : undefined,
      },
      include: { members: true },
    });

    emitRefresh('refresh_crews');
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando cuadrilla:', error);
    res.status(500).json({ error: 'No se pudo crear la cuadrilla' });
  }
};

/** PUT /api/crews/:id — { name?, description?, zone_id?, is_active?, members?: string[] } */
export const updateCrew = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const crew = await prisma.crew.findUnique({ where: { id } });
    if (!crew) {
      res.status(404).json({ error: 'Cuadrilla no encontrada' });
      return;
    }

    const data: { name?: string; description?: string | null; zone_id?: string | null; is_active?: boolean } = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim() && req.body.name.trim() !== crew.name) {
      const name = req.body.name.trim().slice(0, 60);
      const duplicate = await prisma.crew.findUnique({ where: { name } });
      if (duplicate) {
        res.status(409).json({ error: 'Ya existe una cuadrilla con ese nombre.' });
        return;
      }
      data.name = name;
    }
    if (req.body?.description !== undefined) {
      data.description = req.body.description ? String(req.body.description).trim().slice(0, 300) : null;
    }
    if (req.body?.zone_id !== undefined) {
      data.zone_id = req.body.zone_id ? String(req.body.zone_id) : null;
    }
    if (typeof req.body?.is_active === 'boolean') data.is_active = req.body.is_active;

    if (Array.isArray(req.body?.members)) {
      const memberIds = [...new Set(req.body.members.map((m: any) => String(m?.user_id ?? m)).filter(Boolean))] as string[];
      await prisma.$transaction([
        prisma.crewMember.deleteMany({ where: { crew_id: id } }),
        ...(memberIds.length
          ? [prisma.crewMember.createMany({ data: memberIds.map((userId) => ({ crew_id: id, user_id: userId })) })]
          : []),
      ]);
    }

    const updated = await prisma.crew.update({
      where: { id },
      data,
      include: {
        zone: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    });
    emitRefresh('refresh_crews');
    res.json({
      ...updated,
      members: updated.members.map((member) => ({
        id: member.id,
        user_id: member.user_id,
        role_label: member.role_label,
        name: member.user.name,
        email: member.user.email,
        role: member.user.role,
      })),
    });
  } catch (error) {
    console.error('Error actualizando cuadrilla:', error);
    res.status(500).json({ error: 'No se pudo actualizar la cuadrilla' });
  }
};

/** DELETE /api/crews/:id — las OT quedan sin cuadrilla (no se borran). */
export const deleteCrew = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const crew = await prisma.crew.findUnique({
      where: { id },
      include: { _count: { select: { work_orders: true } } },
    });
    if (!crew) {
      res.status(404).json({ error: 'Cuadrilla no encontrada' });
      return;
    }
    await prisma.crew.delete({ where: { id } });
    emitRefresh('refresh_crews');
    res.json({ success: true, detached_orders: crew._count.work_orders });
  } catch (error) {
    console.error('Error eliminando cuadrilla:', error);
    res.status(500).json({ error: 'No se pudo eliminar la cuadrilla' });
  }
};

/** GET /api/crews/:id/work-orders — órdenes asignadas a la cuadrilla. */
export const getCrewWorkOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const orders = await prisma.workOrder.findMany({
      where: { crew_id: id },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, folio: true, title: true, status: true, created_at: true },
    });
    res.json(orders);
  } catch (error) {
    console.error('Error listando OT de la cuadrilla:', error);
    res.status(500).json({ error: 'No se pudieron obtener las órdenes' });
  }
};

/** PUT /api/crews/assign/:workOrderId — asignar o quitar cuadrilla de una OT. */
export const assignCrewToWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workOrderId = req.params.workOrderId as string;
    const crewId = req.body?.crew_id ? String(req.body.crew_id) : null;

    if (crewId) {
      const crew = await prisma.crew.findUnique({ where: { id: crewId } });
      if (!crew) {
        res.status(404).json({ error: 'Cuadrilla no encontrada' });
        return;
      }
    }

    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: { crew_id: crewId },
      select: { id: true, folio: true, crew_id: true },
    });
    emitRefresh('refresh_work_orders');
    res.json(updated);
  } catch (error) {
    console.error('Error asignando cuadrilla:', error);
    res.status(500).json({ error: 'No se pudo asignar la cuadrilla' });
  }
};
