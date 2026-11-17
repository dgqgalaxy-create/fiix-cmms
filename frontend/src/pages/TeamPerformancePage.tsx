import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  Flag,
  Gauge,
  Loader2,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import {
  getPerformanceSettings,
  getTeamPerformance,
  type PerformanceConfig,
  type PerformanceCompare,
  type PerformanceReport,
  type TechnicianPerformanceRow,
} from '../api/performance';
import { useAuth } from '../context/AuthContext';
import { PerformanceSettingsModal } from '../components/performance/PerformanceSettingsModal';

const PERIODS = [
  { value: 7, label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

const FLAG_LABELS: Array<{ key: keyof TechnicianPerformanceRow['flags']; label: string; hint: string }> = [
  { key: 'express_close', label: 'Cierre exprés', hint: 'Cerró sin evidencia ni refacción en pocos minutos' },
  { key: 'accept_without_start', label: 'Sin iniciar', hint: 'OT asignadas que siguen sin iniciar' },
  { key: 'ping_pong', label: 'Ping-pong', hint: 'OT rebotadas entre técnicos' },
  { key: 'duplicate_evidence', label: 'Evidencia repetida', hint: 'Misma foto usada en varias OT' },
  { key: 'end_of_shift', label: 'Fin de turno', hint: 'Cierres en los últimos minutos del turno' },
  { key: 'cherry_pick', label: 'Selección de trabajo', hint: 'Hace más preventivas que el promedio del equipo' },
  { key: 'evidence_low', label: 'Evidencia baja', hint: 'Porcentaje de cierres con evidencia por debajo de la meta' },
];

const semaphoreStyles: Record<string, { dot: string; text: string; bg: string }> = {
  green: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  red: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-950/40' },
  none: { dot: 'bg-slate-300', text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
};

const SHIFT_TITLES: Record<string, string> = {
  MIXTO: 'Mixto',
  '4X4_FIJO': '4x4 fijo',
  '4X4_ROTATORIO': '4x4 rotatorio',
  D: 'Día',
  N: 'Noche',
  M: 'Mixto',
  M_SAT: 'Mixto sábado',
  D_TE: 'Día + extra',
  N_TE: 'Noche + extra',
  TE: 'Tiempo extra',
  TXT: 'Tiempo por tiempo',
  CURSO: 'Curso',
  V: 'Vacaciones',
  I: 'Incapacidad',
  F: 'Falta',
  PSG: 'Permiso',
  X: 'Descanso',
};

const shiftTitle = (code: string | null): string => (code ? SHIFT_TITLES[code] ?? code : 'sin horario');
const formatPercent = (value: number | null): string => (value === null ? '—' : `${Math.round(value)}%`);
const formatMinutes = (value: number | null): string => {
  if (value === null) return '—';
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
};

const metricColor = (value: number | null, good: number, warn: number, inverse = false): string => {
  if (value === null) return 'text-slate-400';
  if (inverse) {
    if (value <= good) return 'text-emerald-700 dark:text-emerald-300 font-bold';
    if (value <= warn) return 'text-amber-700 dark:text-amber-300 font-bold';
    return 'text-rose-700 dark:text-rose-300 font-bold';
  }
  if (value >= good) return 'text-emerald-700 dark:text-emerald-300 font-bold';
  if (value >= warn) return 'text-amber-700 dark:text-amber-300 font-bold';
  return 'text-rose-700 dark:text-rose-300 font-bold';
};

export function TeamPerformancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const periodParam = Number(searchParams.get('period') ?? '30');
  const period = Number.isFinite(periodParam) ? periodParam : 30;
  const compare: PerformanceCompare = searchParams.get('compare') === 'all' ? 'all' : 'shift';
  const openSettings = searchParams.get('settings') === '1';

  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [config, setConfig] = useState<PerformanceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settings, data] = await Promise.all([
        getPerformanceSettings(),
        getTeamPerformance({ period, compare }),
      ]);
      setConfig(settings.config);
      setReport(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo cargar el desempeño del equipo.');
    } finally {
      setLoading(false);
    }
  }, [period, compare]);

  useEffect(() => {
    void load();
  }, [load]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const targetsFor = (row: TechnicianPerformanceRow) => ({
    ...(report?.config.targets ?? {
      ftf_pct: 75, sla_pct: 90, evidence_pct: 90, utilization_pct: 60, attention_max_min: 15, backlog_max: 2,
    }),
    ...(row.shift_code ? report?.config.targets_by_code?.[row.shift_code] ?? {} : {}),
  });
  const rows = report?.rows ?? [];
  const summary = report?.summary;

  const exportRows = useMemo(
    () =>
      rows.map((row) => ({
        Técnico: row.name,
        Turno: row.shift_code ?? 'Sin turno',
        'OT cerradas': row.completed,
        'Atención (min)': row.attention_min ?? '',
        'Utilización (%)': row.utilization_pct ?? '',
        'Resuelto 1.ª (%)': row.ftf_pct ?? '',
        'SLA (%)': row.sla_pct ?? '',
        'Evidencia (%)': row.evidence_pct ?? '',
        'Backlog viejo': row.backlog_old,
        Índice: row.index ?? '',
        Semáforo: row.semaphore,
        'Cierre exprés': row.flags.express_close,
        'Sin iniciar': row.flags.accept_without_start,
        'Ping-pong': row.flags.ping_pong,
        'Evidencia repetida': row.flags.duplicate_evidence,
        'Fin de turno': row.flags.end_of_shift,
      })),
    [rows]
  );

  const handleExportCsv = () => {
    if (!exportRows.length) return;
    const headers = Object.keys(exportRows[0]);
    const lines = [
      headers.join(','),
      ...exportRows.map((row) =>
        headers
          .map((header) => `"${String((row as Record<string, unknown>)[header] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `desempeno-equipo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (!exportRows.length) return;
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Desempeño');
    XLSX.writeFile(book, `desempeno-equipo-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPdf = () => {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(15);
    doc.text('Desempeño del equipo', 12, 14);
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      `Periodo: ${new Date(report.from).toLocaleDateString()} - ${new Date(report.to).toLocaleDateString()} · Comparación: ${
        report.compare === 'shift' ? 'por turno' : 'todo el equipo'
      } · Modo: ${report.config.mode === 'relative' ? 'relativa' : 'fija'}`,
      12,
      20
    );

    const columns = [
      { label: 'Técnico', width: 58 },
      { label: 'Turno', width: 16 },
      { label: 'OT', width: 12 },
      { label: 'Atención', width: 22 },
      { label: 'Util.', width: 16 },
      { label: '1.ª', width: 14 },
      { label: 'SLA', width: 14 },
      { label: 'Evid.', width: 16 },
      { label: 'Backlog', width: 18 },
      { label: 'Índice', width: 16 },
    ];

    let y = 28;
    doc.setFontSize(8);
    doc.setTextColor(30);
    let x = 12;
    for (const column of columns) {
      doc.text(column.label, x, y);
      x += column.width;
    }
    y += 2;
    doc.setDrawColor(220);
    doc.line(12, y, 285, y);
    y += 5;

    for (const row of report.rows) {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      const values = [
        row.name.slice(0, 42),
        row.shift_code ?? '—',
        String(row.completed),
        formatMinutes(row.attention_min),
        formatPercent(row.utilization_pct),
        formatPercent(row.ftf_pct),
        formatPercent(row.sla_pct),
        formatPercent(row.evidence_pct),
        String(row.backlog_old),
        row.index === null ? '—' : String(Math.round(row.index)),
      ];
      x = 12;
      values.forEach((value, index) => {
        doc.text(value, x, y);
        x += columns[index].width;
      });
      y += 5;
    }

    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(
      `Generado ${new Date(report.generated_at).toLocaleString()} · muestra mínima ${report.config.min_sample} OT`,
      12,
      y + 4
    );
    doc.save(`desempeno-equipo-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const goToProfile = (row: TechnicianPerformanceRow) => {
    navigate(`/kpis/technicians/${row.user_id}`);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            <Gauge className="text-emerald-600" size={26} /> Desempeño del equipo
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Quién atiende de verdad: atención, trabajo registrado, calidad del cierre y señales de alarma.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            {PERIODS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setParam('period', String(option.value))}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  period === option.value
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            {([
              ['shift', 'Por turno'],
              ['all', 'Todo el equipo'],
            ] as Array<[PerformanceCompare, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setParam('compare', key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                  compare === key ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            title="Recalcular"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Download size={14} /> CSV
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Download size={14} /> Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Download size={14} /> PDF
          </button>

          <button
            type="button"
            onClick={() => setParam('settings', '1')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 py-2 text-[11px] font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
            title={isAdmin ? 'Configurar parámetros' : 'Solo el administrador puede cambiarlos'}
          >
            <Settings2 size={14} /> Parámetros
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {report && report.summary.total_completed === 0 && !loading && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>
            No hay órdenes cerradas en este periodo. Prueba con <b>90 días</b> o revisa que las órdenes tengan fecha de cierre.
          </span>
        </div>
      )}

      {report && report.rows.length > 0 && report.rows.every((row) => row.utilization_pct === null) && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-[11.5px] text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300">
          La utilización aparece vacía porque no hay horario (patrón o turno) registrado para estas personas en el periodo. Captúralo en
          «Horarios» para que la métrica se calcule.
        </div>
      )}

      {summary && report && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Users size={14} /> Técnicos evaluados
            </div>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{report.reference.technicians}</p>
            <p className="text-[11px] text-slate-500">
              {report.summary.insufficient} con muestra insuficiente · {report.teams.length} turno(s)
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Gauge size={14} /> Índice promedio
            </div>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{summary.avg_index ?? '—'}</p>
            <p className="text-[11px] text-slate-500">{summary.total_completed} OT cerradas en el periodo</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <ShieldAlert size={14} /> Semáforo
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm font-black">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {summary.green}
              </span>
              <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> {summary.amber}
              </span>
              <span className="flex items-center gap-1 text-rose-700 dark:text-rose-300">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> {summary.red}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Verde ≥ {report.config.thresholds.green} · ámbar ≥ {report.config.thresholds.amber}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Flag size={14} /> Banderas abiertas
            </div>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{summary.open_flags}</p>
            <p className="text-[11px] text-slate-500">Señales para revisar con la persona</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <CalendarDays size={14} />
            {report
              ? `${new Date(report.from).toLocaleDateString()} — ${new Date(report.to).toLocaleDateString()}`
              : 'Cargando periodo…'}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {report?.config.mode === 'relative'
              ? 'Modo relativo: se compara contra el grupo (percentiles).'
              : 'Modo fijo: se compara contra las metas configuradas.'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <th className="px-3 py-2">Técnico</th>
                <th className="px-3 py-2 text-right">OT</th>
                <th className="px-3 py-2 text-right">Atención</th>
                <th className="px-3 py-2 text-right">Utilización</th>
                <th className="px-3 py-2 text-right">Resuelto 1.ª</th>
                <th className="px-3 py-2 text-right">SLA</th>
                <th className="px-3 py-2 text-right">Evidencia</th>
                <th className="px-3 py-2 text-right">Backlog</th>
                <th className="px-3 py-2 text-right">Índice</th>
                <th className="px-3 py-2">Banderas</th>
              </tr>
            </thead>
            <tbody>
              {loading && !report && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto mb-2 animate-spin text-emerald-600" size={20} /> Calculando…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                    No hay técnicos activos con OT en el periodo.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const style = semaphoreStyles[row.semaphore];
                const isOpen = expanded === row.user_id;
                const flagCount =
                  row.flags.express_close +
                  row.flags.accept_without_start +
                  row.flags.ping_pong +
                  row.flags.duplicate_evidence +
                  row.flags.end_of_shift +
                  (row.flags.cherry_pick ? 1 : 0) +
                  (row.flags.evidence_low ? 1 : 0);

                return (
                  <tr key={row.user_id} className="group">
                    <td className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : row.user_id)}
                        className="flex items-center gap-2 text-left"
                      >
                        {isOpen ? (
                          <ChevronDown size={14} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={14} className="text-slate-400" />
                        )}
                        <span>
                          <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{row.name}</span>
                          <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">
                            {row.role === 'GESTIONADOR' ? 'Gestionador' : 'Técnico'}
                            {row.shift_code ? ` · ${shiftTitle(row.shift_code)}` : ' · sin horario en Horarios'}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="border-t border-slate-100 px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {row.completed}
                    </td>
                    <td className={`border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums dark:border-slate-800 ${metricColor(row.attention_min, targetsFor(row).attention_max_min, targetsFor(row).attention_max_min * 2, true)}`}>
                      {formatMinutes(row.attention_min)}
                    </td>
                    <td className={`border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums dark:border-slate-800 ${metricColor(row.utilization_pct, targetsFor(row).utilization_pct, targetsFor(row).utilization_pct * 0.66)}`}>
                      {formatPercent(row.utilization_pct)}
                    </td>
                    <td className={`border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums dark:border-slate-800 ${metricColor(row.ftf_pct, targetsFor(row).ftf_pct, targetsFor(row).ftf_pct * 0.8)}`}>
                      {formatPercent(row.ftf_pct)}
                    </td>
                    <td className={`border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums dark:border-slate-800 ${metricColor(row.sla_pct, targetsFor(row).sla_pct, targetsFor(row).sla_pct * 0.83)}`}>
                      {formatPercent(row.sla_pct)}
                    </td>
                    <td className={`border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums dark:border-slate-800 ${metricColor(row.evidence_pct, targetsFor(row).evidence_pct, targetsFor(row).evidence_pct * 0.78)}`}>
                      {formatPercent(row.evidence_pct)}
                    </td>
                    <td className={`border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums dark:border-slate-800 ${metricColor(row.backlog_old, targetsFor(row).backlog_max, targetsFor(row).backlog_max * 2, true)}`}>
                      {row.backlog_old}
                    </td>
                    <td className="border-t border-slate-100 px-3 py-2 text-right dark:border-slate-800">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-black ${style.bg} ${style.text}`}>
                        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                        {row.insufficient ? 'muestra' : row.index ?? '—'}
                      </span>
                    </td>
                    <td className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-1">
                        {flagCount === 0 && <span className="text-[10.5px] text-slate-400">sin señales</span>}
                        {row.flags.express_close > 0 && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" title={FLAG_LABELS[0].hint}>
                            exprés {row.flags.express_close}
                          </span>
                        )}
                        {row.flags.accept_without_start > 0 && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" title={FLAG_LABELS[1].hint}>
                            sin iniciar {row.flags.accept_without_start}
                          </span>
                        )}
                        {row.flags.ping_pong > 0 && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" title={FLAG_LABELS[2].hint}>
                            rebote {row.flags.ping_pong}
                          </span>
                        )}
                        {row.flags.duplicate_evidence > 0 && (
                          <span className="rounded bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300" title={FLAG_LABELS[3].hint}>
                            foto repetida {row.flags.duplicate_evidence}
                          </span>
                        )}
                        {row.flags.end_of_shift > 0 && (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200" title={FLAG_LABELS[4].hint}>
                            fin turno {row.flags.end_of_shift}
                          </span>
                        )}
                        {row.flags.cherry_pick && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" title={FLAG_LABELS[5].hint}>
                            selección
                          </span>
                        )}
                        {row.flags.evidence_low && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" title={FLAG_LABELS[6].hint}>
                            evidencia baja
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {expanded && (() => {
          const row = rows.find((item) => item.user_id === expanded);
          if (!row) return null;
          return (
            <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Detalle de {row.name}
                </h3>
                <button
                  type="button"
                  onClick={() => goToProfile(row)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  Ver ficha completa <ArrowUpRight size={12} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Puntaje por dimensión (0-1)</p>
                  <ul className="space-y-1 text-[11.5px] text-slate-600 dark:text-slate-300">
                    {Object.entries(row.scores).map(([metric, score]) => (
                      <li key={metric} className="flex items-center justify-between gap-2">
                        <span>{metric}</span>
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <span
                              className="block h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.round((score ?? 0) * 100)}%` }}
                            />
                          </span>
                          <span className="w-10 text-right tabular-nums">{score === null ? '—' : Math.round(score * 100)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Horas registradas</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {row.labor_hours} h de labor · {row.scheduled_hours} h de turno programadas
                  </p>
                  <p className="mt-2 mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Banderas activas</p>
                  <ul className="space-y-0.5 text-[11.5px] text-slate-600 dark:text-slate-300">
                    {FLAG_LABELS.filter((flag) => {
                      const value = row.flags[flag.key];
                      return typeof value === 'boolean' ? value : value > 0;
                    }).map((flag) => (
                      <li key={flag.key} className="flex items-start gap-1.5">
                        <Flag size={11} className="mt-0.5 shrink-0 text-rose-500" />
                        <span>
                          <b>{flag.label}:</b> {flag.hint}
                        </span>
                      </li>
                    ))}
                    {FLAG_LABELS.every((flag) => {
                      const value = row.flags[flag.key];
                      return typeof value === 'boolean' ? !value : value === 0;
                    }) && <li className="text-emerald-600">Sin señales en el periodo.</li>}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        La atención mide desde la última asignación hasta el inicio de la OT (en órdenes antiguas se usa la fecha de creación).
        La utilización compara la labor registrada con las horas programadas del calendario de Horarios (patrones mixto y 4x4, más excepciones y turnos importados). El índice combina las seis dimensiones con
        los pesos configurados y se oculta cuando no hay muestra suficiente ({report?.config.min_sample ?? 10} OT).
      </p>

      <PerformanceSettingsModal
        isOpen={openSettings}
        onClose={() => setParam('settings', null)}
        config={config}
        onSaved={(next) => {
          setConfig(next);
          void load();
        }}
      />
    </div>
  );
}
