import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { writeAuditLog } from '../utils/auditLog';

const parseRate = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

/** GET /api/contractors */
export const getContractors = async (_req: Request, res: Response): Promise<void> => {
  try {
    const contractors = await prisma.contractor.findMany({
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { work_orders: true } } },
    });
    res.json(contractors.map((contractor) => ({
      ...contractor,
      work_orders_count: contractor._count.work_orders,
    })));
  } catch (error) {
    console.error('Error listando contratistas:', error);
    res.status(500).json({ error: 'No se pudieron obtener los contratistas' });
  }
};

/** POST /api/contractors */
export const createContractor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 120);
    if (!name) {
      res.status(400).json({ error: 'Escribe el nombre del contratista.' });
      return;
    }

    const created = await prisma.contractor.create({
      data: {
        name,
        contact_name: typeof req.body?.contact_name === 'string' ? req.body.contact_name.trim().slice(0, 120) : null,
        phone: typeof req.body?.phone === 'string' ? req.body.phone.trim().slice(0, 40) : null,
        email: typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 120) : null,
        specialty: typeof req.body?.specialty === 'string' ? req.body.specialty.trim().slice(0, 120) : null,
        hourly_rate: parseRate(req.body?.hourly_rate),
        visit_rate: parseRate(req.body?.visit_rate),
        contract_start: parseDate(req.body?.contract_start),
        contract_end: parseDate(req.body?.contract_end),
        notes: typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 500) : null,
      },
    });

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'CREATE_CONTRACTOR',
      entity: 'contractor',
      entityId: created.id,
      summary: `Contratista creado: ${created.name}`,
    });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando contratista:', error);
    res.status(500).json({ error: 'No se pudo crear el contratista' });
  }
};

/** PUT /api/contractors/:id */
export const updateContractor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.contractor.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Contratista no encontrado' });
      return;
    }

    const data: Record<string, unknown> = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim().slice(0, 120);
    if (req.body?.contact_name !== undefined) data.contact_name = req.body.contact_name ? String(req.body.contact_name).slice(0, 120) : null;
    if (req.body?.phone !== undefined) data.phone = req.body.phone ? String(req.body.phone).slice(0, 40) : null;
    if (req.body?.email !== undefined) data.email = req.body.email ? String(req.body.email).slice(0, 120) : null;
    if (req.body?.specialty !== undefined) data.specialty = req.body.specialty ? String(req.body.specialty).slice(0, 120) : null;
    if (req.body?.hourly_rate !== undefined) data.hourly_rate = parseRate(req.body.hourly_rate);
    if (req.body?.visit_rate !== undefined) data.visit_rate = parseRate(req.body.visit_rate);
    if (req.body?.contract_start !== undefined) data.contract_start = parseDate(req.body.contract_start);
    if (req.body?.contract_end !== undefined) data.contract_end = parseDate(req.body.contract_end);
    if (req.body?.notes !== undefined) data.notes = req.body.notes ? String(req.body.notes).slice(0, 500) : null;
    if (typeof req.body?.is_active === 'boolean') data.is_active = req.body.is_active;

    const updated = await prisma.contractor.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando contratista:', error);
    res.status(500).json({ error: 'No se pudo actualizar el contratista' });
  }
};

/** DELETE /api/contractors/:id — las OT quedan sin contratista. */
export const deleteContractor = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: { _count: { select: { work_orders: true } } },
    });
    if (!contractor) {
      res.status(404).json({ error: 'Contratista no encontrado' });
      return;
    }
    await prisma.contractor.delete({ where: { id } });
    await writeAuditLog({
      userId: req.user?.userId,
      action: 'DELETE_CONTRACTOR',
      entity: 'contractor',
      entityId: id,
      summary: `Contratista eliminado: ${contractor.name}`,
    });
    res.json({ success: true, detached_orders: contractor._count.work_orders });
  } catch (error) {
    console.error('Error eliminando contratista:', error);
    res.status(500).json({ error: 'No se pudo eliminar el contratista' });
  }
};
