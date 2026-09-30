export const timedTypes = new Set(['TIEMPO_EXTRA', 'TIEMPO_POR_TIEMPO']);
export const incidentTypes = new Set(['FALTA', 'VACACIONES', 'PERMISO_SG', 'PERMISO_CG', 'TIEMPO_EXTRA', 'TIEMPO_POR_TIEMPO', 'FESTIVO']);
export function timeMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}
export function intervalMinutes(start: unknown, end: unknown): number | null {
  const a = timeMinutes(start), b = timeMinutes(end);
  if (a === null || b === null || a === b) return null;
  return (b - a + 1440) % 1440;
}
export function timeRange(date: Date, start: string, end: string): [number, number] {
  const from = Date.parse(`${date.toISOString().slice(0, 10)}T00:00:00Z`) / 60000 + timeMinutes(start)!;
  return [from, from + intervalMinutes(start, end)!];
}
export function overlaps(a: [number, number], b: [number, number]) { return a[0] < b[1] && b[0] < a[1]; }
