import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { writeAuditLog } from '../utils/auditLog';
import { emitRefresh } from '../utils/socket';
import { emitWebhook } from '../services/webhookService';

interface RuleConditions {
  priorities?: string[];
  maintenance_types?: string[];
  asset_critical?: boolean;
  zone_ids?: string[];
}

function normalizeConditions(raw: unknown): RuleConditions {
  const source = (raw && typeof raw === 'object' ? raw : {}) as RuleConditions;
  const clean = (values: unknown): string[] =>
    Array.isArray(values) ? values.map((value) => String(value)).filter(Boolean) : [];
  return {
    priorities: clean(source.priorities),
    maintenance_types: clean(source.maintenance_types),
    asset_critical: Boolean(source.asset_critical),
    zone_ids: clean(source.zone_ids),
  };
}

/* ------------------------------- Reglas ------------------------------- */

/** GET /api/approval-rules */
export const getApprovalRules = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rules = await prisma.approvalRule.findMany({
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      include: { _count: { select: { approvals: true } } },
    });
    res.json(rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      is_active: rule.is_active,
      conditions: normalizeConditions(rule.conditions),
      sort_order: rule.sort_order,
      approvals_count: rule._count.approvals,
    })));
  } catch (error) {
    console.error('Error listando reglas de aprobación:', error);
    res.status(500).json({ error: 'No se pudieron obtener las reglas' });
  }
};

/** POST /api/approval-rules */
export const createApprovalRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? '').trim().slice(0, 80);
    if (!name) {
      res.status(400).json({ error: 'Escribe el nombre de la regla.' });
      return;
    }
    const conditions = normalizeConditions(req.body?.conditions);
    if (!conditions.priorities?.length && !conditions.maintenance_types?.length && !conditions.asset_critical && !conditions.zone_ids?.length) {
      res.status(400).json({ error: 'La regla necesita al menos una condición.' });
      return;
    }

    const maxOrder = await prisma.approvalRule.aggregate({ _max: { sort_order: true } });
    const created = await prisma.approvalRule.create({
      data: {
        name,
        is_active: req.body?.is_active === false ? false : true,
        conditions: conditions as unknown as object,
        sort_order: (maxOrder._max.sort_order ?? 0) + 1,
      },
    });

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'CREATE_APPROVAL_RULE',
      entity: 'approval_rule',
      entityId: created.id,
      summary: `Regla de aprobación creada: ${created.name}`,
    });
    emitRefresh('refresh_approvals');
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando regla de aprobación:', error);
    res.status(500).json({ error: 'No se pudo crear la regla' });
  }
};

/** PUT /api/approval-rules/:id */
export const updateApprovalRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const rule = await prisma.approvalRule.findUnique({ where: { id } });
    if (!rule) {
      res.status(404).json({ error: 'Regla no encontrada' });
      return;
    }
    const data: { name?: string; is_active?: boolean; conditions?: object } = {};
    if (typeof req.body?.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim().slice(0, 80);
    if (typeof req.body?.is_active === 'boolean') data.is_active = req.body.is_active;
    if (req.body?.conditions) data.conditions = normalizeConditions(req.body.conditions) as unknown as object;

    const updated = await prisma.approvalRule.update({ where: { id }, data });
    emitRefresh('refresh_approvals');
    res.json(updated);
  } catch (error) {
    console.error('Error actualizando regla:', error);
    res.status(500).json({ error: 'No se pudo actualizar la regla' });
  }
};

/** DELETE /api/approval-rules/:id */
export const deleteApprovalRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.approvalRule.delete({ where: { id } });
    emitRefresh('refresh_approvals');
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando regla:', error);
    res.status(500).json({ error: 'No se pudo eliminar la regla' });
  }
};

/* ------------------------- Evaluación y decisiones ------------------------- */

/**
 * Evalúa las reglas activas contra una orden y, si alguna aplica, deja la
 * aprobación pendiente. Devuelve la regla que aplicó (o null).
 */
export async function evaluateApproval(workOrderId: string): Promise<{ applied: boolean; ruleName?: string }> {
  try {
    const order = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        priority: true,
        maintenance_type: true,
        zone_id: true,
        approval_status: true,
        asset: { select: { is_critical: true } },
      },
    });
    if (!order) return { applied: false };
    // Si ya fue aprobada o rechazada, no se vuelve a pedir.
    if (order.approval_status !== 'NONE') return { applied: false };

    const rules = await prisma.approvalRule.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    });

    for (const rule of rules) {
      const conditions = normalizeConditions(rule.conditions);
      const matchPriority = conditions.priorities?.length ? conditions.priorities.includes(order.priority) : true;
      const matchType = conditions.maintenance_types?.length ? conditions.maintenance_types.includes(order.maintenance_type) : true;
      const matchCritical = conditions.asset_critical ? Boolean(order.asset?.is_critical) : true;
      const matchZone = conditions.zone_ids?.length ? Boolean(order.zone_id && conditions.zone_ids.includes(order.zone_id)) : true;

      if (matchPriority && matchType && matchCritical && matchZone) {
        await prisma.$transaction([
          prisma.workOrderApproval.create({
            data: { work_order_id: order.id, rule_id: rule.id, status: 'PENDIENTE' },
          }),
          prisma.workOrder.update({
            where: { id: order.id },
            data: { approval_status: 'PENDIENTE' },
          }),
        ]);
        emitRefresh('refresh_work_orders');
        emitRefresh('refresh_approvals');
        return { applied: true, ruleName: rule.name };
      }
    }

    return { applied: false };
  } catch (error) {
    console.error('Error evaluando aprobación:', error);
    return { applied: false };
  }
}

/** GET /api/approvals/pending */
export const getPendingApprovals = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pending = await prisma.workOrderApproval.findMany({
      where: { status: 'PENDIENTE' },
      orderBy: { requested_at: 'asc' },
      include: {
        rule: { select: { id: true, name: true } },
        work_order: {
          select: {
            id: true,
            folio: true,
            title: true,
            status: true,
            priority: true,
            maintenance_type: true,
            created_at: true,
            asset: { select: { name: true, internal_code: true, is_critical: true } },
            zone: { select: { name: true } },
          },
        },
      },
    });
    res.json(pending);
  } catch (error) {
    console.error('Error listando aprobaciones pendientes:', error);
    res.status(500).json({ error: 'No se pudieron obtener las aprobaciones' });
  }
};

/** POST /api/work-orders/:id/approve */
export const approveWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workOrderId = req.params.id as string;
    const order = await prisma.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true, folio: true, approval_status: true } });
    if (!order) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }
    if (order.approval_status !== 'PENDIENTE') {
      res.status(400).json({ error: 'La orden no tiene una aprobación pendiente.' });
      return;
    }

    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 500) : null;

    await prisma.$transaction([
      prisma.workOrderApproval.updateMany({
        where: { work_order_id: workOrderId, status: 'PENDIENTE' },
        data: {
          status: 'APROBADA',
          decided_at: new Date(),
          decided_by_id: req.user?.userId ?? null,
          comment,
        },
      }),
      prisma.workOrder.update({
        where: { id: workOrderId },
        data: { approval_status: 'APROBADA', last_activity_at: new Date() },
      }),
    ]);

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'APPROVE_WORK_ORDER',
      entity: 'work_order',
      entityId: workOrderId,
      summary: `Orden ${order.folio} aprobada`,
    });
    void emitWebhook('work_order.updated', { id: workOrderId, folio: order.folio, approval_status: 'APROBADA' });
    emitRefresh('refresh_work_orders');
    emitRefresh('refresh_approvals');
    res.json({ success: true, approval_status: 'APROBADA' });
  } catch (error) {
    console.error('Error aprobando orden:', error);
    res.status(500).json({ error: 'No se pudo aprobar la orden' });
  }
};

/** POST /api/work-orders/:id/reject */
export const rejectWorkOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const workOrderId = req.params.id as string;
    const order = await prisma.workOrder.findUnique({ where: { id: workOrderId }, select: { id: true, folio: true, approval_status: true } });
    if (!order) {
      res.status(404).json({ error: 'Orden no encontrada' });
      return;
    }
    if (order.approval_status !== 'PENDIENTE') {
      res.status(400).json({ error: 'La orden no tiene una aprobación pendiente.' });
      return;
    }

    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 500) : null;
    if (!comment) {
      res.status(400).json({ error: 'Escribe el motivo del rechazo.' });
      return;
    }

    await prisma.$transaction([
      prisma.workOrderApproval.updateMany({
        where: { work_order_id: workOrderId, status: 'PENDIENTE' },
        data: {
          status: 'RECHAZADA',
          decided_at: new Date(),
          decided_by_id: req.user?.userId ?? null,
          comment,
        },
      }),
      prisma.workOrder.update({
        where: { id: workOrderId },
        data: { approval_status: 'RECHAZADA', last_activity_at: new Date() },
      }),
    ]);

    await writeAuditLog({
      userId: req.user?.userId,
      action: 'REJECT_WORK_ORDER',
      entity: 'work_order',
      entityId: workOrderId,
      summary: `Orden ${order.folio} rechazada: ${comment}`,
    });
    void emitWebhook('work_order.updated', { id: workOrderId, folio: order.folio, approval_status: 'RECHAZADA' });
    emitRefresh('refresh_work_orders');
    emitRefresh('refresh_approvals');
    res.json({ success: true, approval_status: 'RECHAZADA' });
  } catch (error) {
    console.error('Error rechazando orden:', error);
    res.status(500).json({ error: 'No se pudo rechazar la orden' });
  }
};

/** GET /api/approvals/history/:workOrderId */
export const getApprovalHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const history = await prisma.workOrderApproval.findMany({
      where: { work_order_id: req.params.workOrderId as string },
      orderBy: { requested_at: 'desc' },
      include: {
        rule: { select: { name: true } },
        decided_by: { select: { name: true } },
      },
    });
    res.json(history);
  } catch (error) {
    console.error('Error obteniendo historial de aprobaciones:', error);
    res.status(500).json({ error: 'No se pudo obtener el historial' });
  }
};
