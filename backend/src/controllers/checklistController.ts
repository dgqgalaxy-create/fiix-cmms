import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/prisma';
import { emitRefresh, getIO } from '../utils/socket';
import { validateChecklistForSubmit, rowHasFailAnomaly } from '../utils/checklistValidation';
import { getMexicoCityNow } from '../utils/checklistReminder';
import { writeAuditLog } from '../utils/auditLog';
import { sendWebPushToUsers } from '../utils/webPush';

const emitChecklists = () => emitRefresh('refresh_checklists');

export const MIN_CHECKLIST_COLUMNS = 1;
export const MAX_CHECKLIST_COLUMNS = 12;
const DEFAULT_CHECKLIST_COLUMNS = 5;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

const pendingTransferInclude = {
  from_user: { select: { id: true, name: true } },
  to_user: { select: { id: true, name: true } },
} as const;

const pendingContinuationInclude = {
  requested_by: { select: { id: true, name: true } },
  resolved_by: { select: { id: true, name: true } },
} as const;

const checklistDetailInclude = {
  technician: { select: { name: true } },
  leader: { select: { name: true } },
  rows: { orderBy: { order: 'asc' as const } },
};

async function findPendingTransfer(checklistId: string) {
  return prisma.checklistTransfer.findFirst({
    where: { checklist_id: checklistId, status: 'PENDING' },
    include: pendingTransferInclude,
  });
}

async function findPendingContinuation(checklistId: string) {
  return prisma.checklistContinuationRequest.findFirst({
    where: { checklist_id: checklistId, status: 'PENDING' },
    include: pendingContinuationInclude,
  });
}

async function notifyChecklistUsers(
  userIds: string[],
  title: string,
  message: string,
  checklistId: string
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  const link = `/checklists/${checklistId}`;
  await prisma.appNotification.createMany({
    data: unique.map((user_id) => ({
      user_id,
      title,
      message,
      link,
    })),
  });
  try {
    getIO().emit('new_notification');
  } catch {
    // socket may not be ready
  }
  await sendWebPushToUsers(unique, { title, body: message, url: link });
}

async function activeAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMINISTRADOR', is_active: true },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

async function withPendingExtras<T extends { id: string }>(checklist: T | null) {
  if (!checklist) return null;
  const [pending_transfer, pending_continuation] = await Promise.all([
    findPendingTransfer(checklist.id),
    findPendingContinuation(checklist.id),
  ]);
  return { ...checklist, pending_transfer, pending_continuation };
}

export function normalizeChecklistColumnCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_CHECKLIST_COLUMNS;
  return Math.min(MAX_CHECKLIST_COLUMNS, Math.max(MIN_CHECKLIST_COLUMNS, Math.round(n)));
}

function asLineStatuses(value: unknown): Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string | null> = {};
  for (const [key, status] of Object.entries(value as Record<string, unknown>)) {
    out[String(key)] = status == null ? null : String(status);
  }
  return out;
}

async function getConfiguredColumnCount(): Promise<number> {
  const settings = await prisma.systemSettings.findFirst();
  return normalizeChecklistColumnCount(settings?.checklist_column_count ?? DEFAULT_CHECKLIST_COLUMNS);
}

/** Día civil del checklist en horario México (alineado con recordatorios Telegram). */
function getChecklistTodayDate(): Date {
  return getMexicoCityNow().asDate;
}

export const getTodayChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const today = getChecklistTodayDate();

    const checklist = await prisma.dailyChecklist.findFirst({
      where: {
        date: today
      },
      include: {
        technician: { select: { name: true } },
        leader: { select: { name: true } },
        rows: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error fetching today checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createTodayChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const today = getChecklistTodayDate();
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if it already exists
    const existing = await prisma.dailyChecklist.findFirst({
      where: { date: today }
    });

    if (existing) {
      return res.status(400).json({ error: 'Checklist for today already exists' });
    }

    // Get activities
    const activities = await prisma.checklistActivity.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' }
    });

    const columnCount = await getConfiguredColumnCount();

    const checklist = await prisma.dailyChecklist.create({
      data: {
        date: today,
        status: 'DRAFT',
        column_count: columnCount,
        rows: {
          create: activities.map(act => ({
            activity_name: act.name,
            order: act.order,
            field_type: act.field_type,
            line_statuses: {},
          }))
        }
      },
      include: {
        technician: { select: { name: true } },
        rows: {
          orderBy: { order: 'asc' }
        }
      }
    });

    emitChecklists();
    res.json(checklist);
  } catch (error) {
    console.error('Error creating today checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Reclama el checklist DRAFT: asigna technician_id al usuario actual. */
export const startChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: {
        technician: { select: { name: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }

    if (existing.status === 'NON_COMPLIANCE') {
      return res.status(400).json({
        error: 'Este checklist está en incumplimiento. Un administrador debe asignar técnico y aprobar la solicitud de continuación.',
      });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Solo se puede iniciar un checklist en borrador' });
    }

    const pendingTransfer = await findPendingTransfer(id);
    if (pendingTransfer) {
      return res.status(409).json({
        error: 'Hay un traspaso pendiente en este checklist. No se puede iniciar hasta resolverlo.',
      });
    }

    if (existing.technician_id && existing.technician_id !== userId) {
      return res.status(409).json({
        error: `Este checklist ya fue iniciado por ${existing.technician?.name || 'otro técnico'}`,
      });
    }

    if (existing.technician_id === userId) {
      const same = await prisma.dailyChecklist.findUnique({
        where: { id },
        include: checklistDetailInclude,
      });
      return res.json(await withPendingExtras(same));
    }

    const checklist = await prisma.dailyChecklist.update({
      where: { id },
      data: { technician_id: userId },
      include: checklistDetailInclude,
    });

    emitChecklists();
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error starting checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateChecklistRow = async (req: AuthRequest, res: Response) => {
  try {
    const rowId = req.params.rowId as string;
    const userId = req.user?.userId;
    const { observations, line, status, line_statuses } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklistRow.findUnique({
      where: { id: rowId },
      include: {
        checklist: { select: { column_count: true, status: true, technician_id: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ error: 'Fila no encontrada' });
      return;
    }

    if (existing.checklist.status === 'NON_COMPLIANCE') {
      res.status(400).json({
        error: 'Checklist en incumplimiento: no se puede editar hasta que un administrador apruebe la continuación.',
      });
      return;
    }
    if (existing.checklist.status !== 'DRAFT') {
      res.status(400).json({ error: 'El checklist ya no es editable' });
      return;
    }

    if (!existing.checklist.technician_id) {
      res.status(403).json({
        error: 'Debes pulsar «Iniciar checklist» antes de editar.',
      });
      return;
    }

    if (existing.checklist.technician_id !== userId) {
      res.status(403).json({
        error: 'Solo el técnico que inició este checklist puede editarlo.',
      });
      return;
    }

    const data: { observations?: string | null; line_statuses?: Record<string, string | null> } = {};
    if (observations !== undefined) data.observations = observations;

    let nextStatuses = asLineStatuses(existing.line_statuses);

    if (line_statuses !== undefined) {
      nextStatuses = asLineStatuses(line_statuses);
    }

    // Legacy L1_status..L5_status payloads
    for (let i = 1; i <= 5; i++) {
      const key = `L${i}_status`;
      if (req.body[key] !== undefined) {
        nextStatuses[String(i)] = req.body[key] == null ? null : String(req.body[key]);
      }
    }

    if (line !== undefined) {
      const lineNum = Number(line);
      if (!Number.isFinite(lineNum) || lineNum < 1 || lineNum > existing.checklist.column_count) {
        res.status(400).json({ error: `Línea inválida. Usa 1–${existing.checklist.column_count}.` });
        return;
      }
      nextStatuses[String(lineNum)] = status == null || status === '' ? null : String(status);
    }

    if (line !== undefined || line_statuses !== undefined || [1, 2, 3, 4, 5].some((i) => req.body[`L${i}_status`] !== undefined)) {
      data.line_statuses = nextStatuses;
    }

    const row = await prisma.dailyChecklistRow.update({
      where: { id: rowId },
      data
    });

    emitChecklists();
    res.json(row);
  } catch (error) {
    console.error('Error updating checklist row', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: { rows: { orderBy: { order: 'asc' } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }

    if (existing.status === 'NON_COMPLIANCE') {
      return res.status(400).json({
        error: 'Checklist en incumplimiento: solicita continuar y espera aprobación del administrador.',
      });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'El checklist ya fue enviado o revisado' });
    }

    if (!existing.technician_id) {
      return res.status(403).json({
        error: 'Debes pulsar «Iniciar checklist» antes de enviar.',
      });
    }

    if (existing.technician_id !== userId) {
      return res.status(403).json({
        error: 'Solo el técnico que inició este checklist puede enviarlo.',
      });
    }

    const validation = validateChecklistForSubmit(
      existing.rows,
      existing.column_count ?? DEFAULT_CHECKLIST_COLUMNS
    );

    if (!validation.ok) {
      return res.status(400).json({
        error: validation.errorMessage,
        missing: validation.missing,
      });
    }

    const pendingBeforeSubmit = await prisma.checklistTransfer.findMany({
      where: { checklist_id: id, status: 'PENDING' },
      select: { to_user_id: true, from_user_id: true },
    });

    const checklist = await prisma.$transaction(async (tx) => {
      const cols = existing.column_count ?? DEFAULT_CHECKLIST_COLUMNS;
      for (const row of existing.rows) {
        if (rowHasFailAnomaly(row, cols)) continue;
        if (row.observations == null || String(row.observations).trim() === '') {
          await tx.dailyChecklistRow.update({
            where: { id: row.id },
            data: { observations: 'N/A' },
          });
        }
      }

      if (pendingBeforeSubmit.length > 0) {
        await tx.checklistTransfer.updateMany({
          where: { checklist_id: id, status: 'PENDING' },
          data: { status: 'CANCELLED', resolved_at: new Date() },
        });
      }

      return tx.dailyChecklist.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          technician_id: userId,
        },
        include: {
          rows: { orderBy: { order: 'asc' } },
          technician: { select: { name: true } },
          leader: { select: { name: true } },
        },
      });
    });

    if (pendingBeforeSubmit.length > 0) {
      await notifyChecklistUsers(
        [
          ...new Set(
            pendingBeforeSubmit
              .flatMap((t) => [t.to_user_id, t.from_user_id])
              .filter((uid) => uid !== userId)
          ),
        ],
        'Traspaso de checklist cancelado',
        'El checklist fue enviado y el traspaso pendiente se canceló.',
        id
      );
    }

    emitChecklists();
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error submitting checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reviewChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklist.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }
    if (existing.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Solo se puede aprobar un checklist ya enviado' });
    }

    const checklist = await prisma.dailyChecklist.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        leader_id: userId,
      },
    });

    emitChecklists();
    res.json(checklist);
  } catch (error) {
    console.error('Error reviewing checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getChecklistHistory = async (req: AuthRequest, res: Response) => {
  try {
    const checklists = await prisma.dailyChecklist.findMany({
      orderBy: { date: 'desc' },
      take: 30, // Get last 30 days
      include: {
        technician: { select: { name: true } },
        leader: { select: { name: true } },
        transfers: {
          where: { status: 'PENDING' },
          take: 1,
          include: pendingTransferInclude,
        },
        continuation_requests: {
          where: { status: 'PENDING' },
          take: 1,
          include: pendingContinuationInclude,
        },
      },
    });
    res.json(
      checklists.map(({ transfers, continuation_requests, ...rest }) => ({
        ...rest,
        pending_transfer: transfers[0] || null,
        pending_continuation: continuation_requests[0] || null,
      }))
    );
  } catch (error) {
    console.error('Error fetching checklist history', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getChecklistById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const checklist = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: checklistDetailInclude,
    });
    
    if (!checklist) {
      return res.status(404).json({ error: 'Checklist not found' });
    }

    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error fetching checklist by id', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Inicia traspaso de responsabilidad (solo dueño, DRAFT reclamado, destino online). */
export const transferChecklist = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const toUserId = typeof req.body?.to_user_id === 'string' ? req.body.to_user_id : '';
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : undefined;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!toUserId) {
      return res.status(400).json({ error: 'Indica el destinatario (to_user_id)' });
    }
    if (toUserId === userId) {
      return res.status(400).json({ error: 'No puedes traspasarte el checklist a ti mismo' });
    }

    const existing = await prisma.dailyChecklist.findUnique({
      where: { id },
      include: { technician: { select: { name: true } } },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }
    if (existing.status === 'NON_COMPLIANCE') {
      return res.status(400).json({ error: 'No se puede traspasar un checklist en incumplimiento' });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Solo se puede traspasar un checklist en borrador' });
    }
    if (!existing.technician_id) {
      return res.status(403).json({ error: 'Debes iniciar el checklist antes de traspasarlo.' });
    }
    if (existing.technician_id !== userId) {
      return res.status(403).json({
        error: 'Solo el técnico responsable puede traspasar este checklist.',
      });
    }

    const alreadyPending = await findPendingTransfer(id);
    if (alreadyPending) {
      return res.status(409).json({
        error: 'Ya hay un traspaso pendiente. Cancélalo o espera la respuesta.',
      });
    }

    const destination = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, name: true, role: true, is_active: true, last_active: true },
    });
    if (!destination || !destination.is_active) {
      return res.status(400).json({ error: 'El destinatario no existe o no está activo' });
    }
    if (destination.role !== 'TECNICO' && destination.role !== 'GESTIONADOR') {
      return res.status(400).json({
        error: 'Solo puedes traspasar a un TECNICO o GESTIONADOR activo',
      });
    }

    const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);
    if (!destination.last_active || destination.last_active < onlineSince) {
      return res.status(409).json({
        error: `${destination.name} no está en línea. El traspaso solo se puede enviar a usuarios conectados.`,
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const transfer = await prisma.checklistTransfer.create({
      data: {
        checklist_id: id,
        from_user_id: userId,
        to_user_id: toUserId,
        status: 'PENDING',
        ...(note ? { note } : {}),
      },
      include: pendingTransferInclude,
    });

    await notifyChecklistUsers(
      [toUserId],
      'Traspaso de checklist',
      `${actor?.name || 'Un técnico'} te ofrece la responsabilidad del checklist. Ábrelo para aceptar o rechazar.`,
      id
    );

    await writeAuditLog({
      userId,
      userName: actor?.name,
      action: 'TRANSFER_CHECKLIST',
      entity: 'checklist',
      entityId: id,
      summary: `Traspaso pendiente a ${destination.name}`,
      meta: { transfer_id: transfer.id, to_user_id: toUserId, from_user_id: userId },
    });

    emitChecklists();
    res.status(201).json(transfer);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: 'Ya hay un traspaso pendiente. Cancélalo o espera la respuesta.',
      });
    }
    console.error('Error transferring checklist', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Destinatario acepta el traspaso y pasa a ser technician_id. */
export const acceptChecklistTransfer = async (req: AuthRequest, res: Response) => {
  try {
    const transferId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const transfer = await prisma.checklistTransfer.findUnique({
      where: { id: transferId },
      include: {
        ...pendingTransferInclude,
        checklist: { select: { id: true, status: true, technician_id: true } },
      },
    });
    if (!transfer) {
      return res.status(404).json({ error: 'Traspaso no encontrado' });
    }
    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Este traspaso ya fue resuelto' });
    }
    if (transfer.to_user_id !== userId) {
      return res.status(403).json({ error: 'Solo el destinatario puede aceptar este traspaso' });
    }
    if (transfer.checklist.status !== 'DRAFT') {
      return res.status(400).json({ error: 'El checklist ya no está en borrador' });
    }
    if (transfer.checklist.technician_id !== transfer.from_user_id) {
      return res.status(409).json({
        error: 'El responsable del checklist cambió; el traspaso ya no es válido.',
      });
    }

    const acceptor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const [, checklist] = await prisma.$transaction([
      prisma.checklistTransfer.update({
        where: { id: transferId },
        data: { status: 'ACCEPTED', resolved_at: new Date() },
      }),
      prisma.dailyChecklist.update({
        where: { id: transfer.checklist_id },
        data: { technician_id: userId },
        include: checklistDetailInclude,
      }),
    ]);

    await notifyChecklistUsers(
      [transfer.from_user_id],
      'Traspaso de checklist aceptado',
      `${acceptor?.name || 'El destinatario'} aceptó la responsabilidad del checklist.`,
      transfer.checklist_id
    );

    await writeAuditLog({
      userId,
      userName: acceptor?.name,
      action: 'ACCEPT_CHECKLIST_TRANSFER',
      entity: 'checklist',
      entityId: transfer.checklist_id,
      summary: `Aceptó traspaso de ${transfer.from_user.name}`,
      meta: { transfer_id: transferId, from_user_id: transfer.from_user_id, to_user_id: userId },
    });

    emitChecklists();
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error accepting checklist transfer', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Destinatario rechaza el traspaso. */
export const rejectChecklistTransfer = async (req: AuthRequest, res: Response) => {
  try {
    const transferId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const transfer = await prisma.checklistTransfer.findUnique({
      where: { id: transferId },
      include: pendingTransferInclude,
    });
    if (!transfer) {
      return res.status(404).json({ error: 'Traspaso no encontrado' });
    }
    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Este traspaso ya fue resuelto' });
    }
    if (transfer.to_user_id !== userId) {
      return res.status(403).json({ error: 'Solo el destinatario puede rechazar este traspaso' });
    }

    const rejector = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await prisma.checklistTransfer.update({
      where: { id: transferId },
      data: { status: 'REJECTED', resolved_at: new Date() },
    });

    await notifyChecklistUsers(
      [transfer.from_user_id],
      'Traspaso de checklist rechazado',
      `${rejector?.name || 'El destinatario'} rechazó la responsabilidad del checklist.`,
      transfer.checklist_id
    );

    await writeAuditLog({
      userId,
      userName: rejector?.name,
      action: 'REJECT_CHECKLIST_TRANSFER',
      entity: 'checklist',
      entityId: transfer.checklist_id,
      summary: `Rechazó traspaso de ${transfer.from_user.name}`,
      meta: { transfer_id: transferId },
    });

    emitChecklists();
    const checklist = await prisma.dailyChecklist.findUnique({
      where: { id: transfer.checklist_id },
      include: checklistDetailInclude,
    });
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error rejecting checklist transfer', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Dueño cancela el traspaso pendiente. */
export const cancelChecklistTransfer = async (req: AuthRequest, res: Response) => {
  try {
    const transferId = req.params.id as string;
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const transfer = await prisma.checklistTransfer.findUnique({
      where: { id: transferId },
      include: pendingTransferInclude,
    });
    if (!transfer) {
      return res.status(404).json({ error: 'Traspaso no encontrado' });
    }
    if (transfer.status !== 'PENDING') {
      return res.status(400).json({ error: 'Este traspaso ya fue resuelto' });
    }
    if (transfer.from_user_id !== userId) {
      return res.status(403).json({ error: 'Solo quien inició el traspaso puede cancelarlo' });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await prisma.checklistTransfer.update({
      where: { id: transferId },
      data: { status: 'CANCELLED', resolved_at: new Date() },
    });

    await notifyChecklistUsers(
      [transfer.to_user_id],
      'Traspaso de checklist cancelado',
      `${actor?.name || 'El técnico'} canceló el traspaso del checklist.`,
      transfer.checklist_id
    );

    await writeAuditLog({
      userId,
      userName: actor?.name,
      action: 'CANCEL_CHECKLIST_TRANSFER',
      entity: 'checklist',
      entityId: transfer.checklist_id,
      summary: `Canceló traspaso a ${transfer.to_user.name}`,
      meta: { transfer_id: transferId },
    });

    emitChecklists();
    const checklist = await prisma.dailyChecklist.findUnique({
      where: { id: transfer.checklist_id },
      include: checklistDetailInclude,
    });
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error cancelling checklist transfer', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Admin asigna técnico a un checklist en incumplimiento sin responsable. Status no cambia. */
export const assignChecklistTechnician = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const technicianId =
      typeof req.body?.technician_id === 'string' ? req.body.technician_id : '';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo un administrador puede asignar el técnico' });
    }
    if (!technicianId) {
      return res.status(400).json({ error: 'Indica technician_id' });
    }

    const existing = await prisma.dailyChecklist.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }
    if (existing.status !== 'NON_COMPLIANCE') {
      return res.status(400).json({
        error: 'Solo se puede asignar técnico en un checklist en incumplimiento',
      });
    }
    if (existing.technician_id) {
      return res.status(409).json({
        error: 'Este checklist ya tiene técnico asignado',
      });
    }

    const technician = await prisma.user.findUnique({
      where: { id: technicianId },
      select: { id: true, name: true, role: true, is_active: true },
    });
    if (!technician || !technician.is_active) {
      return res.status(400).json({ error: 'El técnico no existe o no está activo' });
    }
    if (technician.role !== 'TECNICO' && technician.role !== 'GESTIONADOR') {
      return res.status(400).json({
        error: 'Solo puedes asignar a un TECNICO o GESTIONADOR activo',
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const checklist = await prisma.dailyChecklist.update({
      where: { id },
      data: { technician_id: technicianId },
      include: checklistDetailInclude,
    });

    await notifyChecklistUsers(
      [technicianId],
      'Checklist en incumplimiento asignado',
      `Se te asignó el checklist del día en incumplimiento. Puedes solicitar continuar para completarlo.`,
      id
    );

    await writeAuditLog({
      userId,
      userName: actor?.name,
      action: 'ASSIGN_CHECKLIST_TECHNICIAN',
      entity: 'checklist',
      entityId: id,
      summary: `Asignó técnico ${technician.name} a checklist en incumplimiento`,
      meta: { technician_id: technicianId },
    });

    emitChecklists();
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error assigning checklist technician', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Técnico asignado solicita continuar un checklist en incumplimiento. */
export const requestChecklistContinuation = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : undefined;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await prisma.dailyChecklist.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Checklist no encontrado' });
    }
    if (existing.status !== 'NON_COMPLIANCE') {
      return res.status(400).json({
        error: 'Solo se puede solicitar continuar un checklist en incumplimiento',
      });
    }
    if (!existing.technician_id) {
      return res.status(403).json({
        error: 'Este checklist no tiene técnico asignado. Un administrador debe asignarlo primero.',
      });
    }
    if (existing.technician_id !== userId) {
      return res.status(403).json({
        error: 'Solo el técnico asignado puede solicitar continuar este checklist',
      });
    }

    const alreadyPending = await findPendingContinuation(id);
    if (alreadyPending) {
      return res.status(409).json({
        error: 'Ya hay una solicitud de continuación pendiente',
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const request = await prisma.checklistContinuationRequest.create({
      data: {
        checklist_id: id,
        requested_by_id: userId,
        status: 'PENDING',
        ...(note ? { note } : {}),
      },
      include: pendingContinuationInclude,
    });

    const adminIds = await activeAdminIds();
    await notifyChecklistUsers(
      adminIds.filter((aid) => aid !== userId),
      'Solicitud de continuación de checklist',
      `${actor?.name || 'Un técnico'} solicita continuar un checklist en incumplimiento. Ábrelo para aprobar o rechazar.`,
      id
    );

    await writeAuditLog({
      userId,
      userName: actor?.name,
      action: 'REQUEST_CHECKLIST_CONTINUATION',
      entity: 'checklist',
      entityId: id,
      summary: 'Solicitó continuar checklist en incumplimiento',
      meta: { request_id: request.id },
    });

    emitChecklists();
    res.status(201).json(request);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({
        error: 'Ya hay una solicitud de continuación pendiente',
      });
    }
    console.error('Error requesting checklist continuation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Admin aprueba continuación → reabre como DRAFT. */
export const approveChecklistContinuation = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo un administrador puede aprobar la continuación' });
    }

    const request = await prisma.checklistContinuationRequest.findUnique({
      where: { id: requestId },
      include: {
        ...pendingContinuationInclude,
        checklist: {
          select: { id: true, status: true, technician_id: true },
        },
      },
    });
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });
    }
    if (request.checklist.status !== 'NON_COMPLIANCE') {
      return res.status(400).json({ error: 'El checklist ya no está en incumplimiento' });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const [, checklist] = await prisma.$transaction([
      prisma.checklistContinuationRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          resolved_by_id: userId,
          resolved_at: new Date(),
        },
      }),
      prisma.dailyChecklist.update({
        where: { id: request.checklist_id },
        data: {
          status: 'DRAFT',
          reopened_from_non_compliance: true,
        },
        include: checklistDetailInclude,
      }),
    ]);

    await notifyChecklistUsers(
      [request.requested_by_id],
      'Continuación de checklist aprobada',
      `${actor?.name || 'Un administrador'} aprobó continuar el checklist. Ya puedes editarlo y enviarlo.`,
      request.checklist_id
    );

    await writeAuditLog({
      userId,
      userName: actor?.name,
      action: 'APPROVE_CHECKLIST_CONTINUATION',
      entity: 'checklist',
      entityId: request.checklist_id,
      summary: `Aprobó continuación solicitada por ${request.requested_by.name}`,
      meta: { request_id: requestId },
    });

    emitChecklists();
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error approving checklist continuation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Admin rechaza continuación. */
export const rejectChecklistContinuation = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user?.role !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo un administrador puede rechazar la continuación' });
    }

    const request = await prisma.checklistContinuationRequest.findUnique({
      where: { id: requestId },
      include: pendingContinuationInclude,
    });
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await prisma.checklistContinuationRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        resolved_by_id: userId,
        resolved_at: new Date(),
      },
    });

    await notifyChecklistUsers(
      [request.requested_by_id],
      'Continuación de checklist rechazada',
      `${actor?.name || 'Un administrador'} rechazó la solicitud de continuar el checklist.`,
      request.checklist_id
    );

    await writeAuditLog({
      userId,
      userName: actor?.name,
      action: 'REJECT_CHECKLIST_CONTINUATION',
      entity: 'checklist',
      entityId: request.checklist_id,
      summary: `Rechazó continuación de ${request.requested_by.name}`,
      meta: { request_id: requestId },
    });

    emitChecklists();
    const checklist = await prisma.dailyChecklist.findUnique({
      where: { id: request.checklist_id },
      include: checklistDetailInclude,
    });
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error rejecting checklist continuation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Solicitante cancela su petición de continuación. */
export const cancelChecklistContinuation = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = req.params.id as string;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const request = await prisma.checklistContinuationRequest.findUnique({
      where: { id: requestId },
      include: pendingContinuationInclude,
    });
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });
    }
    if (request.requested_by_id !== userId) {
      return res.status(403).json({ error: 'Solo quien solicitó puede cancelar' });
    }

    const actor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await prisma.checklistContinuationRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        resolved_by_id: userId,
        resolved_at: new Date(),
      },
    });

    const adminIds = await activeAdminIds();
    await notifyChecklistUsers(
      adminIds.filter((aid) => aid !== userId),
      'Solicitud de continuación cancelada',
      `${actor?.name || 'El técnico'} canceló la solicitud de continuar el checklist.`,
      request.checklist_id
    );

    await writeAuditLog({
      userId,
      userName: actor?.name,
      action: 'CANCEL_CHECKLIST_CONTINUATION',
      entity: 'checklist',
      entityId: request.checklist_id,
      summary: 'Canceló solicitud de continuación',
      meta: { request_id: requestId },
    });

    emitChecklists();
    const checklist = await prisma.dailyChecklist.findUnique({
      where: { id: request.checklist_id },
      include: checklistDetailInclude,
    });
    res.json(await withPendingExtras(checklist));
  } catch (error) {
    console.error('Error cancelling checklist continuation', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ==========================================
// CONFIGURACIÓN DE ACTIVIDADES DEL CHECKLIST
// ==========================================

export const getChecklistConfig = async (_req: Request, res: Response) => {
  try {
    const column_count = await getConfiguredColumnCount();
    res.json({
      column_count,
      min: MIN_CHECKLIST_COLUMNS,
      max: MAX_CHECKLIST_COLUMNS,
    });
  } catch (error) {
    console.error('Error fetching checklist config', error);
    res.status(500).json({ error: 'Error al obtener la configuración del checklist' });
  }
};

export const updateChecklistConfig = async (req: Request, res: Response) => {
  try {
    if (req.body.column_count === undefined) {
      res.status(400).json({ error: 'Indica column_count' });
      return;
    }

    const column_count = normalizeChecklistColumnCount(req.body.column_count);
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { checklist_column_count: column_count },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { checklist_column_count: column_count },
      });
    }

    emitChecklists();
    res.json({
      column_count: settings.checklist_column_count,
      min: MIN_CHECKLIST_COLUMNS,
      max: MAX_CHECKLIST_COLUMNS,
    });
  } catch (error) {
    console.error('Error updating checklist config', error);
    res.status(500).json({ error: 'Error al guardar la configuración del checklist' });
  }
};

export const getActivities = async (req: Request, res: Response) => {
  try {
    const activities = await prisma.checklistActivity.findMany({
      orderBy: { order: 'asc' }
    });
    res.json(activities);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener las actividades' });
  }
};

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { name, is_active, field_type } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' });
      return;
    }

    const allowedTypes = ['CHECKBOX', 'NUMBER', 'TEXT'];
    const resolvedType = allowedTypes.includes(field_type) ? field_type : 'CHECKBOX';

    // Find highest order
    const maxOrder = await prisma.checklistActivity.findFirst({
      orderBy: { order: 'desc' }
    });
    const nextOrder = maxOrder ? maxOrder.order + 1 : 1;

    const activity = await prisma.checklistActivity.create({
      data: {
        name: name.trim(),
        order: nextOrder,
        field_type: resolvedType,
        is_active: is_active !== undefined ? is_active : true
      }
    });
    emitChecklists();
    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al crear la actividad' });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, is_active, field_type } = req.body;

    const data: { name?: string; is_active?: boolean; field_type?: string } = {};
    if (name !== undefined) data.name = name;
    if (is_active !== undefined) data.is_active = is_active;
    if (field_type !== undefined) {
      if (!['CHECKBOX', 'NUMBER', 'TEXT'].includes(field_type)) {
        res.status(400).json({ error: 'Tipo de campo inválido. Usa CHECKBOX, NUMBER o TEXT.' });
        return;
      }
      data.field_type = field_type;
    }

    const activity = await prisma.checklistActivity.update({
      where: { id },
      data
    });
    emitChecklists();
    res.json(activity);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar la actividad' });
  }
};

export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.checklistActivity.delete({
      where: { id }
    });
    emitChecklists();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al eliminar la actividad' });
  }
};

export const reorderActivities = async (req: Request, res: Response) => {
  try {
    // Expects an array of { id, order }
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'Formato inválido' });
    }

    // Actualizar en serie o usar transaccion
    await prisma.$transaction(
      orderedIds.map((item: { id: string; order: number }) =>
        prisma.checklistActivity.update({
          where: { id: item.id },
          data: { order: item.order }
        })
      )
    );

    emitChecklists();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al reordenar las actividades' });
  }
};

export const restoreDefaultActivities = async (req: Request, res: Response) => {
  try {
    const defaultActivities = [
      { name: 'Sistema de vacío (verificar presiones, ruido, sobrecalentamiento, humo)', type: 'CHECKBOX' },
      { name: 'Verificar que los equipos y periféricos estén completos', type: 'CHECKBOX' },
      { name: 'Verificar presión y caudal del sistema de agua (líneas generales y auxiliares)', type: 'CHECKBOX' },
      { name: 'Verificar los niveles de agua a las tinas de enfriamiento del cañón', type: 'CHECKBOX' },
      { name: 'Nivel de agua en bomba de anillo líquido', type: 'CHECKBOX' },
      { name: 'Inspección visual de todos los tableros eléctricos (puertas, ventiladores, lámparas)', type: 'CHECKBOX' },
      { name: 'Verificar correcto funcionamiento de las turbinas de alimentación de las máquinas', type: 'CHECKBOX' },
      { name: 'Verificar enfriamiento de minisplits en cuartos de control principales', type: 'CHECKBOX' },
      { name: 'Revisión de niveles de anticongelante a intercambiadores de calor de calandras', type: 'CHECKBOX' },
      { name: 'Revisión del correcto funcionamiento de los molinos de refil', type: 'CHECKBOX' },
      { name: 'Verificar funcionamiento del sistema de autollenado para silicón o antiestático', type: 'CHECKBOX' },
      { name: 'Inspección de presencia de fugas de aceite en todos los sistemas hidráulicos', type: 'CHECKBOX' },
      { name: 'Inspección de presencia de fugas de aire en todos los sistemas neumáticos', type: 'CHECKBOX' },
      { name: 'Verificar ruidos o sonidos anormales de baleros, rodillos, chumaceras y motores', type: 'CHECKBOX' },
      { name: 'Temperatura del estator del motor principal', type: 'NUMBER' },
      { name: 'Temperatura de la tapa frontal del motor principal', type: 'NUMBER' },
      { name: 'Temperatura de caja del balero de carga en las revolvedoras y lubricar balero inferior', type: 'NUMBER' },
      { name: 'Verificar nivel de agua en torres de enfriamiento, purgas habilitadas y tanque de salmuera', type: 'CHECKBOX' },
      { name: 'Verificación de fugas en sellos mecánicos de bombas y tuberías en general', type: 'CHECKBOX' },
      { name: 'Verificación del correcto funcionamiento de los compresores, purgar', type: 'CHECKBOX' },
      { name: 'Tomar lecturas del estado del agua de las torres de enfriamiento', type: 'TEXT' },
      { name: 'Verificación del estado y limpieza del área de residuos peligrosos', type: 'CHECKBOX' },
      { name: 'Revisar correcto funcionamiento del equipo de osmosis inversa y nivel de agua', type: 'CHECKBOX' },
      { name: 'Revisión de orden y limpieza del cuarto de productos químicos', type: 'CHECKBOX' },
      { name: 'Revisión de orden y limpieza del taller', type: 'CHECKBOX' },
      { name: 'Revisar equipos tengan sus guardas (acrílicos, tapas, rejas) instaladas', type: 'CHECKBOX' },
      { name: 'Revisión visual del cable del polipasto (que no se encuentren filamentos rotos)', type: 'CHECKBOX' },
      { name: 'Revisar las canaletas de cableado cuenten con sus tapas puestas y fijas', type: 'CHECKBOX' }
    ];

    await prisma.checklistActivity.deleteMany({});
    
    await prisma.checklistActivity.createMany({
      data: defaultActivities.map((act, index) => ({
        name: act.name,
        order: index + 1,
        field_type: act.type,
        is_active: true
      }))
    });

    const newActivities = await prisma.checklistActivity.findMany({
      orderBy: { order: 'asc' }
    });

    emitChecklists();
    res.json(newActivities);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al restaurar las actividades' });
  }
};
