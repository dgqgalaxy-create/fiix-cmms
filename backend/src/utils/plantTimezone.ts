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
