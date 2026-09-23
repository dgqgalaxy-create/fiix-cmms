import { plantAddDays, plantDateParts, plantUtcWeekday, plantWallClockToDate } from '../utils/plantTimezone';

export type WeeklyOrder = {
  id: string; folio: number; title: string; status: string;
  zone_id: string | null; zone_name: string; asset_name: string;
  created_at: string; completed_at: string | null;
  scheduled_date: string | null; due_date: string | null;
  hold_reason: string | null; technicians: string; deleted?: boolean;
  maintenance_type?: string;
};
export const plantYmd = (date: Date) => {
  const p = plantDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};
export function weeklyRange(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha de semana inválida');
  const [y, m, d] = value.split('-').map(Number);
  const date = plantWallClockToDate(y!, m!, d!);
  if (!date) throw new Error('Fecha de semana inválida');
  const weekday = plantUtcWeekday(date.getTime());
  const start = plantAddDays(date.getTime(), -(weekday === 0 ? 6 : weekday - 1));
  const end = plantAddDays(start.getTime(), 7);
  return { key: plantYmd(start), start, end, lastDay: plantYmd(plantAddDays(start.getTime(), 6)) };
}
export const isOpen = (o: WeeklyOrder) => !o.deleted && !['FINALIZADO', 'ANULADO'].includes(o.status);
export function inProgram(o: WeeklyOrder, start: Date, end: Date) {
  const date = o.due_date || o.scheduled_date;
  return !!date && new Date(date) >= start && new Date(date) < end;
}
export function summarizeWeek(baseline: WeeklyOrder[], carryover: WeeklyOrder[], orders: WeeklyOrder[], week: string, at: Date, zoneIds: string[] = []) {
  const { start, end } = weeklyRange(week);
  const cutoff = Math.min(at.getTime(), end.getTime() - 1);
  const selected = (o: WeeklyOrder) => !zoneIds.length || (o.zone_id !== null && zoneIds.includes(o.zone_id));
  const byId = new Map(orders.map(o => [o.id, o]));
  const initialIds = new Set(baseline.map(o => o.id));
  const initial = baseline.filter(selected);
  const initialById = new Map(initial.map(o => [o.id, o]));
  // La zona del compromiso inicial fija el denominador incluso si la OT cambia de zona.
  const program = initial.map(o => ({ ...(byId.get(o.id) || { ...o, deleted: true }), program_zone_name: o.zone_name, original_due_date: o.due_date, original_scheduled_date: o.scheduled_date }));
  const visible = orders.filter(selected);
  const closed = (o: WeeklyOrder) => !o.deleted && o.status === 'FINALIZADO' && !!o.completed_at && new Date(o.completed_at).getTime() >= start.getTime() && new Date(o.completed_at).getTime() <= cutoff;
  const completed = program.filter(closed);
  const pending = program.filter(o => !o.deleted && o.status === 'PENDIENTE');
  const inProgress = program.filter(o => !o.deleted && o.status === 'EN_PROCESO');
  const paused = program.filter(o => !o.deleted && o.status === 'EN_ESPERA');
  const cancelled = program.filter(o => !o.deleted && o.status === 'ANULADO');
  const deleted = program.filter(o => o.deleted);
  const overdue = program.filter(o => {
    const promised = initialById.get(o.id)?.due_date;
    return isOpen(o) && !!promised && new Date(promised).getTime() < cutoff;
  });
  const additions = visible.filter(o => !initialIds.has(o.id) && inProgram(o, start, end) && o.status !== 'ANULADO' && (!o.completed_at || new Date(o.completed_at) >= start));
  const rescheduled = initial.filter(o => {
    const current = byId.get(o.id);
    return current && (o.due_date !== current.due_date || o.scheduled_date !== current.scheduled_date || o.zone_id !== current.zone_id);
  }).map(o => ({ ...byId.get(o.id)!, original_due_date: o.due_date, original_scheduled_date: o.scheduled_date, original_zone_name: o.zone_name }));
  const incoming = visible.filter(o => !initialIds.has(o.id) && new Date(o.created_at) >= start && new Date(o.created_at).getTime() <= cutoff);
  const inherited = carryover.filter(selected).map(o => byId.get(o.id) || { ...o, deleted: true });
  const backlog = visible.filter(isOpen);
  const allCompleted = visible.filter(closed);
  // Actividad real de la semana (independiente del programa/calendario):
  const opened = visible.filter(o => !o.deleted && new Date(o.created_at) >= start && new Date(o.created_at).getTime() <= cutoff);
  const preventiveCompleted = allCompleted.filter(o => o.maintenance_type?.toUpperCase() === 'PREVENTIVO');
  const correctiveCompleted = allCompleted.filter(o => o.maintenance_type?.toUpperCase() === 'CORRECTIVO');
  const serviceCompleted = allCompleted.filter(o => !o.maintenance_type || !['PREVENTIVO', 'CORRECTIVO'].includes(o.maintenance_type.toUpperCase()));
  const details = { program, completed, pending, inProgress, paused, cancelled, deleted, overdue, additions, rescheduled, incoming, carryover: inherited, backlog, backlogOverdue: backlog.filter(o => !!o.due_date && new Date(o.due_date).getTime() < cutoff), allCompleted, opened, preventiveCompleted, correctiveCompleted, serviceCompleted };
  const counts = Object.fromEntries(Object.entries(details).map(([key, list]) => [key, list.length])) as Record<keyof typeof details, number>;
  return { counts, compliance: program.length ? Math.round(completed.length / program.length * 1000) / 10 : null, details };
}
