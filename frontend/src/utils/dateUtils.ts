/**
 * Conversión y formato de fechas.
 *
 * Los formatos son configurables desde Configuración → Fecha y hora:
 * zona horaria IANA, orden de la fecha (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
 * y hora en formato 12 o 24 h. Los valores llegan del servidor al iniciar
 * sesión y se aplican a todo el sistema desde aquí.
 */

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type TimeFormat = '12' | '24';

export interface DateTimePreferences {
  time_zone: string;
  date_format: DateFormat;
  time_format: TimeFormat;
}

const DEFAULT_PREFERENCES: DateTimePreferences = {
  time_zone: 'America/Mexico_City',
  date_format: 'DD/MM/YYYY',
  time_format: '24',
};

let preferences: DateTimePreferences = { ...DEFAULT_PREFERENCES };

export function setDateTimePreferences(next: Partial<DateTimePreferences> | null | undefined): void {
  preferences = {
    time_zone: next?.time_zone || DEFAULT_PREFERENCES.time_zone,
    date_format: next?.date_format || DEFAULT_PREFERENCES.date_format,
    time_format: next?.time_format === '12' ? '12' : '24',
  };
}

export function getDateTimePreferences(): DateTimePreferences {
  return preferences;
}

function withTimeZone(): string {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: preferences.time_zone });
    return preferences.time_zone;
  } catch {
    return DEFAULT_PREFERENCES.time_zone;
  }
}

function zonedParts(date: Date): { y: string; m: string; d: string } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: withTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return { y: parts.year ?? '0000', m: parts.month ?? '00', d: parts.day ?? '00' };
}

function localParts(date: Date): { y: string; m: string; d: string } {
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return { y, m, d };
}

function applyDateFormat(parts: { y: string; m: string; d: string }): string {
  if (preferences.date_format === 'MM/DD/YYYY') return `${parts.m}/${parts.d}/${parts.y}`;
  if (preferences.date_format === 'YYYY-MM-DD') return `${parts.y}-${parts.m}-${parts.d}`;
  return `${parts.d}/${parts.m}/${parts.y}`;
}

/** Hora según la preferencia (12 h con a. m./p. m. o 24 h). */
export function formatTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  const formatter = new Intl.DateTimeFormat('es-MX', {
    timeZone: withTimeZone(),
    hour: '2-digit',
    minute: '2-digit',
    hour12: preferences.time_format === '12',
  });
  return formatter.format(date);
}

/**
 * Convierte una fecha "solo-fecha" (sin hora), como las que devuelve Prisma
 * para columnas `@db.Date` (ej. "2026-07-16T00:00:00.000Z"), en un objeto Date
 * LOCAL que representa el mismo día calendario.
 *
 * Sin esto, `new Date(dateOnlyString)` se interpreta como medianoche UTC, y al
 * formatear con la hora local del navegador (ej. México, UTC-6) el resultado
 * se recorre un día hacia atrás.
 */
export function parseDateOnly(dateOnlyString: string | Date): Date {
  const utcDate = typeof dateOnlyString === 'string'
    ? new Date(dateOnlyString)
    : dateOnlyString;
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

/** Fecha y hora completas (movimientos, registros, bitácora). */
export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return `${applyDateFormat(zonedParts(date))} ${formatTime(date)}`;
}

/** Solo fecha (created_at, etc.) respetando el formato configurado. */
export function formatDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return applyDateFormat(zonedParts(date));
}

/**
 * Fecha de calendario (expected_date, next_due, @db.Date) sin correr el día
 * cuando viene como medianoche UTC.
 */
export function formatDateOnly(iso: string | Date): string {
  return applyDateFormat(localParts(parseDateOnly(iso)));
}
