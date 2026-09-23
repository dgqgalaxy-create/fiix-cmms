import { Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { plantAddDays } from '../utils/plantTimezone';
import { inProgram, isOpen, plantYmd, summarizeWeek, weeklyRange, type WeeklyOrder } from './weeklyWorkOrderMetrics';

type Db = Prisma.TransactionClient;
const jsonOrders = (value: Prisma.JsonValue) => value as unknown as WeeklyOrder[];
const asJson = (value: WeeklyOrder[]) => value as unknown as Prisma.InputJsonValue;

async function readOrders(db: Db, week: string, ids: string[] = []): Promise<WeeklyOrder[]> {
  const { start, end } = weeklyRange(week);
  const orders = await db.workOrder.findMany({
    where: { OR: [
      { status: { notIn: ['FINALIZADO', 'ANULADO'] } },
      { created_at: { gte: start, lt: end } },
      { completed_at: { gte: start, lt: end } },
      { due_date: { gte: start, lt: end } },
      { due_date: null, scheduled_date: { gte: start, lt: end } },
      ...(ids.length ? [{ id: { in: ids } }] : []),
    ] },
    select: { id: true, folio: true, title: true, status: true, zone_id: true, zone: { select: { name: true } }, asset: { select: { name: true } }, created_at: true, completed_at: true, scheduled_date: true, due_date: true, hold_reason: true, maintenance_type: true, assigned_technicians: { select: { name: true } } },
    orderBy: { folio: 'asc' },
  });
  return orders.map(o => ({
    id: o.id, folio: o.folio, title: o.title, status: o.status, zone_id: o.zone_id,
    zone_name: o.zone?.name || 'Sin zona', asset_name: o.asset.name,
    created_at: o.created_at.toISOString(), completed_at: o.completed_at?.toISOString() || null,
    scheduled_date: o.scheduled_date?.toISOString() || null, due_date: o.due_date?.toISOString() || null,
    hold_reason: o.hold_reason, technicians: o.assigned_technicians.map(t => t.name).join(', '),
    maintenance_type: o.maintenance_type,
  }));
}

async function ensurePlan(db: Db, week: string, now: Date, author: string | null) {
  // Todos los procesos usan la misma exclusión por semana, también para el cron.
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`weekly-work-orders:${week}`}))`;
  const existing = await db.weeklyWorkOrderPlan.findUnique({ where: { week_start: week } });
  if (existing) return existing;
  const { start, end } = weeklyRange(week);
  if (now < start || now >= end) throw new Error('Solo se puede fijar el programa de la semana actual');
  const orders = await readOrders(db, week);
  const baseline = orders.filter(o => inProgram(o, start, end) && o.status !== 'ANULADO' && (!o.completed_at || new Date(o.completed_at) >= start));
  const carryover = orders.filter(o => isOpen(o) && new Date(o.created_at) < start);
  return db.weeklyWorkOrderPlan.create({ data: {
    week_start: week, captured_at: now, created_by: author,
    late_start: now.getTime() - start.getTime() > 120_000,
    baseline: asJson(baseline), carryover: asJson(carryover),
  } });
}

export async function freezeWeeklyPlan(week: string, author: string | null, now = new Date()) {
  const current = weeklyRange(plantYmd(now)).key;
  if (week !== current) throw new Error('Solo se puede fijar el programa de la semana actual');
  return prisma.$transaction(db => ensurePlan(db, week, now, author), { timeout: 30_000 });
}

export async function saveWeeklyCut(week: string, author: string | null, source: 'MANUAL' | 'AUTO', now = new Date()) {
  if (week !== weeklyRange(plantYmd(now)).key) throw new Error('Solo se pueden guardar cortes de la semana actual');
  return prisma.$transaction(async db => {
    const plan = await ensurePlan(db, week, now, author);
    const autoKey = source === 'AUTO' ? `${week}:${plantYmd(now)}` : null;
    if (autoKey) {
      const existing = await db.weeklyWorkOrderCut.findUnique({ where: { auto_key: autoKey } });
      if (existing) return existing;
    }
    const ids = [...jsonOrders(plan.baseline), ...jsonOrders(plan.carryover)].map(o => o.id);
    const orders = await readOrders(db, week, ids);
    return db.weeklyWorkOrderCut.create({ data: {
      week_start: week, day: plantYmd(now), captured_at: now, created_by: author,
      source, auto_key: autoKey, orders: asJson(orders),
    } });
  }, { timeout: 30_000 });
}

export async function getWeeklyReport(week: string, zoneIds: string[], cutId?: string, now = new Date()) {
  return prisma.$transaction(async db => {
    const { start, end, lastDay } = weeklyRange(week);
    const plan = await db.weeklyWorkOrderPlan.findUnique({ where: { week_start: week } });
    const cuts = await db.weeklyWorkOrderCut.findMany({ where: { week_start: week }, orderBy: { captured_at: 'asc' } });
    const isCurrent = now >= start && now < end;
    // Las semanas terminadas usan un corte real si existe; si nunca hubo seguimiento,
    // se aproxima con los estados actuales (cierres y altas por día sí son históricos).
    const selectedCut = cutId ? cuts.find(c => c.id === cutId) : !isCurrent && now >= end ? cuts.at(-1) : undefined;
    if (cutId && !selectedCut) throw new Error('Corte no encontrado para esta semana');
    const baseline = plan ? jsonOrders(plan.baseline) : [];
    const carryover = plan ? jsonOrders(plan.carryover) : [];
    const ids = [...baseline, ...carryover].map(o => o.id);
    let orders: WeeklyOrder[];
    let at: Date;
    let approximate = false;
    if (selectedCut) {
      orders = jsonOrders(selectedCut.orders);
      at = selectedCut.captured_at;
    } else if (now < end) {
      orders = await readOrders(db, week, ids);
      at = now;
    } else {
      // Semana pasada sin cortes: solo estados actuales como cierre final aproximado.
      orders = await readOrders(db, week);
      at = new Date(end.getTime() - 1);
      approximate = true;
    }
    const preview = !plan;
    const effectiveBaseline = preview ? orders.filter(o => inProgram(o, start, end) && o.status !== 'ANULADO' && (!o.completed_at || new Date(o.completed_at) >= start)) : baseline;
    const report = summarizeWeek(effectiveBaseline, carryover, orders, week, at, zoneIds);
    const hasData = true;
    const zoneSet = new Set(zoneIds);
    const inZone = (o: WeeklyOrder) => !zoneSet.size || (o.zone_id !== null && zoneSet.has(o.zone_id));
    const dayOf = (iso: string | null) => (iso ? plantYmd(new Date(iso)) : null);
    const daily = Array.from({ length: 7 }, (_, index) => {
      const day = plantYmd(plantAddDays(start.getTime(), index));
      const cut = cuts.filter(c => c.day === day && c.captured_at <= at).at(-1);
      const live = !selectedCut && isCurrent && day === plantYmd(now);
      const approxLast = approximate && day === lastDay;
      const dayOrders = live || approxLast ? orders : cut ? jsonOrders(cut.orders) : approximate ? orders : null;
      if (!dayOrders) return { day, cutId: null, capturedAt: null, closed: null, opened: null, cumulative: null, cumulativeOpened: null, pending: null, inProgress: null, paused: null, backlog: null, programCompleted: null, compliance: null };
      const measuredAt = live ? now : cut ? cut.captured_at : at;
      const metrics = live ? report : summarizeWeek(baseline, carryover, dayOrders, week, measuredAt, zoneIds);
      const closedDay = dayOrders.filter(o => inZone(o) && !o.deleted && o.status === 'FINALIZADO' && o.completed_at && dayOf(o.completed_at) === day).length;
      const openedDay = dayOrders.filter(o => inZone(o) && !o.deleted && dayOf(o.created_at) === day).length;
      const stateKnown = live || !!cut || approxLast;
      return { day, cutId: cut?.id || null, capturedAt: stateKnown ? measuredAt.toISOString() : null,
        closed: closedDay, opened: openedDay,
        cumulative: stateKnown ? metrics.counts.allCompleted : null,
        cumulativeOpened: stateKnown ? metrics.counts.opened : null,
        pending: stateKnown ? metrics.counts.pending : null,
        inProgress: stateKnown ? metrics.counts.inProgress : null,
        paused: stateKnown ? metrics.counts.paused : null,
        backlog: stateKnown ? metrics.counts.backlog : null,
        programCompleted: metrics.counts.completed, compliance: metrics.compliance };
    });
    const allZoneOrders = [...effectiveBaseline, ...carryover, ...orders];
    const zones = [...new Map(allZoneOrders.filter(o => o.zone_id).map(o => [o.zone_id!, { id: o.zone_id!, name: o.zone_name }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return {
      week, lastDay, currentWeek: weeklyRange(plantYmd(now)).key, hasData, preview, approximate,
      capturedAt: at.toISOString(), selectedCutId: selectedCut?.id || null,
      plan: plan ? { capturedAt: plan.captured_at.toISOString(), lateStart: plan.late_start } : null,
      cuts: cuts.map(c => ({ id: c.id, day: c.day, capturedAt: c.captured_at.toISOString(), source: c.source })),
      zones, daily, ...report,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30_000 });
}
