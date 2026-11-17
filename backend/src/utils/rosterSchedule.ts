/**
 * Resolución del horario (roster) para el tablero de desempeño.
 *
 * El módulo Horarios guarda **patrones** por persona (MIXTO, 4X4_FIJO, 4X4_ROTATORIO),
 * excepciones (vacaciones, falta, permiso, tiempo extra…) y turnos explícitos
 * importados del calendario Excel. La prioridad es la misma que usa la pantalla de
 * Horarios: turno explícito → excepción → patrón.
 *
 * Aquí se traduce ese horario a horas programadas y fin de turno por día, para que
 * la utilización se calcule aunque no exista una fila por día en `TechnicianShift`.
 */

export type RosterDayKind = 'work' | 'rest' | 'absence' | 'unknown';

export interface RosterDay {
  code: string | null;
  kind: RosterDayKind;
  hours: number;
  endTime: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toDayKey = (date: Date): string => date.toISOString().slice(0, 10);

const parseDay = (day: string): number => Date.parse(`${day}T12:00:00Z`);

const WORK_CODES = new Set(['D', 'N', 'M', 'D_TE', 'N_TE', 'TE', 'TXT', 'CURSO']);
const ABSENCE_CODES = new Set(['V', 'I', 'F', 'PSG', 'X']);

const EXCEPTION_CODES: Record<string, string> = {
  FALTA: 'F',
  VACACIONES: 'V',
  PERMISO_SG: 'PSG',
  PERMISO_CG: 'PSG',
  TIEMPO_EXTRA: 'TE',
  TIEMPO_POR_TIEMPO: 'TXT',
  FESTIVO: 'X',
};

export interface RosterSnapshot {
  patterns: Array<{ user_id: string; pattern_type: string; start_date: Date; end_date: Date | null }>;
  exceptions: Array<{ user_id: string; date: Date; exception_type: string }>;
  shifts: Array<{ user_id: string; date: Date; shift_code: string }>;
}

export async function loadRosterSnapshot(
  prismaClient: {
    technicianPattern: { findMany: (args: unknown) => Promise<any[]> };
    technicianException: { findMany: (args: unknown) => Promise<any[]> };
    technicianShift: { findMany: (args: unknown) => Promise<any[]> };
  },
  from: Date,
  to: Date
): Promise<RosterSnapshot> {
  const [patterns, exceptions, shifts] = await Promise.all([
    prismaClient.technicianPattern.findMany({}),
    prismaClient.technicianException.findMany({
      where: { date: { gte: from, lte: to } },
    }),
    prismaClient.technicianShift.findMany({
      where: { date: { gte: from, lte: to } },
    }),
  ]);
  return { patterns, exceptions, shifts };
}

/** Patrón vigente para un día: el más reciente que ya inició y no ha terminado. */
export function patternForDate(
  snapshot: RosterSnapshot,
  userId: string,
  day: string
): RosterSnapshot['patterns'][number] | null {
  const target = parseDay(day);
  const candidates = snapshot.patterns.filter((pattern) => {
    if (pattern.user_id !== userId) return false;
    const start = pattern.start_date.getTime();
    const end = pattern.end_date ? pattern.end_date.getTime() : null;
    return start <= target && (end === null || end >= target);
  });
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, item) =>
    item.start_date.getTime() > latest.start_date.getTime() ? item : latest
  );
}

/** Tipo de patrón dominante del técnico (para agrupar el tablero). */
export function dominantPatternType(
  snapshot: RosterSnapshot,
  userId: string,
  from: Date,
  to: Date
): string | null {
  const counts = new Map<string, number>();
  for (let time = from.getTime(); time <= to.getTime(); time += DAY_MS) {
    const day = toDayKey(new Date(time));
    const pattern = patternForDate(snapshot, userId, day);
    if (!pattern) continue;
    counts.set(pattern.pattern_type, (counts.get(pattern.pattern_type) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [type, count] of counts) {
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Código de turno del día aplicando la prioridad del módulo Horarios.
 * Devuelve null cuando el día es descanso o no hay horario.
 */
export function codeForDay(snapshot: RosterSnapshot, userId: string, day: string): string | null {
  const shift = snapshot.shifts.find(
    (item) => item.user_id === userId && toDayKey(item.date) === day
  );
  if (shift) return shift.shift_code;

  const incidents = snapshot.exceptions.filter(
    (item) => item.user_id === userId && toDayKey(item.date) === day
  );
  if (incidents.length > 0) {
    const mapped = incidents
      .map((item) => EXCEPTION_CODES[item.exception_type] ?? item.exception_type)
      .filter(Boolean);
    // Una ausencia pesa más que un tiempo extra para efectos de horas programadas.
    const absence = mapped.find((code) => ABSENCE_CODES.has(code));
    return absence ?? mapped[0] ?? null;
  }

  const pattern = patternForDate(snapshot, userId, day);
  if (!pattern) return null;
  const dayIndex = Math.round((parseDay(day) - pattern.start_date.getTime()) / DAY_MS);
  if (!Number.isFinite(dayIndex) || dayIndex < 0) return null;

  if (pattern.pattern_type === 'MIXTO') {
    const weekday = new Date(parseDay(day)).getUTCDay();
    return weekday === 0 ? null : 'M';
  }
  if (pattern.pattern_type === '4X4_FIJO') {
    return dayIndex % 8 < 4 ? 'D' : null;
  }
  if (pattern.pattern_type === '4X4_ROTATORIO') {
    const cycle = dayIndex % 8;
    if (cycle < 2) return 'D';
    if (cycle < 4) return 'N';
    return null;
  }
  return null;
}

/**
 * Horas y fin de turno de un día concreto.
 * El turno mixto trabaja 9 h de lunes a viernes y 5 h el sábado, igual que Horarios.
 */
export function rosterDayFor(
  snapshot: RosterSnapshot,
  userId: string,
  day: string,
  options: { hoursByCode: Record<string, number>; shiftEndByCode: Record<string, string> }
): RosterDay {
  const code = codeForDay(snapshot, userId, day);
  if (!code) {
    const hasAnySchedule = Boolean(patternForDate(snapshot, userId, day)) ||
      snapshot.shifts.some((item) => item.user_id === userId && toDayKey(item.date) === day) ||
      snapshot.exceptions.some((item) => item.user_id === userId && toDayKey(item.date) === day);
    return { code: null, kind: hasAnySchedule ? 'rest' : 'unknown', hours: 0, endTime: null };
  }

  if (ABSENCE_CODES.has(code)) {
    return { code, kind: 'absence', hours: 0, endTime: null };
  }

  const isSaturday = new Date(parseDay(day)).getUTCDay() === 6;
  const effectiveCode = code === 'M' && isSaturday ? 'M_SAT' : code;

  const hours = options.hoursByCode[effectiveCode] ?? options.hoursByCode[code] ?? 8;
  const endTime = options.shiftEndByCode[effectiveCode] ?? options.shiftEndByCode[code] ?? null;

  if (!WORK_CODES.has(code)) {
    return { code, kind: 'unknown', hours: 0, endTime };
  }
  return { code, kind: 'work', hours: Number.isFinite(hours) ? hours : 0, endTime };
}
