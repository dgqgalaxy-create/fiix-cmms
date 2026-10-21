import type { RosterResponse, TimeDebt } from '../api/roster';
import { personnelDayStatus } from './personnelRoster';
import { addDays } from './weeklyReport';

/** Tipos y cálculos del “Resumen semanal” de Horarios (solo lectura). */

export const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const EVENT_LABELS: Record<string, string> = {
  FALTA: 'Falta',
  VACACIONES: 'Vacaciones',
  PERMISO_CG: 'Permiso con goce',
  PERMISO_SG: 'Permiso sin goce',
  TIEMPO_EXTRA: 'Tiempo extra',
  TIEMPO_POR_TIEMPO: 'Tiempo por tiempo',
  FESTIVO: 'Festivo',
};

export const roleLabel = (role: string): string =>
  role === 'ADMINISTRADOR' ? 'Administrador' : role === 'GESTIONADOR' ? 'Gestionador' : 'Técnico';

/** Minutos entre dos horas HH:mm (soporta cruce de medianoche). */
export function minutesBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (![h1, m1, h2, m2].every(Number.isFinite)) return null;
  const a = h1 * 60 + m1;
  const b = h2 * 60 + m2;
  if (a === b) return null;
  return (b - a + 1440) % 1440;
}

/** "6 h 30 min" / "45 min" / "—". */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Horas decimales para Excel (2 decimales). */
export const hoursValue = (minutes: number): number => Math.round((minutes / 60) * 100) / 100;

/** Horas programadas estimadas según el turno del día (día/noche 12 h; mixto 9 h L-V y 5 h sábado). */
export function scheduledMinutesFor(label: string, day: string): number {
  if (label === 'Turno día' || label === 'Día + tiempo extra') return 720;
  if (label === 'Turno noche' || label === 'Noche + tiempo extra') return 720;
  if (label === 'Turno mixto') {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 6 = sábado, 0 = domingo
    return weekday === 6 ? 300 : weekday === 0 ? 0 : 540;
  }
  return 0;
}

export interface WeeklySummaryEvent {
  date: string;
  type: string;
  label: string;
  start: string | null;
  end: string | null;
  minutes: number;
  notes: string | null;
}

export interface WeeklySummaryDay {
  day: string;
  label: string;
  dateLabel: string;
  scheduled: boolean;
  kind: string;
}

export interface WeeklySummaryRow {
  id: string;
  name: string;
  role: string;
  scheduledDays: number;
  scheduledMinutes: number;
  overtimeEntries: number;
  overtimeMinutes: number;
  txtEntries: number;
  txtMinutes: number;
  faltas: number;
  vacaciones: number;
  permisos: number;
  festivos: number;
  debtMinutes: number;
  days: WeeklySummaryDay[];
  events: WeeklySummaryEvent[];
}

const dateLabel = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

/** Construye las filas del resumen para la semana que inicia en `startDay` (lunes). */
export function buildWeeklySummary(
  roster: RosterResponse,
  debts: TimeDebt[],
  startDay: string,
): WeeklySummaryRow[] {
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startDay, index));
  const inWeek = new Set(weekDays);
  // Tiempo extra / tiempo por tiempo son ADICIONALES al turno: no deben sustituir
  // el turno del día al calcular las horas programadas.
  const rosterBase = {
    ...roster,
    exceptions: roster.exceptions.filter(
      (item) => !['TIEMPO_EXTRA', 'TIEMPO_POR_TIEMPO'].includes(item.exception_type),
    ),
  };

  const rows = roster.technicians.map((person) => {
    const days: WeeklySummaryDay[] = weekDays.map((day) => {
      const status = personnelDayStatus(rosterBase, person.id, day);
      return {
        day,
        label: status.label,
        dateLabel: dateLabel(day),
        scheduled: status.scheduled && status.kind === 'work',
        kind: status.kind,
      };
    });

    const scheduledDays = days.filter((day) => day.scheduled).length;
    const scheduledMinutes = days.reduce(
      (sum, day) => sum + (day.scheduled ? scheduledMinutesFor(day.label, day.day) : 0),
      0,
    );

    const personExceptions = roster.exceptions.filter(
      (item) => item.user_id === person.id && inWeek.has(item.date.slice(0, 10)),
    );
    const overtime = personExceptions.filter((item) => item.exception_type === 'TIEMPO_EXTRA');
    const txt = personExceptions.filter((item) => item.exception_type === 'TIEMPO_POR_TIEMPO');

    const overtimeMinutes = overtime.reduce(
      (sum, item) => sum + (minutesBetween(item.start_time, item.end_time) ?? 0),
      0,
    );
    const txtMinutes = txt.reduce(
      (sum, item) => sum + (item.paid_minutes ?? minutesBetween(item.start_time, item.end_time) ?? 0),
      0,
    );

    const events: WeeklySummaryEvent[] = personExceptions
      .map((item) => ({
        date: item.date.slice(0, 10),
        type: item.exception_type,
        label: EVENT_LABELS[item.exception_type] ?? item.exception_type,
        start: item.start_time ?? null,
        end: item.end_time ?? null,
        minutes:
          item.exception_type === 'TIEMPO_POR_TIEMPO'
            ? (item.paid_minutes ?? minutesBetween(item.start_time, item.end_time) ?? 0)
            : (minutesBetween(item.start_time, item.end_time) ?? 0),
        notes: item.notes ?? null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const debtsForPerson = debts.filter((debt) => debt.user_id === person.id);

    return {
      id: person.id,
      name: person.name,
      role: person.role,
      scheduledDays,
      scheduledMinutes,
      overtimeEntries: overtime.length,
      overtimeMinutes,
      txtEntries: txt.length,
      txtMinutes,
      faltas: personExceptions.filter((item) => item.exception_type === 'FALTA').length,
      vacaciones: personExceptions.filter((item) => item.exception_type === 'VACACIONES').length,
      permisos: personExceptions.filter((item) =>
        ['PERMISO_CG', 'PERMISO_SG'].includes(item.exception_type),
      ).length,
      festivos: personExceptions.filter((item) => item.exception_type === 'FESTIVO').length,
      debtMinutes: debtsForPerson.reduce((sum, debt) => sum + (debt.remaining_minutes ?? 0), 0),
      days,
      events,
    } satisfies WeeklySummaryRow;
  });

  return rows
    .filter((row) => row.scheduledDays > 0 || row.events.length > 0 || row.debtMinutes > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export interface WeeklySummaryTotals {
  people: number;
  overtimeMinutes: number;
  txtMinutes: number;
  faltas: number;
  debtMinutes: number;
}

export function weeklyTotals(rows: WeeklySummaryRow[]): WeeklySummaryTotals {
  return {
    people: rows.length,
    overtimeMinutes: rows.reduce((sum, row) => sum + row.overtimeMinutes, 0),
    txtMinutes: rows.reduce((sum, row) => sum + row.txtMinutes, 0),
    faltas: rows.reduce((sum, row) => sum + row.faltas, 0),
    debtMinutes: rows.reduce((sum, row) => sum + row.debtMinutes, 0),
  };
}
