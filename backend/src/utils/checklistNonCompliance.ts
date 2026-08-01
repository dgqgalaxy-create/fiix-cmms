import prisma from '../config/prisma';
import { writeAuditLog } from './auditLog';
import { CHECKLIST_TZ, getMexicoCityNow } from './checklistReminder';
import { emitRefresh } from './socket';

const DEFAULT_CHECKLIST_COLUMNS = 5;

function mexicoDateOffset(ymd: string, dayDelta: number): { ymd: string; asDate: Date } {
  const base = new Date(`${ymd}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dayDelta);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  const next = `${y}-${m}-${d}`;
  return { ymd: next, asDate: new Date(`${next}T00:00:00.000Z`) };
}

async function getConfiguredColumnCount(): Promise<number> {
  const settings = await prisma.systemSettings.findFirst();
  const n = Number(settings?.checklist_column_count ?? DEFAULT_CHECKLIST_COLUMNS);
  if (!Number.isFinite(n)) return DEFAULT_CHECKLIST_COLUMNS;
  return Math.min(12, Math.max(1, Math.round(n)));
}

/**
 * Marca checklists DRAFT de días anteriores (México) como NON_COMPLIANCE,
 * cancela traspasos pendientes y crea el checklist de ayer si faltaba.
 * Idempotente; pensado para cron 00:05 MX y catch-up al arranque.
 */
export async function runChecklistNonComplianceClose(now = new Date()): Promise<{
  closed: number;
  createdMissing: boolean;
}> {
  const { ymd, asDate: today } = getMexicoCityNow(now);
  const yesterday = mexicoDateOffset(ymd, -1);
  const closedAt = now;
  let closed = 0;
  let createdMissing = false;

  const staleDrafts = await prisma.dailyChecklist.findMany({
    where: {
      status: 'DRAFT',
      date: { lt: today },
    },
    select: { id: true, date: true },
  });

  if (staleDrafts.length > 0) {
    const ids = staleDrafts.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
      await tx.checklistTransfer.updateMany({
        where: { checklist_id: { in: ids }, status: 'PENDING' },
        data: { status: 'CANCELLED', resolved_at: closedAt },
      });

      const result = await tx.dailyChecklist.updateMany({
        where: { id: { in: ids }, status: 'DRAFT' },
        data: {
          status: 'NON_COMPLIANCE',
          non_compliance_at: closedAt,
        },
      });
      closed = result.count;
    });

    for (const c of staleDrafts) {
      await writeAuditLog({
        userId: null,
        userName: 'sistema',
        action: 'CHECKLIST_NON_COMPLIANCE',
        entity: 'checklist',
        entityId: c.id,
        summary: `Checklist marcado en incumplimiento (día no enviado)`,
        meta: { date: c.date, timezone: CHECKLIST_TZ },
      });
    }
  }

  const yesterdayExists = await prisma.dailyChecklist.findFirst({
    where: { date: yesterday.asDate },
    select: { id: true },
  });

  if (!yesterdayExists) {
    const activities = await prisma.checklistActivity.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });
    const columnCount = await getConfiguredColumnCount();

    const created = await prisma.dailyChecklist.create({
      data: {
        date: yesterday.asDate,
        status: 'NON_COMPLIANCE',
        column_count: columnCount,
        non_compliance_at: closedAt,
        rows: {
          create: activities.map((act) => ({
            activity_name: act.name,
            order: act.order,
            field_type: act.field_type,
            line_statuses: {},
          })),
        },
      },
      select: { id: true },
    });
    createdMissing = true;
    closed += 1;

    await writeAuditLog({
      userId: null,
      userName: 'sistema',
      action: 'CHECKLIST_NON_COMPLIANCE_CREATED',
      entity: 'checklist',
      entityId: created.id,
      summary: `Checklist de ayer creado en incumplimiento (no existía)`,
      meta: { date: yesterday.ymd, timezone: CHECKLIST_TZ },
    });
  }

  if (closed > 0 || createdMissing) {
    try {
      emitRefresh('refresh_checklists');
    } catch {
      // socket may not be ready
    }
  }

  return { closed, createdMissing };
}
