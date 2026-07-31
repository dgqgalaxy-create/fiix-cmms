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

/** Fecha/hora de movimientos y registros (locale México, zona de planta). */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
}

/** Solo fecha (created_at, etc.) en formato México dd/mm/aaaa. */
export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('es-MX');
}

/**
 * Fecha de calendario (expected_date, next_due, @db.Date) sin correr el día
 * cuando viene como medianoche UTC.
 */
export function formatDateOnly(iso: string | Date): string {
  return parseDateOnly(iso).toLocaleDateString('es-MX');
}
