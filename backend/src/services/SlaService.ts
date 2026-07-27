import { Priority, SlaEventType, WorkOrderStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { getIO } from '../utils/socket';
import { sendTelegramAlert } from './TelegramService';
import { sendWebPushToUsers } from '../utils/webPush';
import { formatWorkOrderFolio } from '../utils/folio';

export type SlaPriorityPolicy = {
  response_max_h: number;
  response_reminder_h: number;
  response_escalate_h: number;
  hold_max_h: number;
  hold_escalate_h: number;
  resolution_max_h: number;
  resolution_reminder_h: number;
  resolution_escalate_h: number;
};

export type SlaPolicy = Record<'URGENTE' | 'NORMAL' | 'BAJO', SlaPriorityPolicy>;

export type SlaLevel = 'OK' | 'RISK' | 'BREACHED' | 'N/A';

/** Si en un ciclo hay más de este número de avisos nuevos, se envía un resumen único. */
export const SLA_DIGEST_THRESHOLD = 5;

export const DEFAULT_SLA_POLICY: SlaPolicy = {
  URGENTE: {
    response_max_h: 1,
    response_reminder_h: 0.5,
    response_escalate_h: 2,
    hold_max_h: 2,
    hold_escalate_h: 2,
    resolution_max_h: 8,
    resolution_reminder_h: 4,
    resolution_escalate_h: 8,
  },
  NORMAL: {
    response_max_h: 8,
    response_reminder_h: 4,
    response_escalate_h: 24,
    hold_max_h: 8,
    hold_escalate_h: 8,
    resolution_max_h: 72,
    resolution_reminder_h: 36,
    resolution_escalate_h: 72,
  },
  BAJO: {
    response_max_h: 24,
    response_reminder_h: 12,
    response_escalate_h: 72,
    hold_max_h: 24,
    hold_escalate_h: 24,
    resolution_max_h: 168,
    resolution_reminder_h: 72,
    resolution_escalate_h: 168,
  },
};

const OPEN_STATUSES: WorkOrderStatus[] = ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'];

const hoursBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / (1000 * 60 * 60);

export const mergeSlaPolicy = (raw: unknown): SlaPolicy => {
  const base = structuredClone(DEFAULT_SLA_POLICY);
  if (!raw || typeof raw !== 'object') return base;

  for (const key of ['URGENTE', 'NORMAL', 'BAJO'] as const) {
    const incoming = (raw as any)[key];
    if (!incoming || typeof incoming !== 'object') continue;
    for (const field of Object.keys(base[key]) as (keyof SlaPriorityPolicy)[]) {
      const value = Number(incoming[field]);
      if (!Number.isNaN(value) && value >= 0) {
        base[key][field] = value;
      }
    }
  }
  return base;
};

export const getSlaSettings = async () => {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        telegram_enabled: true,
        email_enabled: false,
        sla_enabled: true,
        sla_policy: DEFAULT_SLA_POLICY,
      },
    });
  }
  return {
    sla_enabled: settings.sla_enabled,
    sla_policy: mergeSlaPolicy(settings.sla_policy),
  };
};

const worstLevel = (levels: SlaLevel[]): SlaLevel => {
  if (levels.includes('BREACHED')) return 'BREACHED';
  if (levels.includes('RISK')) return 'RISK';
  if (levels.includes('OK')) return 'OK';
  return 'N/A';
};

const levelForClock = (
  elapsedH: number,
  reminderH: number,
  maxH: number
): SlaLevel => {
  if (elapsedH >= maxH) return 'BREACHED';
  if (elapsedH >= reminderH) return 'RISK';
  return 'OK';
};

export type WorkOrderSlaSnapshot = {
  overall: SlaLevel;
  response: SlaLevel;
  hold: SlaLevel;
  resolution: SlaLevel;
  elapsed: {
    response_h: number | null;
    hold_h: number | null;
    resolution_h: number | null;
  };
};

export const computeWorkOrderSla = (
  wo: {
    status: WorkOrderStatus;
    priority: Priority;
    created_at: Date;
    paused_at: Date | null;
    completed_at?: Date | null;
  },
  policy: SlaPolicy,
  now: Date = new Date()
): WorkOrderSlaSnapshot => {
  if (wo.status === 'FINALIZADO' || wo.status === 'ANULADO') {
    return {
      overall: 'N/A',
      response: 'N/A',
      hold: 'N/A',
      resolution: 'N/A',
      elapsed: { response_h: null, hold_h: null, resolution_h: null },
    };
  }

  const p = policy[wo.priority];
  const resolutionEnd = wo.completed_at || now;
  const resolutionH = hoursBetween(wo.created_at, resolutionEnd);

  let response: SlaLevel = 'N/A';
  let responseH: number | null = null;
  if (wo.status === 'PENDIENTE') {
    responseH = hoursBetween(wo.created_at, now);
    response = levelForClock(responseH, p.response_reminder_h, p.response_max_h);
  }

  let hold: SlaLevel = 'N/A';
  let holdH: number | null = null;
  if (wo.status === 'EN_ESPERA' && wo.paused_at) {
    holdH = hoursBetween(wo.paused_at, now);
    hold = levelForClock(holdH, p.hold_max_h * 0.5, p.hold_max_h);
  }

  const resolution = levelForClock(
    resolutionH,
    p.resolution_reminder_h,
    p.resolution_max_h
  );

  return {
    overall: worstLevel([response, hold, resolution]),
    response,
    hold,
    resolution,
    elapsed: {
      response_h: responseH,
      hold_h: holdH,
      resolution_h: resolutionH,
    },
  };
};

const folioLabel = (folio: number) => formatWorkOrderFolio(folio);

const formatHours = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
};

type PendingSlaAction = {
  workOrderId: string;
  folio: number;
  eventType: SlaEventType;
  title: string;
  message: string;
  telegramHtml: string;
  recipientIds: string[];
  isEscalation: boolean;
};

async function notifyInApp(
  userIds: string[],
  title: string,
  message: string,
  workOrderId?: string
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;

  const link = workOrderId ? `/dashboard?wo=${workOrderId}` : '/dashboard';

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
    // socket may not be ready in CLI tests
  }

  await sendWebPushToUsers(unique, { title, body: message, url: link });
}

async function recordEvent(workOrderId: string, eventType: SlaEventType): Promise<boolean> {
  try {
    await prisma.workOrderSlaEvent.create({
      data: { work_order_id: workOrderId, event_type: eventType },
    });
    return true;
  } catch {
    return false;
  }
}

async function managersAndAdmins(): Promise<{ id: string }[]> {
  return prisma.user.findMany({
    where: {
      is_active: true,
      role: { in: ['ADMINISTRADOR', 'GESTIONADOR'] },
    },
    select: { id: true },
  });
}

function collectPendingActions(
  wo: {
    id: string;
    folio: number;
    title: string;
    status: WorkOrderStatus;
    priority: Priority;
    created_at: Date;
    paused_at: Date | null;
    hold_reason: string | null;
    asset: { name: string } | null;
    zone: { name: string } | null;
    assigned_technicians: { id: string; name: string }[];
    sla_events: { event_type: SlaEventType }[];
  },
  policy: SlaPolicy,
  managerIds: string[],
  now: Date
): PendingSlaAction[] {
  const actions: PendingSlaAction[] = [];
  const p = policy[wo.priority];
  const existing = new Set(wo.sla_events.map((e) => e.event_type));
  const baseInfo = `${folioLabel(wo.folio)} — ${wo.title}\nPrioridad: ${wo.priority}\nEquipo: ${wo.asset?.name || 'N/A'}\nZona: ${wo.zone?.name || 'N/A'}\nEstado: ${wo.status}`;
  const techIds = wo.assigned_technicians.map((t) => t.id);
  const reminderRecipients = techIds.length > 0 ? techIds : managerIds;

  const push = (
    eventType: SlaEventType,
    title: string,
    msg: string,
    recipients: string[],
    isEscalation: boolean
  ) => {
    if (existing.has(eventType)) return;
    actions.push({
      workOrderId: wo.id,
      folio: wo.folio,
      eventType,
      title,
      message: msg,
      telegramHtml: `${isEscalation ? '🚨' : '⏰'} <b>${title}</b>\n\n${baseInfo}\n\n${msg}`,
      recipientIds: recipients,
      isEscalation,
    });
  };

  if (wo.status === 'PENDIENTE') {
    const elapsed = hoursBetween(wo.created_at, now);
    if (elapsed >= p.response_reminder_h) {
      push(
        'REMINDER_RESPONSE',
        `Recordatorio SLA respuesta: ${folioLabel(wo.folio)}`,
        `Lleva ${formatHours(elapsed)} en PENDIENTE (umbral ${formatHours(p.response_reminder_h)}).`,
        reminderRecipients,
        false
      );
    }
    if (elapsed >= p.response_escalate_h) {
      push(
        'ESCALATE_RESPONSE',
        `ESCALAMIENTO SLA respuesta: ${folioLabel(wo.folio)}`,
        `Sin aceptar tras ${formatHours(elapsed)} (límite ${formatHours(p.response_escalate_h)}).`,
        managerIds,
        true
      );
    }
  }

  if (wo.status === 'EN_ESPERA' && wo.paused_at) {
    const elapsed = hoursBetween(wo.paused_at, now);
    if (elapsed >= p.hold_max_h * 0.5) {
      push(
        'REMINDER_HOLD',
        `Recordatorio OT detenida: ${folioLabel(wo.folio)}`,
        `En espera desde hace ${formatHours(elapsed)} (máx. ${formatHours(p.hold_max_h)}). Motivo: ${wo.hold_reason || 'N/A'}`,
        reminderRecipients,
        false
      );
    }
    if (elapsed >= p.hold_escalate_h) {
      push(
        'ESCALATE_HOLD',
        `ESCALAMIENTO OT detenida: ${folioLabel(wo.folio)}`,
        `Detenida ${formatHours(elapsed)} (límite ${formatHours(p.hold_escalate_h)}). Motivo: ${wo.hold_reason || 'N/A'}`,
        managerIds,
        true
      );
    }
  }

  {
    const elapsed = hoursBetween(wo.created_at, now);
    if (elapsed >= p.resolution_reminder_h) {
      push(
        'REMINDER_RESOLUTION',
        `Recordatorio SLA resolución: ${folioLabel(wo.folio)}`,
        `Abierta ${formatHours(elapsed)} (umbral ${formatHours(p.resolution_reminder_h)} / máx. ${formatHours(p.resolution_max_h)}).`,
        techIds.length > 0 ? [...techIds, ...managerIds] : managerIds,
        false
      );
    }
    if (elapsed >= p.resolution_escalate_h) {
      push(
        'ESCALATE_RESOLUTION',
        `ESCALAMIENTO SLA resolución: ${folioLabel(wo.folio)}`,
        `Sin cerrar tras ${formatHours(elapsed)} (límite ${formatHours(p.resolution_escalate_h)}).`,
        managerIds,
        true
      );
    }
  }

  return actions;
}

export type EvaluateSlaOptions = {
  /**
   * silent: registra eventos del rezago sin Telegram ni in-app (arranque / baseline).
   * notify: envía avisos; si hay muchos, un solo resumen.
   */
  mode?: 'silent' | 'notify';
};

export async function evaluateOpenWorkOrders(
  options: EvaluateSlaOptions = {}
): Promise<{ checked: number; emitted: number; notified: number; mode: string }> {
  const mode = options.mode ?? 'notify';
  const { sla_enabled, sla_policy } = await getSlaSettings();
  if (!sla_enabled) {
    return { checked: 0, emitted: 0, notified: 0, mode };
  }

  const now = new Date();
  const openOrders = await prisma.workOrder.findMany({
    where: { status: { in: OPEN_STATUSES } },
    include: {
      asset: { select: { name: true } },
      zone: { select: { name: true } },
      assigned_technicians: { select: { id: true, name: true } },
      sla_events: { select: { event_type: true } },
    },
  });

  const managers = await managersAndAdmins();
  const managerIds = managers.map((u) => u.id);

  const pending: PendingSlaAction[] = [];
  for (const wo of openOrders) {
    pending.push(...collectPendingActions(wo, sla_policy, managerIds, now));
  }

  let emitted = 0;
  let notified = 0;
  const recorded: PendingSlaAction[] = [];

  for (const action of pending) {
    const created = await recordEvent(action.workOrderId, action.eventType);
    if (created) {
      emitted += 1;
      recorded.push(action);
    }
  }

  if (mode === 'silent' || recorded.length === 0) {
    return { checked: openOrders.length, emitted, notified: 0, mode };
  }

  // Pocos avisos: mensaje individual. Muchos: un solo digest (anti-saturación).
  if (recorded.length <= SLA_DIGEST_THRESHOLD) {
    for (const action of recorded) {
      await sendTelegramAlert(action.telegramHtml);
      await notifyInApp(action.recipientIds, action.title, action.message, action.workOrderId);
      notified += 1;
    }
  } else {
    const escalations = recorded.filter((a) => a.isEscalation);
    const reminders = recorded.filter((a) => !a.isEscalation);
    const sampleFolios = [...new Set(recorded.map((a) => folioLabel(a.folio)))]
      .slice(0, 12)
      .join(', ');
    const more =
      new Set(recorded.map((a) => a.folio)).size > 12
        ? ` … (+${new Set(recorded.map((a) => a.folio)).size - 12} más)`
        : '';

    const digestTitle = `Resumen SLA: ${recorded.length} avisos en este ciclo`;
    const digestMsg =
      `${reminders.length} recordatorio(s), ${escalations.length} escalamiento(s).\n` +
      `Órdenes: ${sampleFolios}${more}\n` +
      `Revisa el listado de OT (badges En riesgo / Vencido). Los avisos individuales se omitieron para no saturar el canal.`;

    await sendTelegramAlert(`📋 <b>${digestTitle}</b>\n\n${digestMsg}`);
    await notifyInApp(managerIds, digestTitle, digestMsg);
    notified = 1;
  }

  return { checked: openOrders.length, emitted, notified, mode };
}

/** Marca el rezago actual como ya notificado, sin enviar mensajes. */
export async function silentBackfillSlaEvents() {
  return evaluateOpenWorkOrders({ mode: 'silent' });
}
