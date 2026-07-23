/**
 * Parse HTML `<input type="date">` values (`yyyy-MM-dd`) and ISO datetimes.
 *
 * Do NOT use `new Date('2026-07-15')` for date-only strings: engines treat that
 * as UTC midnight, so Mexico (UTC-6) shows the previous calendar day.
 * We store local noon so DST / timezone shifts keep the same day.
 */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?=$|[T\s])/);
  if (m && !/[T\s]\d/.test(raw)) {
    // Pure date-only (no time component)
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day, 12, 0, 0);
    if (
      d.getFullYear() !== year ||
      d.getMonth() !== month - 1 ||
      d.getDate() !== day
    ) {
      return null;
    }
    return d;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
