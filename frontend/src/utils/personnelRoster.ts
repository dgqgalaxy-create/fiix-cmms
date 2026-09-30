import type { RosterResponse } from '../api/roster';

export interface PersonnelRosterStatus {
  label: string;
  scheduled: boolean;
  kind: 'work' | 'rest' | 'absence' | 'unknown';
}
const work = (label: string): PersonnelRosterStatus => ({ label, scheduled: true, kind: 'work' });
const absence = (label: string): PersonnelRosterStatus => ({ label, scheduled: false, kind: 'absence' });
const rest: PersonnelRosterStatus = { label: 'Descanso', scheduled: false, kind: 'rest' };
const unknown: PersonnelRosterStatus = { label: 'Sin horario registrado', scheduled: false, kind: 'unknown' };
const codes: Record<string, PersonnelRosterStatus> = {
  D: work('Turno día'), N: work('Turno noche'), M: work('Turno mixto'),
  D_TE: work('Día + tiempo extra'), N_TE: work('Noche + tiempo extra'), TE: work('Tiempo extra'),
  TXT: work('Tiempo por tiempo'), CURSO: work('Curso'),
  V: absence('Vacaciones'), I: absence('Incapacidad'), F: absence('Falta'),
  PSG: absence('Permiso sin goce'), X: absence('Baja'), DESCANSO: rest,
};
const exceptions: Record<string, PersonnelRosterStatus> = {
  FALTA: codes.F, VACACIONES: codes.V, PERMISO_SG: codes.PSG,
  PERMISO_CG: absence('Permiso con goce'), TIEMPO_EXTRA: codes.TE,
  TIEMPO_POR_TIEMPO: codes.TXT, FESTIVO: absence('Día festivo'),
};

/** Uses the same priority as Horarios: explicit shift, exceptions, then pattern. */
export function personnelDayStatus(roster: RosterResponse, userId: string, day: string): PersonnelRosterStatus {
  const shift = roster.shifts.find(item => item.user_id === userId && item.date.slice(0, 10) === day);
  if (shift) return codes[shift.shift_code] ?? { ...unknown, label: shift.shift_code };
  const incidents = roster.exceptions.filter(item => item.user_id === userId && item.date.slice(0, 10) === day);
  if (incidents.length) {
    const states = incidents.map(item => exceptions[item.exception_type] ?? { ...unknown, label: item.exception_type });
    return {
      label: states.map(state => state.label).join(' · '),
      scheduled: states.every(state => state.scheduled),
      kind: states.some(state => state.kind === 'absence') ? 'absence' : states[0].kind,
    };
  }
  const pattern = roster.patterns.find(item => item.user_id === userId);
  if (!pattern) return unknown;
  const days = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${pattern.start_date.slice(0, 10)}T12:00:00Z`)) / 86400000);
  if (days < 0 || !Number.isFinite(days)) return unknown;
  if (pattern.pattern_type === 'MIXTO') return new Date(`${day}T12:00:00Z`).getUTCDay() === 0 ? rest : codes.M;
  if (pattern.pattern_type === '4X4_FIJO') return days % 8 < 4 ? codes.D : rest;
  if (pattern.pattern_type === '4X4_ROTATORIO') return days % 8 < 2 ? codes.D : days % 8 < 4 ? codes.N : rest;
  return unknown;
}

export interface PersonnelCurrentStatus extends PersonnelRosterStatus { onDuty: boolean }
const civilDay = (instant: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}-${parts.find(p => p.type === 'day')!.value}`;
};
const minuteOfDay = (instant: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  return Number(parts.find(p => p.type === 'hour')!.value) * 60 + Number(parts.find(p => p.type === 'minute')!.value);
};
const parseTime = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };

/** Compare yesterday's overnight shifts as well as today's schedule, in plant time. */
export function personnelCurrentStatus(roster: RosterResponse, userId: string, instant: Date): PersonnelCurrentStatus {
  const today = civilDay(instant);
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const now = minuteOfDay(instant);
  const timed = roster.exceptions.filter(item => item.user_id === userId && ['TIEMPO_EXTRA', 'TIEMPO_POR_TIEMPO'].includes(item.exception_type));
  const regularRoster = { ...roster, exceptions: roster.exceptions.filter(item => !timed.includes(item)) };
  const active: string[] = [];
  const contains = (day: string, start: number, end: number) => {
    const offset = day === yesterday ? -1440 : 0;
    return now >= offset + start && now < offset + end + (end <= start ? 1440 : 0);
  };
  for (const day of [yesterday, today]) {
    const state = personnelDayStatus(regularRoster, userId, day);
    let range: [number, number] | null = null;
    if (['Turno día', 'Día + tiempo extra'].includes(state.label)) range = [420, 1140];
    if (['Turno noche', 'Noche + tiempo extra'].includes(state.label)) range = [1140, 420];
    if (state.label === 'Turno mixto') {
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      if (weekday !== 0) range = [420, weekday === 6 ? 720 : 960];
    }
    if (range && contains(day, ...range)) active.push(state.label);
    for (const entry of timed.filter(item => item.date.slice(0, 10) === day)) {
      if (entry.start_time && entry.end_time && contains(day, parseTime(entry.start_time), parseTime(entry.end_time))) {
        active.push(entry.exception_type === 'TIEMPO_EXTRA' ? 'Tiempo extra' : 'Tiempo por tiempo');
      }
    }
  }
  if (active.length) return { label: `En turno · ${[...new Set(active)].join(' · ')}`, onDuty: true, scheduled: true, kind: 'work' };
  const state = personnelDayStatus(regularRoster, userId, today);
  const todayExtras = timed.filter(item => item.date.slice(0, 10) === today);
  if (state.kind === 'absence') return { ...state, onDuty: false };
  const extrasLabel = [...new Set(todayExtras.map(item => item.exception_type === 'TIEMPO_EXTRA' ? 'Tiempo extra' : 'Tiempo por tiempo'))].join(' · ');
  const unconfigured = todayExtras.some(item => !item.start_time || !item.end_time) || (['Tiempo extra', 'Tiempo por tiempo', 'Curso'].includes(state.label) && !todayExtras.some(item => item.start_time && item.end_time));
  if (unconfigured) return { ...state, label: `${extrasLabel || state.label} · Horas sin registrar`, onDuty: false, kind: 'unknown' };
  if (state.scheduled || todayExtras.length) return { ...state, label: `Fuera de turno · ${extrasLabel || state.label}`, kind: 'rest', onDuty: false };
  return { ...state, onDuty: false };
}
