/**
 * Hora de planta (America/Mexico_City) independiente del TZ del proceso.
 *
 * El backend local corre en horario de México y el servidor Ubuntu suele correr
 * en UTC: `new Date(y, m, d, h)` produce instantes distintos (6 h) con el mismo
 * CSV, y eso desplaza días en rachas, KPIs y fechas de OT.
 */

export const PLANT_TZ = 'America/Mexico_City';

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLANT_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function readParts(date: Date) {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === 24 ? 0 : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Desfase del huso de planta (ms) en un instante dado; negativo al oeste de UTC. */
function offsetMsAt(utcMs: number): number {
  const p = readParts(new Date(utcMs));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

/** Partes civiles (año/mes/día) de un instante en hora de planta. */
export function plantDateParts(date: Date) {
  return readParts(date);
}

/** Milisegundos de la medianoche civil de planta, para comparar días calendario. */
export function plantDayStartMs(date: Date): number {
  const p = readParts(date);
  return Date.UTC(p.year, p.month - 1, p.day);
}

/**
 * Instante UTC de una hora de pared de planta. Devuelve null si la fecha civil
 * no existe (p. ej. 31/02).
 */
export function plantWallClockToDate(
  year: number,
  month: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0
): Date | null {
  const wall = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  let utcMs = wall - offsetMsAt(wall);
  utcMs = wall - offsetMsAt(utcMs); // segunda pasada por si cae en cambio de horario

  const p = readParts(new Date(utcMs));
  if (p.year !== year || p.month !== month || p.day !== day) return null;
  return new Date(utcMs);
}

/** Día civil (0 = domingo … 6 = sábado) de un instante en hora de planta. */
export function plantUtcWeekday(utcMs: number): number {
  return new Date(plantDayStartMs(new Date(utcMs))).getUTCDay();
}

/** Instante UTC del inicio del día civil de planta (00:00) `days` después de `utcMs`. */
export function plantAddDays(utcMs: number, days: number): Date {
  const p = readParts(new Date(utcMs));
  // Aritmética sobre el calendario civil: Date.UTC normaliza el desborde de
  // mes/año (31 + 1 → día 1 del mes siguiente) y se leen las partes del
  // resultado en UTC, no en hora de planta (en planta el instante UTC de la
  // medianoche puede caer el día civil anterior).
  const target = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  const y = target.getUTCFullYear();
  const m = target.getUTCMonth() + 1;
  const d = target.getUTCDate();
  return (
    plantWallClockToDate(y, m, d) ??
    plantWallClockToDate(p.year, p.month, p.day) ??
    new Date(utcMs)
  );
}

/** Instante UTC del inicio del mes civil de planta que contiene a `utcMs`. */
export function plantStartOfMonth(utcMs: number): Date {
  const p = readParts(new Date(utcMs));
  return plantWallClockToDate(p.year, p.month, 1) ?? new Date(utcMs);
}

/** Instante UTC del inicio del mes civil de planta desplazado `months` (puede ser negativo). */
export function plantShiftMonthStart(utcMs: number, months: number): Date {
  const p = readParts(new Date(utcMs));
  const total = p.month - 1 + months;
  const year = p.year + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12 + 1;
  return plantWallClockToDate(year, month, 1) ?? plantWallClockToDate(p.year, p.month, 1) ?? new Date(utcMs);
}

/** Instante UTC del fin inclusivo del mes civil de planta (23:59:59.999 del último día). */
export function plantEndOfMonth(utcMs: number): Date {
  const next = plantShiftMonthStart(utcMs, 1);
  return new Date(next.getTime() - 1);
}
