/**
 * Convierte una fecha "solo-fecha" (sin hora), como las que devuelve Prisma
 * para columnas `@db.Date` (ej. "2026-07-16T00:00:00.000Z"), en un objeto Date
 * LOCAL que representa el mismo día calendario.
 *
 * Sin esto, `new Date(dateOnlyString)` se interpreta como medianoche UTC, y al
 * formatear con la hora local del navegador (ej. México, UTC-6) el resultado
 * se recorre un día hacia atrás.
 */
export function parseDateOnly(dateOnlyString: string): Date {
  const utcDate = new Date(dateOnlyString);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}
