import type { WorkOrder } from '../api/workOrders';

export const REPORT_TZ = 'America/Mexico_City';
export const REPORT_STATUSES = ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA', 'FINALIZADO', 'ANULADO'] as const;
export const REPORT_TYPES = ['PREVENTIVO', 'CORRECTIVO', 'SERVICIO'] as const;
export const REPORT_LABELS = { PENDIENTE: 'Pendientes', EN_PROCESO: 'En proceso', EN_ESPERA: 'Pausadas', FINALIZADO: 'Finalizadas', ANULADO: 'Invalidadas' };
export const TYPE_LABELS = { PREVENTIVO: 'Preventivos', CORRECTIVO: 'Correctivos', SERVICIO: 'Servicios' };
export function plantDay(value: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function addDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function weekStart(day: string): string {
  return addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
}
/** Convert a civil plant midnight to an instant, including historical DST. */
export function plantMidnight(day: string): number {
  const wall = Date.parse(`${day}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const value = (key: string) => Number(parts.find(p => p.type === key)!.value);
    const rendered = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
    instant = wall - (rendered - instant);
  }
  return instant;
}
export function weekQuery(monday: string) {
  return { startDate: new Date(plantMidnight(monday)).toISOString(), endDate: new Date(plantMidnight(addDays(monday, 7)) - 1).toISOString() };
}
export function repairMs(order: WorkOrder, now: number): number | null {
  if (!order.started_at && !order.accumulated_time_ms) return null;
  return Math.max(0, Number(order.accumulated_time_ms || 0)) +
    (order.status === 'EN_PROCESO' && order.last_resumed_at ? Math.max(0, now - Date.parse(order.last_resumed_at)) : 0);
}
export function weeklyReport(orders: WorkOrder[], monday: string, today: string) {
  const totals = Object.fromEntries(REPORT_STATUSES.map(status => [status, 0])) as Record<WorkOrder['status'], number>;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const items = date > today ? [] : orders.filter(order => plantDay(order.created_at) === date);
    const counts = Object.fromEntries(REPORT_STATUSES.map(status => [status,
      Object.fromEntries(REPORT_TYPES.map(type => [type, items.filter(order => order.status === status && order.maintenance_type === type).length]))
    ])) as Record<WorkOrder['status'], Record<WorkOrder['maintenance_type'], number>>;
    for (const order of items) totals[order.status]++;
    const backlog = items.filter(order => !['FINALIZADO', 'ANULADO'].includes(order.status)).length;
    return { date, items, counts, backlog, future: date > today };
  });
  const total = Object.values(totals).reduce((sum, n) => sum + n, 0);
  return { days, totals, total, valid: total - totals.ANULADO };
}

/** Completions follow the completion date, even for requests created before this week. */
export function weeklyCompletions(orders: WorkOrder[], monday: string, today: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const items = date > today ? [] : orders.filter(order => order.status === 'FINALIZADO' && order.completed_at && plantDay(order.completed_at) === date);
    return {
      date,
      name: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][index],
      PREVENTIVO: items.filter(order => order.maintenance_type === 'PREVENTIVO').length,
      CORRECTIVO: items.filter(order => order.maintenance_type === 'CORRECTIVO').length,
      SERVICIO: items.filter(order => order.maintenance_type === 'SERVICIO').length,
    };
  });
}
