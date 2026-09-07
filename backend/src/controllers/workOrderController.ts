import { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitRefresh, emitWorkOrderUpdated } from '../utils/socket';
import { triggerNewWorkOrderNotification } from '../services/NotificationService';
import { computeWorkOrderSla, getSlaSettings } from '../services/SlaService';
import { formatWorkOrderFolio } from '../utils/folio';
import { parseDateInput } from '../utils/parseDateInput';
import { writeAuditLog } from '../utils/auditLog';
import { PRODUCTION_LINES, resolveProductionLine } from '../utils/assetSection';
import { resolvePartsUnitCost } from '../utils/resolvePartsUnitCost';
import { parseQty } from '../utils/qtyMode';
import { tryConsumeStock } from '../utils/stockMutation';
import { diffRequestedChanges, MAX_AUDIT_CHANGES } from '../utils/auditChanges';

const OPEN_WO_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] as const;

/** Calendar-day difference (UTC date parts) between two timestamps; never negative. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

/**
 * Home indicators: which L1–L5 lines are stopped by open CORRECTIVO/PREVENTIVO WOs with
 * machine_stopped=true, days since the last corrective stoppage event (any status except ANULADO),
 * and the all-time best streak (bestStreakDays).
 *
 * Streak definition (same filters for every event: CORRECTIVO + machine_stopped + L1–L5 + not ANULADO):
 * - A "stoppage event" is the created_at of such a work order.
 * - Completed streaks = calendar-day gaps between consecutive events (sorted ascending).
 * - Current streak = days from the latest event to now (0 if any L1–L5 line is currently stopped
 *   by an open CORRECTIVO WO — open PREVENTIVO stoppages appear on chips but do not reset the streak).
 * - bestStreakDays = max(completed gaps, current streak). We do NOT invent a gap before the
 *   first recorded event (no plant "start of history" date in data).
 */
export const getLineStoppageStatus = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const lineNames = [...PRODUCTION_LINES];
    const lineZoneOr = [
      { zone: { name: { in: lineNames, mode: 'insensitive' as const } } },
      { asset: { zone: { name: { in: lineNames, mode: 'insensitive' as const } } } },
    ];

    // Streak / récord: historically corrective-only.
    const stoppageWhere = {
      maintenance_type: 'CORRECTIVO' as const,
      machine_stopped: true,
      status: { not: 'ANULADO' as const },
      OR: lineZoneOr,
    };

    const stoppageSelect = {
      id: true,
      folio: true,
      title: true,
      status: true,
      maintenance_type: true,
      created_at: true,
      asset: { select: { name: true, zone: { select: { name: true } } } },
      zone: { select: { name: true } },
    } as const;

    const [openStopped, historicalStoppages] = await Promise.all([
      prisma.workOrder.findMany({
        where: {
          maintenance_type: { in: ['CORRECTIVO', 'PREVENTIVO'] },
          machine_stopped: true,
          status: { in: [...OPEN_WO_STATUSES] },
          OR: lineZoneOr,
        },
        select: stoppageSelect,
        orderBy: { created_at: 'desc' },
      }),
      prisma.workOrder.findMany({
        where: stoppageWhere,
        select: stoppageSelect,
        orderBy: { created_at: 'asc' },
      }),
    ]);

    type StoppedWo = {
      id: string;
      folio: number;
      title: string;
      assetName: string;
      status: string;
      created_at: string;
    };

    const byLine = new Map<string, StoppedWo[]>();
    for (const line of PRODUCTION_LINES) byLine.set(line, []);

    let currentlyStoppedCorrective = false;
    for (const wo of openStopped) {
      const line =
        resolveProductionLine(wo.zone?.name) ||
        resolveProductionLine(wo.asset?.zone?.name);
      if (!line) continue;
      if (wo.maintenance_type === 'CORRECTIVO') currentlyStoppedCorrective = true;
      byLine.get(line)!.push({
        id: wo.id,
        folio: wo.folio,
        title: wo.title,
        assetName: wo.asset?.name || 'Sin equipo',
        status: wo.status,
        created_at: wo.created_at.toISOString(),
      });
    }

    const stoppedLines = PRODUCTION_LINES
      .filter((line) => (byLine.get(line)?.length || 0) > 0)
      .map((line) => ({
        line,
        workOrders: byLine.get(line)!,
      }));

    const now = new Date();
    let daysWithoutStoppage: number | null = null;
    let bestStreakDays: number | null = null;
    let lastStoppagePayload: {
      id: string;
      folio: number;
      title: string;
      line: string;
      assetName: string;
      created_at: string;
    } | null = null;

    // Zero streak only for open corrective stoppages (not preventivo chip hits).
    if (currentlyStoppedCorrective) {
      daysWithoutStoppage = 0;
    }

    const lastStoppage = historicalStoppages.length > 0
      ? historicalStoppages[historicalStoppages.length - 1]
      : null;

    if (lastStoppage) {
      const line =
        resolveProductionLine(lastStoppage.zone?.name) ||
        resolveProductionLine(lastStoppage.asset?.zone?.name) ||
        '—';
      lastStoppagePayload = {
        id: lastStoppage.id,
        folio: lastStoppage.folio,
        title: lastStoppage.title,
        line,
        assetName: lastStoppage.asset?.name || 'Sin equipo',
        created_at: lastStoppage.created_at.toISOString(),
      };
      if (daysWithoutStoppage === null) {
        daysWithoutStoppage = calendarDaysBetween(lastStoppage.created_at, now);
      }

      // Max calendar-day gap between consecutive historical events.
      let maxGap = 0;
      for (let i = 1; i < historicalStoppages.length; i++) {
        const gap = calendarDaysBetween(
          historicalStoppages[i - 1].created_at,
          historicalStoppages[i].created_at,
        );
        if (gap > maxGap) maxGap = gap;
      }
      // Include the open streak (last → now), already 0 when a corrective line is currently stopped.
      const currentForBest = daysWithoutStoppage ?? 0;
      bestStreakDays = Math.max(maxGap, currentForBest);
    }

    res.json({
      lines: [...PRODUCTION_LINES],
      stoppedLines,
      daysWithoutStoppage,
      bestStreakDays,
      lastStoppageAt: lastStoppagePayload?.created_at ?? null,
      lastStoppage: lastStoppagePayload,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener estado de líneas paradas' });
  }
};

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

const WO_LIST_SELECT = {
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
  _count: { select: { comments: true } },
  comments: {
    orderBy: { created_at: 'desc' as const },
    take: 1,
    select: {
      id: true,
      body: true,
      created_at: true,
      attachment_url: true,
      author: { select: { id: true, name: true } },
    },
  },
};

function parseYmdEnd(value: string): Date {
  if (value.length <= 10) return new Date(`${value}T23:59:59.999`);
  return new Date(value);
}

function parseYmdStart(value: string): Date {
  if (value.length <= 10) return new Date(`${value}T00:00:00.000`);
  return new Date(value);
}

function buildWorkOrderWhere(req: AuthRequest): Record<string, unknown> {
  const {
    tab,
    status,
    priority,
    unassigned,
    q,
    requester,
    startDate,
    endDate,
    scheduledFrom,
    scheduledTo,
    completedFrom,
    completedTo,
    assignedTo,
    openOnly,
    includeUnscheduled,
  } = req.query;

  const and: Record<string, unknown>[] = [];

  const openStatuses = { notIn: ['FINALIZADO', 'ANULADO'] as const };

  if (tab === 'history') {
    and.push({ status: { in: ['FINALIZADO', 'ANULADO'] } });
  } else if (tab === 'active' || tab === 'mine') {
    and.push({ status: openStatuses });
  } else if (openOnly === '1' || openOnly === 'true') {
    and.push({ status: openStatuses });
  }

  if (tab === 'mine' || assignedTo) {
    const uid = String(assignedTo || req.user?.userId || '');
    if (uid) and.push({ assigned_technicians: { some: { id: uid } } });
  }

  if (status) and.push({ status: String(status) });
  if (priority) and.push({ priority: String(priority) });
  if (unassigned === '1' || unassigned === 'true') {
    and.push({ assigned_technicians: { none: {} } });
  }

  if (requester) {
    and.push({
      requester_name: { contains: String(requester), mode: 'insensitive' },
    });
  }

  if (startDate || endDate) {
    and.push({
      created_at: {
        ...(startDate ? { gte: parseYmdStart(String(startDate)) } : {}),
        ...(endDate ? { lte: parseYmdEnd(String(endDate)) } : {}),
      },
    });
  }

  if (completedFrom || completedTo) {
    and.push({
      completed_at: {
        ...(completedFrom ? { gte: parseYmdStart(String(completedFrom)) } : {}),
        ...(completedTo ? { lte: parseYmdEnd(String(completedTo)) } : {}),
      },
    });
  }

  if (scheduledFrom || scheduledTo) {
    const from = scheduledFrom ? parseYmdStart(String(scheduledFrom)) : undefined;
    const to = scheduledTo ? parseYmdEnd(String(scheduledTo)) : undefined;
    const scheduledClause = {
      AND: [
        { scheduled_date: { not: null } },
        { due_date: { not: null } },
        ...(from ? [{ due_date: { gte: from } }] : []),
        ...(to ? [{ scheduled_date: { lte: to } }] : []),
      ],
    };
    if (includeUnscheduled === '1' || includeUnscheduled === 'true') {
      and.push({
        OR: [
          scheduledClause,
          {
            AND: [
              { status: 'PENDIENTE' },
              {
                OR: [{ scheduled_date: null }, { due_date: null }],
              },
            ],
          },
        ],
      });
    } else {
      and.push(scheduledClause);
    }
  }

  if (q) {
    const term = String(q).trim();
    if (term) {
      const folioNum = Number(term.replace(/^fol-?/i, '').replace(/^wo-?/i, ''));
      and.push({
        OR: [
          ...(Number.isFinite(folioNum) && folioNum > 0 ? [{ folio: folioNum }] : []),
          { title: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { requester_name: { contains: term, mode: 'insensitive' } },
          { asset: { name: { contains: term, mode: 'insensitive' } } },
          { asset: { internal_code: { contains: term, mode: 'insensitive' } } },
          { zone: { name: { contains: term, mode: 'insensitive' } } },
        ],
      });
    }
  }

  return and.length ? { AND: and } : {};
}

function mapWorkOrdersWithSla(workOrders: any[], sla_policy: any) {
  return workOrders.map((wo) => {
    const { _count, comments, ...rest } = wo;
    const latest = comments[0] || null;
    return {
      ...rest,
      comments_count: _count.comments,
      latest_comment: latest
        ? {
            id: latest.id,
            body: latest.body,
            created_at: latest.created_at,
            has_attachment: Boolean(latest.attachment_url),
            author: latest.author,
          }
        : null,
      sla: computeWorkOrderSla(wo, sla_policy),
    };
  });
}

/** Conteo ligero para badge «Mis OT» (abiertas asignadas al usuario). */
export const getMineOpenCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    const count = await prisma.workOrder.count({
      where: {
        status: { notIn: ['FINALIZADO', 'ANULADO'] },
        assigned_technicians: { some: { id: userId } },
      },
    });
    res.json({ count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al contar órdenes' });
  }
};

export const getWorkOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const where = buildWorkOrderWhere(req);
    const { page, limit, sort } = req.query;
    const wantsPage = page != null || limit != null;

    let orderBy: any = { created_at: 'desc' };
    if (sort === 'oldest') orderBy = { folio: 'asc' };
    else if (sort === 'newest') orderBy = { folio: 'desc' };
    else if (sort === 'priority') orderBy = [{ priority: 'desc' }, { folio: 'desc' }];

    const { sla_policy } = await getSlaSettings();

    if (wantsPage) {
      const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
      const limitNum = Math.min(200, Math.max(1, parseInt(String(limit || '20'), 10) || 20));
      const [total, workOrders] = await Promise.all([
        prisma.workOrder.count({ where }),
        prisma.workOrder.findMany({
          where,
          select: WO_LIST_SELECT,
          orderBy,
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      const data = mapWorkOrdersWithSla(workOrders, sla_policy);
      res.json({
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      });
      return;
    }

    // Sin page/limit: lista filtrada completa (compat + export / calendario acotado).
    const workOrders = await prisma.workOrder.findMany({
      where,
      select: WO_LIST_SELECT,
      orderBy,
    });
    res.json(mapWorkOrdersWithSla(workOrders, sla_policy));
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
      return sum + qty * resolvePartsUnitCost(tx);
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
    
    // Transiciones de pausa/reanudación/cierre y consumo de repuestos: se resuelven
    // DENTRO de la transacción final, bajo bloqueo de la OT (ver más abajo). Así el
    // cierre y los descuentos son todo-o-nada: si el cierre falla (p. ej. conflicto 409
    // por otra actualización en paralelo), ningún repuesto queda descontado.

    // Repuestos usados: llegan como JSON string (FormData) o como arreglo directo.
    const parsedUsedItems: Array<{ item_id?: string; amount: unknown }> = [];
    if (used_items !== undefined && used_items !== null && String(used_items).trim() !== '') {
      let raw: unknown = used_items;
      if (typeof used_items === 'string') {
        try {
          raw = JSON.parse(used_items);
        } catch {
          res.status(400).json({ error: 'La lista de repuestos utilizados no es válida.' });
          return;
        }
      }
      if (!Array.isArray(raw)) {
        res.status(400).json({ error: 'La lista de repuestos utilizados no es válida.' });
        return;
      }
      for (const part of raw) {
        if (part && typeof part === 'object' && typeof (part as any).item_id === 'string') {
          parsedUsedItems.push({ item_id: (part as any).item_id, amount: (part as any).amount });
        }
      }
    }

    // Cierre: transición a FINALIZADO. completed_at y consumo se resuelven bajo bloqueo.
    const closing = status === 'FINALIZADO' && currentWorkOrder.status !== 'FINALIZADO';

    let didConsumeInventory = false;
    // Cantidades YA validadas (parseQty) por ítem consumido, para auditar con precisión.
    const consumedByItem = new Map<string, number>();
    // Si el cierre recorta la labor acumulada al tope int32, se deja constancia en la bitácora.
    let laborClampedAtClose = false;

    // Construir URLs de las imágenes
    if (files && files['before_image']) {
      updateData.before_image_url = `/uploads/${files['before_image'][0].filename}`;
    }
    if (files && files['after_image']) {
      updateData.after_image_url = `/uploads/${files['after_image'][0].filename}`;
    }

    // Comparar-y-actualizar bajo bloqueo de fila: cierre de la OT + consumo de repuestos
    // en UNA sola transacción (todo-o-nada). Si algo falla, la transacción revierte y no
    // queda ni el estado cambiado ni repuestos descontados.
    try {
      const updated = await prisma.$transaction(
        async (tx) => {
          // 1) Serializar los cambios sobre esta OT (cierres concurrentes se encolan aquí).
          await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "WorkOrder" WHERE id = ${id}::uuid FOR UPDATE`;

          const fresh = await tx.workOrder.findUnique({ where: { id } });
          if (!fresh) {
            throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
          }
          // El estado cambió en paralelo respecto a la lectura inicial → 409 (rollback total).
          if (status && status !== currentWorkOrder.status && fresh.status !== currentWorkOrder.status) {
            throw Object.assign(new Error('CONFLICT'), {
              code: 'CONFLICT',
              current_status: fresh.status,
            });
          }

          const merged: any = { ...updateData };

          // Pausar (EN_ESPERA): registrar motivo y momento de pausa.
          if (status === 'EN_ESPERA') {
            merged.hold_reason = hold_reason;
            if (fresh.status !== 'EN_ESPERA') {
              merged.paused_at = new Date();
            }
          }

          // Reanudar desde EN_ESPERA: limpiar la pausa.
          if (status && status !== 'EN_ESPERA' && fresh.status === 'EN_ESPERA') {
            merged.paused_at = null;
          }

          // Aceptar / reanudar trabajo: marcar inicio o última reanudación.
          if (status === 'EN_PROCESO' && fresh.status !== 'EN_PROCESO') {
            if (!fresh.started_at) {
              merged.started_at = new Date();
            }
            merged.last_resumed_at = new Date();
          }

          // Acumular tiempo de labor al pausar o finalizar (usa la fila ya bloqueada).
          if ((status === 'EN_ESPERA' || status === 'FINALIZADO') && fresh.status === 'EN_PROCESO') {
            if (fresh.last_resumed_at) {
              // La columna es entero de 32 bits (~24.8 días): se recorta al máximo para
              // no romper el cierre con un overflow de PostgreSQL y se deja constancia
              // en la bitácora (laborClampedAtClose); el import CSV ya avisa por fila.
              const rawAccumulated =
                fresh.accumulated_time_ms + (Date.now() - fresh.last_resumed_at.getTime());
              if (rawAccumulated > 2_147_483_647) {
                laborClampedAtClose = true;
              }
              merged.accumulated_time_ms = Math.min(2_147_483_647, rawAccumulated);
            }
            merged.last_resumed_at = null;
          }

          // Cierre: estampar completed_at y descontar repuestos en la misma transacción.
          if (closing) {
            // Preservar completed_at importado por CSV; solo estampar ahora si falta.
            merged.completed_at = fresh.completed_at ?? new Date();

            if (userId && parsedUsedItems.length > 0) {
              const folioLabel = formatWorkOrderFolio(fresh.folio);
              // Orden estable por item_id: evita interbloqueos entre cierres concurrentes
              // que consuman los mismos repuestos en distinto orden.
              const ordered = [...parsedUsedItems].sort((a, b) =>
                String(a.item_id).localeCompare(String(b.item_id))
              );
              for (const part of ordered) {
                if (!part.item_id) continue;

                const item = await tx.item.findUnique({ where: { id: part.item_id } });
                if (!item) {
                  throw Object.assign(new Error(`Repuesto no encontrado (${part.item_id})`), {
                    httpStatus: 400,
                  });
                }

                const quantity = parseQty(part.amount, item.qty_mode, {
                  fieldLabel: `La cantidad de "${item.name}"`,
                });
                if (!quantity.ok) {
                  throw Object.assign(new Error(quantity.error), { httpStatus: 400 });
                }

                // Baja atómica condicional: nunca deja el stock negativo, aunque otro
                // proceso retire el mismo ítem al mismo tiempo.
                const result = await tryConsumeStock(tx, item.id, quantity.value);
                if (!result.ok) {
                  throw Object.assign(
                    new Error(
                      `Stock insuficiente de "${item.name}". Disponible: ${result.available} ${item.uom}`
                    ),
                    { httpStatus: 400 }
                  );
                }

                await tx.inventoryTransaction.create({
                  data: {
                    item_id: item.id,
                    user_id: userId,
                    work_order_id: id,
                    unit_cost: item.purchase_cost ?? 0,
                    amount: -quantity.value,
                    reason: `Consumo OT ${folioLabel}`,
                  },
                });
                consumedByItem.set(item.id, quantity.value);
                didConsumeInventory = true;
              }
            }
          }

          return tx.workOrder.update({
            where: { id },
            data: merged,
          });
        },
        { maxWait: 10_000, timeout: 20_000 }
      );

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

      // Cambios concretos (antes → después) cuando es edición de datos (no transición).
      let editChanges: Array<{ campo: string; antes: unknown; despues: unknown }> = [];
      const isTransition = status && status !== currentWorkOrder.status;
      if (!isTransition) {
        const labels: Record<string, string> = {
          priority: 'prioridad',
          maintenance_type: 'tipo de mantenimiento',
          machine_stopped: 'paro de máquina',
          requester_name: 'solicitante',
          production_group: 'grupo',
          zone_id: 'zona',
          scheduled_date: 'fecha programada',
          due_date: 'fecha límite',
          resolution_notes: 'notas de resolución',
          hold_reason: 'motivo de espera',
          signature_clean_area: 'firma área limpia',
          signature_delivery: 'firma entrega',
          title: 'título',
          description: 'descripción',
        };
        const beforeRec: Record<string, unknown> = {
          priority: currentWorkOrder.priority,
          maintenance_type: currentWorkOrder.maintenance_type,
          machine_stopped: currentWorkOrder.machine_stopped,
          requester_name: currentWorkOrder.requester_name,
          production_group: currentWorkOrder.production_group,
          zone_id: currentWorkOrder.zone_id,
          scheduled_date: currentWorkOrder.scheduled_date,
          due_date: currentWorkOrder.due_date,
          resolution_notes: currentWorkOrder.resolution_notes,
          hold_reason: currentWorkOrder.hold_reason,
          signature_clean_area: currentWorkOrder.signature_clean_area,
          signature_delivery: currentWorkOrder.signature_delivery,
          title: currentWorkOrder.title,
          description: currentWorkOrder.description,
        };
        // Solo campos que el cliente tocó (evita "cambios" por claves undefined).
        const has = (k: string) => (req.body as Record<string, unknown>)[k] !== undefined;
        const requestedEdit: Record<string, unknown> = {};
        if (has('priority')) requestedEdit.priority = updateData.priority;
        if (has('maintenance_type')) requestedEdit.maintenance_type = updateData.maintenance_type;
        if (has('machine_stopped')) requestedEdit.machine_stopped = updateData.machine_stopped;
        if (has('requester_name')) requestedEdit.requester_name = updateData.requester_name;
        if (has('production_group')) requestedEdit.production_group = updateData.production_group;
        if (has('zone_id')) requestedEdit.zone_id = updateData.zone_id;
        if (has('scheduled_date')) requestedEdit.scheduled_date = updateData.scheduled_date;
        if (has('due_date')) requestedEdit.due_date = updateData.due_date;
        if (has('resolution_notes')) requestedEdit.resolution_notes = updateData.resolution_notes;
        if (has('hold_reason')) requestedEdit.hold_reason = updateData.hold_reason;
        if (has('signature_clean_area')) requestedEdit.signature_clean_area = updateData.signature_clean_area;
        if (has('signature_delivery')) requestedEdit.signature_delivery = updateData.signature_delivery;
        editChanges = diffRequestedChanges(beforeRec, requestedEdit, labels).slice(0, MAX_AUDIT_CHANGES);
      }

      await writeAuditLog({
        userId,
        userName: actorName,
        action: isTransition ? 'UPDATE_WO_STATUS' : 'UPDATE_WORK_ORDER',
        entity: 'work_order',
        entityId: id,
        summary: `${folioLabel}: ${statusPart}${assignPart}${editChanges.length ? ` · ${editChanges.length} campo(s) editado(s)` : ''}`,
        meta: {
          from_status: currentWorkOrder.status,
          to_status: status || currentWorkOrder.status,
          assigned_technicians_ids: assigned_technicians_ids ?? null,
          ...(editChanges.length > 0
            ? { changes: editChanges as unknown as Prisma.InputJsonValue }
            : {}),
          consumed_parts: didConsumeInventory
            ? (Array.from(consumedByItem.entries()).map(([itemId, amount]) => ({
                item_id: itemId,
                amount,
              })) as unknown as Prisma.InputJsonValue)
            : null,
          labor_clamped_at_close: laborClampedAtClose || undefined,
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
      // Errores de negocio lanzados dentro de la transacción (consumo inválido, stock
      // insuficiente, repuesto inexistente…). La transacción ya se revirtió completa.
      if (txError?.httpStatus && Number.isInteger(txError.httpStatus)) {
        res.status(txError.httpStatus).json({
          error: txError.message || 'No se pudo cerrar la orden de trabajo',
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
