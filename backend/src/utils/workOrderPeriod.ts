import { plantWallClockToDate } from './plantTimezone';
function boundary(raw: unknown, end: boolean): Date {
  const value = String(raw);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? plantWallClockToDate(+match[1], +match[2], +match[3], end ? 23 : 0, end ? 59 : 0, end ? 59 : 0) : new Date(value);
  if (!date || !Number.isFinite(date.getTime())) throw new Error('Periodo inválido');
  if (end && match) date.setMilliseconds(999);
  return date;
}
/** Mismos límites inclusivos de fecha de creación para resumen y lista, en hora de planta. */
export function workOrderPeriod(start: unknown, end: unknown) {
  return start || end ? { created_at: {
    ...(start ? { gte: boundary(start, false) } : {}),
    ...(end ? { lte: boundary(end, true) } : {}),
  } } : {};
}
