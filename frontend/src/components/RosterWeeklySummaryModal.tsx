import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Download, FileText, RotateCcw } from 'lucide-react';
import { Modal } from './ui/Modal';
import { getRoster, getTimeDebts } from '../api/roster';
import type { RosterResponse, TimeDebt } from '../api/roster';
import { addDays, plantDay, weekStart } from '../utils/weeklyReport';
import { downloadWorkbook } from '../utils/excelExport';
import { downloadRosterWeeklyPdf } from '../utils/rosterWeeklyPdf';
import {
  buildWeeklySummary,
  formatMinutes,
  hoursValue,
  roleLabel,
  weeklyTotals,
  type WeeklySummaryRow,
} from '../utils/rosterWeeklySummary';

const shortDate = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
  });

const thisWeekStart = (): string => weekStart(plantDay(new Date()));

export function RosterWeeklySummaryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [startDay, setStartDay] = useState(thisWeekStart);
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [debts, setDebts] = useState<TimeDebt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const endDay = addDays(startDay, 6);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getRoster(startDay, endDay),
      getTimeDebts().catch(() => [] as TimeDebt[]),
    ])
      .then(([nextRoster, nextDebts]) => {
        if (cancelled) return;
        setRoster(nextRoster);
        setDebts(nextDebts);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el horario de la semana. Intenta de nuevo.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, startDay, endDay]);

  const rows = useMemo(
    () => (roster ? buildWeeklySummary(roster, debts, startDay) : []),
    [roster, debts, startDay],
  );
  const totals = useMemo(() => weeklyTotals(rows), [rows]);
  const canExport = !loading && !error && rows.length > 0;

  const exportExcel = () => {
    if (!canExport) return;
    const summaryRows = rows.map((row) => ({
      Persona: row.name,
      Rol: roleLabel(row.role),
      'Días programados': row.scheduledDays,
      'Horas programadas (h)': hoursValue(row.scheduledMinutes),
      'Horas extra (h)': hoursValue(row.overtimeMinutes),
      'Registros tiempo extra': row.overtimeEntries,
      'TxT tomado (h)': hoursValue(row.txtMinutes),
      'Registros TxT': row.txtEntries,
      Faltas: row.faltas,
      Vacaciones: row.vacaciones,
      Permisos: row.permisos,
      Festivos: row.festivos,
      'Deuda pendiente (h)': hoursValue(row.debtMinutes),
    }));
    const detailRows = rows.flatMap((row) =>
      row.events.map((event) => ({
        Persona: row.name,
        Fecha: event.date,
        Tipo: event.label,
        Inicio: event.start ?? '',
        Fin: event.end ?? '',
        'Horas (h)': hoursValue(event.minutes),
        Notas: event.notes ?? '',
      })),
    );
    downloadWorkbook(`Resumen_Horarios_${startDay}_${endDay}.xlsx`, [
      { name: 'Resumen', rows: summaryRows },
      { name: 'Detalle', rows: detailRows },
    ]);
  };

  const exportPdf = () => {
    if (!canExport) return;
    downloadRosterWeeklyPdf({ startDay, endDay, rows });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Resumen semanal de Horarios"
      description="Solo lectura · Semana lunes a domingo · Hora de planta (America/Mexico_City)"
      size="xl"
      icon={<BarChart3 size={20} className="mt-0.5 text-emerald-600 dark:text-emerald-400" />}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStartDay((day) => addDays(day, -7))}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Semana anterior"
              aria-label="Semana anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-[190px] text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {shortDate(startDay)} – {shortDate(endDay)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lunes a domingo · {new Date(`${startDay}T12:00:00Z`).getUTCFullYear()}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStartDay((day) => addDays(day, 7))}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Semana siguiente"
              aria-label="Semana siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setStartDay(thisWeekStart())}
              className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Volver a la semana actual"
            >
              <RotateCcw size={13} /> Hoy
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportExcel}
              disabled={!canExport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} /> Excel
            </button>
            <button
              type="button"
              onClick={exportPdf}
              disabled={!canExport}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-slate-500 dark:text-slate-400">
            <div className="mr-3 h-5 w-5 animate-spin rounded-full border-b-2 border-emerald-600" /> Cargando semana…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            No hay personal programado ni incidencias en esta semana.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Personas con actividad', value: String(totals.people) },
                { label: 'Horas extra', value: formatMinutes(totals.overtimeMinutes) },
                { label: 'TxT tomado', value: formatMinutes(totals.txtMinutes) },
                { label: 'Faltas', value: String(totals.faltas) },
              ].map((card) => (
                <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">{card.value}</p>
                </div>
              ))}
            </div>
            {totals.debtMinutes > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Deuda de tiempo pendiente del equipo: <strong>{formatMinutes(totals.debtMinutes)}</strong>
              </p>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[860px] text-xs">
                <thead className="bg-slate-800 text-white dark:bg-slate-950">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Persona</th>
                    <th className="px-2 py-2 text-center font-semibold">Días</th>
                    <th className="px-2 py-2 text-center font-semibold">H. prog.</th>
                    <th className="px-2 py-2 text-center font-semibold">H. extra</th>
                    <th className="px-2 py-2 text-center font-semibold"># TE</th>
                    <th className="px-2 py-2 text-center font-semibold">TxT</th>
                    <th className="px-2 py-2 text-center font-semibold">Faltas</th>
                    <th className="px-2 py-2 text-center font-semibold">Vac.</th>
                    <th className="px-2 py-2 text-center font-semibold">Perm.</th>
                    <th className="px-2 py-2 text-center font-semibold">Deuda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((row) => (
                    <WeeklyRow
                      key={row.id}
                      row={row}
                      expanded={expanded === row.id}
                      onToggle={() => setExpanded((current) => (current === row.id ? null : row.id))}
                    />
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <tr>
                    <td className="px-3 py-2">Totales ({totals.people})</td>
                    <td className="px-2 py-2 text-center">—</td>
                    <td className="px-2 py-2 text-center">—</td>
                    <td className="px-2 py-2 text-center">{formatMinutes(totals.overtimeMinutes)}</td>
                    <td className="px-2 py-2 text-center">—</td>
                    <td className="px-2 py-2 text-center">{formatMinutes(totals.txtMinutes)}</td>
                    <td className="px-2 py-2 text-center">{totals.faltas}</td>
                    <td className="px-2 py-2 text-center">—</td>
                    <td className="px-2 py-2 text-center">—</td>
                    <td className="px-2 py-2 text-center">{formatMinutes(totals.debtMinutes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Toca una fila para ver el detalle día por día. Solo lectura: no modifica horarios, deudas ni registros.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

function WeeklyRow({
  row,
  expanded,
  onToggle,
}: {
  row: WeeklySummaryRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cell = 'px-2 py-2 text-center';
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
        title="Ver detalle de la semana"
      >
        <td className="px-3 py-2">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{row.name}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{roleLabel(row.role)}</p>
        </td>
        <td className={cell}>{row.scheduledDays}</td>
        <td className={cell}>{formatMinutes(row.scheduledMinutes)}</td>
        <td className={`${cell} font-bold ${row.overtimeMinutes > 0 ? 'text-emerald-700 dark:text-emerald-300' : ''}`}>
          {formatMinutes(row.overtimeMinutes)}
        </td>
        <td className={cell}>{row.overtimeEntries || '—'}</td>
        <td className={cell}>{formatMinutes(row.txtMinutes)}</td>
        <td className={`${cell} ${row.faltas > 0 ? 'font-bold text-rose-700 dark:text-rose-300' : ''}`}>{row.faltas || '—'}</td>
        <td className={cell}>{row.vacaciones || '—'}</td>
        <td className={cell}>{row.permisos || '—'}</td>
        <td className={cell}>{formatMinutes(row.debtMinutes)}</td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/70 dark:bg-slate-900/40">
          <td colSpan={10} className="px-3 py-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Turnos de la semana
                </p>
                <ul className="space-y-1">
                  {row.days.map((day) => (
                    <li key={day.day} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500 dark:text-slate-400">{day.dateLabel}</span>
                      <span className={day.scheduled ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
                        {day.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Incidencias y tiempos
                </p>
                {row.events.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sin incidencias registradas esta semana.</p>
                ) : (
                  <ul className="space-y-1">
                    {row.events.map((event, index) => (
                      <li key={`${event.date}-${event.type}-${index}`} className="text-xs text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">{event.date}</span> · {event.label}
                        {event.start || event.end ? ` · ${event.start ?? '—'}–${event.end ?? '—'}` : ''}
                        {event.minutes > 0 ? ` · ${formatMinutes(event.minutes)}` : ''}
                        {event.notes ? ` · ${event.notes}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
