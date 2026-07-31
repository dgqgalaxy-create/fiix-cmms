/**
 * Parse dates from Fiix / European CSV exports.
 * Slash dates are day/month/year (e.g. 15/07/2026 = 15 July).
 * ISO (2026-07-15[T…]) is still accepted.
 *
 * Do NOT call `new Date('05/07/2026')` first — engines treat that as US mm/dd
 * and swap day/month when day ≤ 12.
 *
 * Las horas sin zona son hora de planta (America/Mexico_City), no del proceso:
 * el mismo CSV importado en Windows local y en el servidor Ubuntu (UTC) debe
 * guardar el mismo instante.
 */
import { plantWallClockToDate } from './plantTimezone';

export function parseCsvDate(dString: string | null | undefined): Date | null {
  if (dString == null) return null;
  const raw = String(dString).trim();
  if (!raw) return null;

  // ISO / RFC-ish: 2026-07-15 o 2026-07-15T14:30:00(.sss)(Z|±hh:mm)?
  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/
  );
  if (iso) {
    // Con zona explícita el instante ya es absoluto.
    if (iso[7]) {
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }
    const hasTime = iso[4] != null;
    return plantWallClockToDate(
      Number(iso[1]),
      Number(iso[2]),
      Number(iso[3]),
      hasTime ? Number(iso[4]) : 12, // sin hora: mediodía de planta, nunca cambia de día
      hasTime ? Number(iso[5]) : 0,
      iso[6] != null ? Number(iso[6]) : 0
    );
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  // dd/mm/yyyy or d/m/yyyy, optional time (space or T separator)
  const m = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const hours = m[4] != null ? parseInt(m[4], 10) : 0;
    const mins = m[5] != null ? parseInt(m[5], 10) : 0;
    const secs = m[6] != null ? parseInt(m[6], 10) : 0;

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    return plantWallClockToDate(year, month, day, hours, mins, secs);
  }

  return null;
}
