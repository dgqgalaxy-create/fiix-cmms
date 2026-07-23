/**
 * Parse dates from Fiix / European CSV exports.
 * Slash dates are day/month/year (e.g. 15/07/2026 = 15 July).
 * ISO (2026-07-15[T…]) is still accepted.
 *
 * Do NOT call `new Date('05/07/2026')` first — engines treat that as US mm/dd
 * and swap day/month when day ≤ 12.
 */
export function parseCsvDate(dString: string | null | undefined): Date | null {
  if (dString == null) return null;
  const raw = String(dString).trim();
  if (!raw) return null;

  // ISO / RFC-ish: 2026-07-15 or 2026-07-15T14:30:00(.sss)(Z|±hh:mm)?
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

    // Local wall-clock (not …Z) so Mexico UTC-6 does not shift the calendar day.
    const d = new Date(year, month - 1, day, hours, mins, secs);
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return null; // e.g. 31/02/2026
    }
    return d;
  }

  return null;
}
