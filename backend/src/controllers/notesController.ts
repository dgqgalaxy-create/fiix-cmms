import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';
import { emitRefresh, getIO } from '../utils/socket';
import { sendWebPushToUsers } from '../utils/webPush';

const emitNotes = () => emitRefresh('refresh_notes');

const taskInclude = {
  created_by: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  work_order: { select: { id: true, folio: true, title: true } },
  asset: { select: { id: true, name: true, internal_code: true } },
} as const;

async function notifyUsers(
  userIds: string[],
  title: string,
  message: string,
  link: string
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  await prisma.appNotification.createMany({
    data: unique.map((user_id) => ({ user_id, title, message, link })),
  });
  try {
    getIO().emit('new_notification');
  } catch {
    // socket may not be ready
  }
  await sendWebPushToUsers(unique, { title, body: message, url: link });
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

// ─── Personal notes ───────────────────────────────────────────────

export const listPersonalNotes = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const includeDone = String(req.query.include_done || '') === '1';
    const notes = await prisma.personalNote.findMany({
      where: {
        user_id: userId,
        ...(includeDone ? {} : { is_done: false }),
      },
      orderBy: [{ is_done: 'asc' }, { remind_at: 'asc' }, { updated_at: 'desc' }],
      take: 200,
    });
    res.json(notes);
  } catch (error) {
    console.error('listPersonalNotes', error);
    res.status(500).json({ error: 'Error al listar notas' });
  }
};

export const createPersonalNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });

    const body =
      typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 4000) || null : null;
    const remindAt = parseOptionalDate(req.body?.remind_at);
    if (req.body?.remind_at != null && req.body.remind_at !== '' && remindAt === undefined) {
      return res.status(400).json({ error: 'Fecha de recordatorio inválida' });
    }

    const note = await prisma.personalNote.create({
      data: {
        user_id: userId,
        title: title.slice(0, 200),
        body,
        remind_at: remindAt ?? null,
      },
    });
    emitNotes();
    res.status(201).json(note);
  } catch (error) {
    console.error('createPersonalNote', error);
    res.status(500).json({ error: 'Error al crear nota' });
  }
};

export const updatePersonalNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.personalNote.findUnique({ where: { id } });
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const data: {
      title?: string;
      body?: string | null;
      remind_at?: Date | null;
      reminded_at?: Date | null;
      is_done?: boolean;
    } = {};

    if (typeof req.body?.title === 'string') {
      const title = req.body.title.trim();
      if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
      data.title = title.slice(0, 200);
    }
    if (req.body?.body !== undefined) {
      data.body =
        typeof req.body.body === 'string' ? req.body.body.trim().slice(0, 4000) || null : null;
    }
    if (req.body?.remind_at !== undefined) {
      const remindAt = parseOptionalDate(req.body.remind_at);
      if (req.body.remind_at !== null && req.body.remind_at !== '' && remindAt === undefined) {
        return res.status(400).json({ error: 'Fecha de recordatorio inválida' });
      }
      data.remind_at = remindAt ?? null;
      // Si cambian la fecha, permitir re-avisar
      if (remindAt && (!existing.remind_at || remindAt.getTime() !== existing.remind_at.getTime())) {
        data.reminded_at = null;
      }
    }
    if (typeof req.body?.is_done === 'boolean') {
      data.is_done = req.body.is_done;
    }

    const note = await prisma.personalNote.update({ where: { id }, data });
    emitNotes();
    res.json(note);
  } catch (error) {
    console.error('updatePersonalNote', error);
    res.status(500).json({ error: 'Error al actualizar nota' });
  }
};

export const deletePersonalNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.personalNote.findUnique({ where: { id } });
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    await prisma.personalNote.delete({ where: { id } });
    emitNotes();
    res.json({ ok: true });
  } catch (error) {
    console.error('deletePersonalNote', error);
    res.status(500).json({ error: 'Error al eliminar nota' });
  }
};

// ─── Operational tasks ────────────────────────────────────────────

export const listOperationalTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const includeDone = String(req.query.include_done || '') === '1';
    const scope = String(req.query.scope || 'mine'); // mine | created | all_open (admin-ish: still only related)

    const baseWhere =
      scope === 'created'
        ? { created_by_id: userId }
        : scope === 'assigned'
          ? { assignee_id: userId }
          : {
              OR: [{ assignee_id: userId }, { created_by_id: userId }],
            };

    const tasks = await prisma.operationalTask.findMany({
      where: {
        ...baseWhere,
        ...(includeDone ? {} : { status: 'OPEN' }),
      },
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { due_at: 'asc' }, { updated_at: 'desc' }],
      take: 200,
    });
    res.json(tasks);
  } catch (error) {
    console.error('listOperationalTasks', error);
    res.status(500).json({ error: 'Error al listar pendientes' });
  }
};

export const createOperationalTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'GESTIONADOR') {
      return res.status(403).json({
        error: 'Solo Administradores y Gestionadores pueden crear pendientes operativos',
      });
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });

    const assigneeId =
      typeof req.body?.assignee_id === 'string' && req.body.assignee_id
        ? req.body.assignee_id
        : userId;

    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, name: true, is_active: true, role: true },
    });
    if (!assignee || !assignee.is_active) {
      return res.status(400).json({ error: 'El asignado no existe o no está activo' });
    }

    let workOrderId: string | null = null;
    if (typeof req.body?.work_order_id === 'string' && req.body.work_order_id.trim()) {
      const wo = await prisma.workOrder.findUnique({
        where: { id: req.body.work_order_id.trim() },
        select: { id: true },
      });
      if (!wo) return res.status(400).json({ error: 'Orden de trabajo no encontrada' });
      workOrderId = wo.id;
    } else if (req.body?.folio != null && String(req.body.folio).trim() !== '') {
      const folio = Number(req.body.folio);
      if (!Number.isFinite(folio)) {
        return res.status(400).json({ error: 'Folio de OT inválido' });
      }
      const wo = await prisma.workOrder.findFirst({
        where: { folio },
        select: { id: true },
      });
      if (!wo) return res.status(400).json({ error: `No hay OT con folio ${folio}` });
      workOrderId = wo.id;
    }

    let assetId: string | null = null;
    if (typeof req.body?.asset_id === 'string' && req.body.asset_id.trim()) {
      const asset = await prisma.asset.findUnique({
        where: { id: req.body.asset_id.trim() },
        select: { id: true },
      });
      if (!asset) return res.status(400).json({ error: 'Activo no encontrado' });
      assetId = asset.id;
    } else if (typeof req.body?.asset_code === 'string' && req.body.asset_code.trim()) {
      const code = req.body.asset_code.trim();
      const asset = await prisma.asset.findFirst({
        where: { internal_code: { equals: code, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!asset) return res.status(400).json({ error: `No hay activo con código ${code}` });
      assetId = asset.id;
    }

    const body =
      typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 4000) || null : null;
    const dueAt = parseOptionalDate(req.body?.due_at);
    if (req.body?.due_at != null && req.body.due_at !== '' && dueAt === undefined) {
      return res.status(400).json({ error: 'Fecha de vencimiento inválida' });
    }

    const priorityRaw = typeof req.body?.priority === 'string' ? req.body.priority : 'NORMAL';
    const priority = priorityRaw === 'ALTA' ? 'ALTA' : 'NORMAL';

    const creator = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const task = await prisma.operationalTask.create({
      data: {
        title: title.slice(0, 200),
        body,
        created_by_id: userId,
        assignee_id: assigneeId,
        work_order_id: workOrderId,
        asset_id: assetId,
        due_at: dueAt ?? null,
        priority,
      },
      include: taskInclude,
    });

    if (assigneeId !== userId) {
      await notifyUsers(
        [assigneeId],
        'Nuevo pendiente operativo',
        `${creator?.name || 'Alguien'} te asignó: ${task.title}`,
        '/notes'
      );
    }

    emitNotes();
    res.status(201).json(task);
  } catch (error) {
    console.error('createOperationalTask', error);
    res.status(500).json({ error: 'Error al crear pendiente' });
  }
};

export const updateOperationalTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.operationalTask.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Pendiente no encontrado' });

    const isCreator = existing.created_by_id === userId;
    const isAssignee = existing.assignee_id === userId;
    const isManager =
      req.user?.role === 'ADMINISTRADOR' || req.user?.role === 'GESTIONADOR';
    if (!isCreator && !isAssignee) {
      return res.status(403).json({ error: 'No puedes modificar este pendiente' });
    }

    const wantsContentEdit =
      typeof req.body?.title === 'string' ||
      req.body?.body !== undefined ||
      req.body?.due_at !== undefined ||
      (typeof req.body?.assignee_id === 'string' && req.body.assignee_id) ||
      typeof req.body?.priority === 'string' ||
      req.body?.work_order_id !== undefined ||
      req.body?.asset_id !== undefined ||
      (typeof req.body?.status === 'string' &&
        (req.body.status === 'OPEN' || req.body.status === 'CANCELLED')) ||
      (req.body?.completion_note !== undefined &&
        typeof req.body?.status !== 'string');

    const wantsComplete =
      typeof req.body?.status === 'string' && req.body.status === 'DONE';

    // Solo Admin/Gestionador (creador) editan. Técnicos y asignados solo pueden completar.
    if (wantsContentEdit && !(isCreator && isManager)) {
      return res.status(403).json({
        error: 'Solo el Administrador o Gestionador que creó el pendiente puede editarlo',
      });
    }
    if (wantsComplete && !isCreator && !isAssignee) {
      return res.status(403).json({ error: 'No puedes completar este pendiente' });
    }
    if (!wantsComplete && !(isCreator && isManager)) {
      return res.status(403).json({
        error: 'Solo el creador (Admin/Gestionador) puede editar este pendiente',
      });
    }

    const data: Record<string, unknown> = {};

    if (isCreator && isManager && typeof req.body?.title === 'string') {
      const title = req.body.title.trim();
      if (!title) return res.status(400).json({ error: 'El título es obligatorio' });
      data.title = title.slice(0, 200);
    }
    if (isCreator && isManager && req.body?.body !== undefined) {
      data.body =
        typeof req.body.body === 'string' ? req.body.body.trim().slice(0, 4000) || null : null;
    }
    if (isCreator && isManager && req.body?.due_at !== undefined) {
      const dueAt = parseOptionalDate(req.body.due_at);
      if (req.body.due_at !== null && req.body.due_at !== '' && dueAt === undefined) {
        return res.status(400).json({ error: 'Fecha de vencimiento inválida' });
      }
      data.due_at = dueAt ?? null;
      if (dueAt && (!existing.due_at || dueAt.getTime() !== existing.due_at.getTime())) {
        data.reminded_at = null;
      }
    }
    if (isCreator && isManager && typeof req.body?.assignee_id === 'string' && req.body.assignee_id) {
      const assignee = await prisma.user.findUnique({
        where: { id: req.body.assignee_id },
        select: { id: true, is_active: true },
      });
      if (!assignee || !assignee.is_active) {
        return res.status(400).json({ error: 'El asignado no existe o no está activo' });
      }
      data.assignee_id = assignee.id;
    }
    if (isCreator && isManager && typeof req.body?.priority === 'string') {
      data.priority = req.body.priority === 'ALTA' ? 'ALTA' : 'NORMAL';
    }
    if (isCreator && isManager && req.body?.work_order_id !== undefined) {
      if (req.body.work_order_id === null || req.body.work_order_id === '') {
        data.work_order_id = null;
      } else if (typeof req.body.work_order_id === 'string') {
        const wo = await prisma.workOrder.findUnique({
          where: { id: req.body.work_order_id },
          select: { id: true },
        });
        if (!wo) return res.status(400).json({ error: 'Orden de trabajo no encontrada' });
        data.work_order_id = wo.id;
      }
    }
    if (isCreator && isManager && req.body?.asset_id !== undefined) {
      if (req.body.asset_id === null || req.body.asset_id === '') {
        data.asset_id = null;
      } else if (typeof req.body.asset_id === 'string') {
        const asset = await prisma.asset.findUnique({
          where: { id: req.body.asset_id },
          select: { id: true },
        });
        if (!asset) return res.status(400).json({ error: 'Activo no encontrado' });
        data.asset_id = asset.id;
      }
    }
    if (typeof req.body?.status === 'string') {
      const status = req.body.status;
      if (!['OPEN', 'DONE', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      if ((status === 'OPEN' || status === 'CANCELLED') && !(isCreator && isManager)) {
        return res.status(403).json({
          error: 'Solo el Administrador o Gestionador creador puede reabrir o cancelar',
        });
      }
      data.status = status;
      if (status === 'DONE') {
        data.completed_at = new Date();
        const note =
          typeof req.body?.completion_note === 'string'
            ? req.body.completion_note.trim().slice(0, 1000) || null
            : null;
        data.completion_note = note;
      } else if (status === 'OPEN') {
        data.completed_at = null;
        data.completion_note = null;
        data.reminded_at = null;
      } else {
        data.completed_at = null;
      }
    } else if (
      isCreator &&
      isManager &&
      req.body?.completion_note !== undefined &&
      existing.status === 'DONE'
    ) {
      data.completion_note =
        typeof req.body.completion_note === 'string'
          ? req.body.completion_note.trim().slice(0, 1000) || null
          : null;
    }

    const prevAssignee = existing.assignee_id;
    const task = await prisma.operationalTask.update({
      where: { id },
      data,
      include: taskInclude,
    });

    if (
      typeof data.assignee_id === 'string' &&
      data.assignee_id !== prevAssignee &&
      data.assignee_id !== userId
    ) {
      const actor = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      await notifyUsers(
        [data.assignee_id],
        'Pendiente reasignado',
        `${actor?.name || 'Alguien'} te asignó: ${task.title}`,
        '/notes'
      );
    }

    emitNotes();
    res.json(task);
  } catch (error) {
    console.error('updateOperationalTask', error);
    res.status(500).json({ error: 'Error al actualizar pendiente' });
  }
};

export const deleteOperationalTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.operationalTask.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Pendiente no encontrado' });
    if (existing.created_by_id !== userId && req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo el creador o un admin puede eliminarlo' });
    }
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'GESTIONADOR') {
      return res.status(403).json({ error: 'Los técnicos no pueden eliminar pendientes' });
    }

    await prisma.operationalTask.delete({ where: { id } });
    emitNotes();
    res.json({ ok: true });
  } catch (error) {
    console.error('deleteOperationalTask', error);
    res.status(500).json({ error: 'Error al eliminar pendiente' });
  }
};

/** Posponer recordatorio de nota personal: 1h o mañana 09:00 México. */
export const snoozePersonalNote = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.personalNote.findUnique({ where: { id } });
    if (!existing || existing.user_id !== userId) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }
    if (existing.is_done) {
      return res.status(400).json({ error: 'La nota ya está marcada como hecha' });
    }

    const mode = String(req.body?.mode || '1h');
    const next = computeSnoozeAt(mode);
    if (!next) {
      return res.status(400).json({ error: 'Modo de snooze inválido (usa 1h o tomorrow)' });
    }

    const note = await prisma.personalNote.update({
      where: { id },
      data: { remind_at: next, reminded_at: null, is_done: false },
    });
    emitNotes();
    res.json(note);
  } catch (error) {
    console.error('snoozePersonalNote', error);
    res.status(500).json({ error: 'Error al posponer recordatorio' });
  }
};

/** Posponer vencimiento de pendiente operativo. */
export const snoozeOperationalTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.operationalTask.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Pendiente no encontrado' });
    if (existing.created_by_id !== userId) {
      return res.status(403).json({
        error: 'Solo quien creó el pendiente puede posponerlo. El asignado solo puede verlo o completarlo.',
      });
    }
    if (req.user?.role !== 'ADMINISTRADOR' && req.user?.role !== 'GESTIONADOR') {
      return res.status(403).json({ error: 'Los técnicos no pueden posponer pendientes' });
    }
    if (existing.status !== 'OPEN') {
      return res.status(400).json({ error: 'Solo se posponen pendientes abiertos' });
    }

    const mode = String(req.body?.mode || '1h');
    const next = computeSnoozeAt(mode);
    if (!next) {
      return res.status(400).json({ error: 'Modo de snooze inválido (usa 1h o tomorrow)' });
    }

    const task = await prisma.operationalTask.update({
      where: { id },
      data: { due_at: next, reminded_at: null },
      include: taskInclude,
    });
    emitNotes();
    res.json(task);
  } catch (error) {
    console.error('snoozeOperationalTask', error);
    res.status(500).json({ error: 'Error al posponer pendiente' });
  }
};

function computeSnoozeAt(mode: string): Date | null {
  if (mode === '1h') {
    return new Date(Date.now() + 60 * 60 * 1000);
  }
  if (mode === 'tomorrow') {
    // Mañana 09:00 America/Mexico_City
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '01';
    const ymd = `${get('year')}-${get('month')}-${get('day')}`;
    const base = new Date(`${ymd}T00:00:00.000Z`);
    base.setUTCDate(base.getUTCDate() + 1);
    const y = base.getUTCFullYear();
    const m = String(base.getUTCMonth() + 1).padStart(2, '0');
    const d = String(base.getUTCDate()).padStart(2, '0');
    const tomorrowYmd = `${y}-${m}-${d}`;
    // 09:00 MX ≈ use noon UTC probe for offset then apply
    const probe = new Date(`${tomorrowYmd}T12:00:00.000Z`);
    const tzParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Mexico_City',
      timeZoneName: 'longOffset',
    }).formatToParts(probe);
    const tzName = tzParts.find((p) => p.type === 'timeZoneName')?.value || 'GMT-06:00';
    const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
    let offsetMinutes = -6 * 60;
    if (match) {
      const sign = match[1] === '-' ? -1 : 1;
      offsetMinutes = sign * (Number(match[2]) * 60 + Number(match[3] || '0'));
    }
    const localAsUtc = Date.UTC(y, Number(m) - 1, Number(d), 9, 0, 0, 0);
    return new Date(localAsUtc - offsetMinutes * 60_000);
  }
  return null;
}

/** Resumen para badges / Inicio */
export const notesSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [openNotes, openTasksAssigned, openTasksCreated] = await Promise.all([
      prisma.personalNote.count({ where: { user_id: userId, is_done: false } }),
      prisma.operationalTask.count({ where: { assignee_id: userId, status: 'OPEN' } }),
      prisma.operationalTask.count({
        where: { created_by_id: userId, status: 'OPEN', NOT: { assignee_id: userId } },
      }),
    ]);

    res.json({
      open_notes: openNotes,
      open_tasks_assigned: openTasksAssigned,
      open_tasks_created: openTasksCreated,
      open_total: openNotes + openTasksAssigned,
    });
  } catch (error) {
    console.error('notesSummary', error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
};
