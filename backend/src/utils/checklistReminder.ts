/**
 * Utilidades de fecha/hora del checklist diario (zona horaria de planta).
 * El recordatorio por Telegram se retiró; este módulo solo expone los helpers
 * que usan el controlador de checklist y el cierre por incumplimiento.
 */

const DEFAULT_HOURS = [10, 14, 16];
export const CHECKLIST_TZ = 'America/Mexico_City';

export function parseChecklistReminderHours(raw?: string): number[] {
  const source = (raw ?? process.env.CHECKLIST_REMINDER_HOURS ?? '').trim();
  if (!source) return [...DEFAULT_HOURS];

  const hours = source
    .split(',')
    .map((part) => Number(String(part).trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23);

  const unique = [...new Set(hours)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_HOURS];
}

/** Fecha civil y hora actuales en America/Mexico_City. */
export function getMexicoCityNow(now = new Date()): { ymd: string; hour: number; asDate: Date } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHECKLIST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;

  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  // Medianoche UTC del día civil MX → coincide con @db.Date en Prisma
  const asDate = new Date(`${ymd}T00:00:00.000Z`);

  return { ymd, hour, asDate };
}
