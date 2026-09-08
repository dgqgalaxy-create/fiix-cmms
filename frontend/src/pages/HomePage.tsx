import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
  Siren,
  Trophy,
  Users,
  UserX,
  Volume2,
  VolumeX,
  Wrench,
  XCircle,
  StickyNote,
  Package,
  ShoppingCart,
} from 'lucide-react';
import { PageLoadError, isLikelyServerUnreachable } from '../components/PageLoadState';
import { FilterScopeFrame } from '../components/common/FilterScopeFrame';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getLineStoppageStatus, getWorkOrders, getWorkOrdersSummary } from '../api/workOrders';
import type { LineStoppageStatus, ProductionLine, WorkOrder } from '../api/workOrders';
import { getNotesSummary, type NotesSummary } from '../api/notes';
import { getInventorySummary, type InventorySummary } from '../api/inventory';
import { formatWorkOrderFolio } from '../utils/folio';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { useAuth } from '../context/AuthContext';
import { useControlRoomAlerts } from '../hooks/useControlRoomAlerts';

const isOpenWo = (wo: WorkOrder) => wo.status !== 'FINALIZADO' && wo.status !== 'ANULADO';
const PRODUCTION_LINES: ProductionLine[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

/** Plant-friendly nudges when the current streak is still below the record. */
const STREAK_ENCOURAGE = [
  'Cada día sin paro suma. Sigamos así.',
  'La línea corre; el récord se acerca.',
  'Mantenimiento firme = producción estable.',
  'Detectar a tiempo evita el siguiente paro.',
  'Hoy también: cero paros correctivos en L1–L5.',
  'La racha crece con prevención y respuesta rápida.',
  'Un día más sin correctivo de paro. Buen trabajo.',
  'El récord se gana en el piso, no en el papel.',
];

const STREAK_CELEBRATE = [
  '¡Récord igualado! Manténganlo.',
  '¡Mejor racha histórica! Así se hace en planta.',
  'Récord en juego: cero paros correctivos. Excelente.',
];

function pickMessage(list: string[], seed = Date.now()): string {
  return list[Math.abs(seed) % list.length]!;
}

export const HomePage = () => {
  const navigate = useNavigate();
  const { user, hasPermission, slaEnabled } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [lineStoppage, setLineStoppage] = useState<LineStoppageStatus | null>(null);
  const [notesSummary, setNotesSummary] = useState<NotesSummary | null>(null);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [summaryStartDate, setSummaryStartDate] = useState('');
  const [summaryEndDate, setSummaryEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [streakMsgSeed, setStreakMsgSeed] = useState(() => Date.now());
  const dashboardAbortRef = useRef<AbortController | null>(null);

  const isControlRoomRole =
    user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';

  const openOrders = workOrders.filter(isOpenWo);
  const controlCounts = {
    urgentOpen: openOrders.filter((wo) => wo.priority === 'URGENTE').length,
    unassigned: openOrders.filter((wo) => !wo.assigned_technicians?.length).length,
    slaRisk: openOrders.filter((wo) => wo.sla?.overall === 'RISK').length,
    slaBreached: openOrders.filter((wo) => wo.sla?.overall === 'BREACHED').length,
  };

  const { soundEnabled, setSoundEnabled } = useControlRoomAlerts(
    controlCounts,
    isControlRoomRole
  );

  const fetchDashboard = async (backgroundFetch = false) => {
    const ac = new AbortController();
    dashboardAbortRef.current?.abort();
    dashboardAbortRef.current = ac;
    try {
      if (!backgroundFetch) {
        setIsLoading(true);
        setLoadError(false);
      }
      const end = summaryEndDate || new Date().toISOString().slice(0, 10);
      const start =
        summaryStartDate ||
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [openOrdersData, periodOrders, summaryData, stoppageData, notesData, invData] =
        await Promise.all([
          getWorkOrders({ openOnly: true }, ac.signal),
          getWorkOrders({ startDate: start, endDate: end }, ac.signal),
          getWorkOrdersSummary(summaryStartDate || undefined, summaryEndDate || undefined, ac.signal),
          getLineStoppageStatus(ac.signal),
          getNotesSummary(ac.signal).catch(() => null),
          getInventorySummary(ac.signal).catch(() => null),
        ]);
      if (ac.signal.aborted) return;
      const byId = new Map<string, WorkOrder>();
      for (const wo of [...openOrdersData, ...periodOrders]) byId.set(wo.id, wo);
      setWorkOrders([...byId.values()]);
      setSummary(summaryData);
      setLineStoppage(stoppageData);
      if (notesData) setNotesSummary(notesData);
      if (invData) setInventorySummary(invData);
      setLoadError(false);
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Error fetching dashboard summary', error);
      if (!backgroundFetch) setLoadError(isLikelyServerUnreachable(error));
    } finally {
      if (!backgroundFetch && !ac.signal.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    return () => dashboardAbortRef.current?.abort();
  }, []);

  // Light rotation of streak encouragement (does not refetch data).
  useEffect(() => {
    const id = window.setInterval(() => setStreakMsgSeed(Date.now()), 45_000);
    return () => window.clearInterval(id);
  }, []);

  useSocketRefresh('refresh_work_orders', () => fetchDashboard(true));
  useSocketRefresh('refresh_notes', () => fetchDashboard(true));
  useSocketRefresh('refresh_inventory', () => fetchDashboard(true));
  useSocketRefresh('refresh_purchase_orders', () => fetchDashboard(true));
  useSocketRefresh('refresh_settings', () => fetchDashboard(true));

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setSummary(await getWorkOrdersSummary(summaryStartDate || undefined, summaryEndDate || undefined));
      } catch (error) {
        console.error('Error fetching dashboard summary', error);
      }
    };
    fetchSummary();
  }, [summaryStartDate, summaryEndDate]);

  const isInSummaryRange = (workOrder: WorkOrder) => {
    const created = new Date(workOrder.created_at);
    const start = summaryStartDate ? new Date(`${summaryStartDate}T00:00:00`) : new Date(0);
    const end = summaryEndDate ? new Date(`${summaryEndDate}T23:59:59`) : new Date(8640000000000000);
    return created >= start && created <= end;
  };

  const countPendingByPriority = (priority: string) =>
    workOrders.filter(wo => wo.status === 'PENDIENTE' && wo.priority === priority && isInSummaryRange(wo)).length;

  const getTechsTextByStatus = (status: string) => {
    const assignments: Record<string, number> = {};
    workOrders
      .filter(wo => wo.status === status && isInSummaryRange(wo))
      .forEach(wo => wo.assigned_technicians?.forEach(tech => {
        const firstName = tech.name.split(' ')[0];
        assignments[firstName] = (assignments[firstName] || 0) + 1;
      }));

    const phrases = Object.entries(assignments).map(([name, count]) =>
      `${count} Solicitud${count !== 1 ? 'es' : ''} ${name}`,
    );
    if (phrases.length <= 1) return phrases[0] || '';
    const last = phrases.pop();
    return `${phrases.join(', ')} & ${last}`;
  };

  const getParetoData = () => {
    const problems: Record<string, number> = {};
    workOrders.forEach(wo => {
      if (wo.status === 'FINALIZADO' && wo.maintenance_type === 'CORRECTIVO' && (wo as any).failure_problem) {
        const name = (wo as any).failure_problem.name;
        problems[name] = (problems[name] || 0) + 1;
      }
    });
    const sorted = Object.entries(problems)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, item) => sum + item.count, 0);
    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.count;
      return {
        name: item.name,
        Frecuencia: item.count,
        PorcentajeAcumulado: total ? (cumulative / total) * 100 : 0,
      };
    }).slice(0, 10);
  };

  const getMaintenanceTypeData = () => {
    const counts = { PREVENTIVO: 0, CORRECTIVO: 0, SERVICIO: 0 };
    workOrders
      .filter(wo => wo.status !== 'ANULADO' && isInSummaryRange(wo))
      .forEach(wo => {
        if (wo.maintenance_type in counts) counts[wo.maintenance_type as keyof typeof counts]++;
      });
    return [
      { name: 'Preventivo', value: counts.PREVENTIVO, color: '#10b981' },
      { name: 'Correctivo', value: counts.CORRECTIVO, color: '#f59e0b' },
      { name: 'Servicio', value: counts.SERVICIO, color: '#3b82f6' },
    ].filter(item => item.value > 0);
  };

  const totalRecibidas = Object.entries(summary).reduce(
    (total, [status, count]) => status === 'ANULADO' ? total : total + (count || 0),
    0,
  );
  const paretoData = getParetoData();
  const pieData = getMaintenanceTypeData();
  const maintenanceTotal = pieData.reduce((total, entry) => total + entry.value, 0);
  const urgentCount = countPendingByPriority('URGENTE');
  const normalCount = countPendingByPriority('NORMAL');
  const lowCount = countPendingByPriority('BAJO');
  const activeTechsText = getTechsTextByStatus('EN_PROCESO');
  const pausedTechsText = getTechsTextByStatus('EN_ESPERA');

  const goToStatus = (status?: string) =>
    navigate(status ? `/dashboard?status=${status}` : '/dashboard');

  const goControlRoom = (query: string) => navigate(`/dashboard?${query}`);

  const getCurrentWeekRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Dom, 1 = Lun
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  };

  const { monday: weekStart, sunday: weekEnd } = getCurrentWeekRange();

  const finishedThisWeek = workOrders
    .filter(wo => {
      if (wo.status !== 'FINALIZADO') return false;
      const doneAt = new Date(wo.completed_at || wo.updated_at);
      return doneAt >= weekStart && doneAt <= weekEnd;
    })
    .sort((a, b) => {
      const da = new Date(a.completed_at || a.updated_at).getTime();
      const db = new Date(b.completed_at || b.updated_at).getTime();
      return db - da;
    });

  const weekDayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const weeklyBarData = weekDayLabels.map((label, index) => {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + index);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const count = finishedThisWeek.filter(wo => {
      const doneAt = new Date(wo.completed_at || wo.updated_at);
      return doneAt >= dayStart && doneAt <= dayEnd;
    }).length;
    return { name: label, Finalizadas: count };
  });

  const formatWeekDate = (date: Date) =>
    date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

  type ShiftTechRow = {
    id: string;
    name: string;
    pendientes: number;
    enProceso: number;
    enEspera: number;
    slaRisk: number;
    slaBreached: number;
    total: number;
  };

  const shiftByTech = useMemo(() => {
    const map = new Map<string, ShiftTechRow>();
    for (const wo of workOrders) {
      if (!isOpenWo(wo)) continue;
      const techs = wo.assigned_technicians || [];
      if (techs.length === 0) continue;
      for (const tech of techs) {
        const key = tech.id || tech.name;
        let row = map.get(key);
        if (!row) {
          row = {
            id: tech.id,
            name: tech.name,
            pendientes: 0,
            enProceso: 0,
            enEspera: 0,
            slaRisk: 0,
            slaBreached: 0,
            total: 0,
          };
          map.set(key, row);
        }
        row.total += 1;
        if (wo.status === 'PENDIENTE') row.pendientes += 1;
        else if (wo.status === 'EN_PROCESO') row.enProceso += 1;
        else if (wo.status === 'EN_ESPERA') row.enEspera += 1;
        if (wo.sla?.overall === 'RISK') row.slaRisk += 1;
        if (wo.sla?.overall === 'BREACHED') row.slaBreached += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
  }, [workOrders]);

  const goToShiftRow = () => {
    if (user?.role === 'TECNICO') {
      navigate('/dashboard?tab=mine');
    } else {
      navigate('/dashboard');
    }
  };

  const stoppedByLine = useMemo(() => {
    const map = new Map<ProductionLine, LineStoppageStatus['stoppedLines'][0]['workOrders']>();
    for (const line of PRODUCTION_LINES) map.set(line, []);
    for (const entry of lineStoppage?.stoppedLines || []) {
      map.set(entry.line, entry.workOrders);
    }
    return map;
  }, [lineStoppage]);

  const hasStoppedLines = (lineStoppage?.stoppedLines.length || 0) > 0;
  const daysWithout = lineStoppage?.daysWithoutStoppage;
  const bestStreak = lineStoppage?.bestStreakDays ?? null;
  const atOrBeatingRecord =
    daysWithout != null && bestStreak != null && daysWithout > 0 && daysWithout >= bestStreak;
  const streakMessage =
    daysWithout == null
      ? null
      : atOrBeatingRecord
        ? pickMessage(STREAK_CELEBRATE, streakMsgSeed)
        : pickMessage(STREAK_ENCOURAGE, streakMsgSeed);

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Inicio</h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Resumen operativo del mantenimiento.</p>
        </div>
        <div className="flex items-center gap-2">
          {isControlRoomRole && (
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors shadow-sm ${
                soundEnabled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
              }`}
              title="Sonido al llegar OT críticas"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              Sonido al llegar OT críticas
            </button>
          )}
          <button
            onClick={() => fetchDashboard()}
            className="p-2.5 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="Actualizar"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loadError && workOrders.length === 0 && !isLoading && (
        <div className="mb-6">
          <PageLoadError onRetry={() => void fetchDashboard()} />
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          className={`rounded-2xl border p-3 sm:p-4 shadow-sm ${
            hasStoppedLines
              ? 'border-rose-300/90 bg-rose-50/50 dark:border-rose-900/60 dark:bg-rose-950/25'
              : 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
          }`}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div
              className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                hasStoppedLines ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <Ban size={14} className="shrink-0" />
              Líneas paradas
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0">
              Correctivo / Preventivo · L1–L5
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {PRODUCTION_LINES.map((line) => {
              const stopped = (stoppedByLine.get(line)?.length || 0) > 0;
              return (
                <span
                  key={line}
                  className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-lg px-2 py-1 text-xs font-black tabular-nums ${
                    stopped
                      ? 'bg-rose-600 text-white shadow-sm animate-value-heartbeat'
                      : 'bg-white/80 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-500'
                  }`}
                  title={stopped ? `${line} detenida` : `${line} sin paro`}
                >
                  {line}
                </span>
              );
            })}
          </div>
          {hasStoppedLines ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(lineStoppage?.stoppedLines || []).flatMap((entry) =>
                entry.workOrders.map((wo) => (
                  <button
                    key={wo.id}
                    type="button"
                    onClick={() => navigate(`/dashboard?wo=${wo.id}`)}
                    className="w-full text-left rounded-xl border border-rose-200/80 bg-white px-2.5 py-2 hover:border-rose-400 transition-colors dark:border-rose-900 dark:bg-slate-900 dark:hover:border-rose-700"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          <span className="text-rose-600 dark:text-rose-400 mr-1.5">{entry.line}</span>
                          {formatWorkOrderFolio(wo.folio)} · {wo.title}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{wo.assetName}</p>
                      </div>
                      <span className="text-[9px] font-bold uppercase text-rose-600 shrink-0 mt-0.5">Paro</span>
                    </div>
                  </button>
                )),
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Ninguna línea L1–L5 detenida por correctivo o preventivo
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white via-amber-50/40 to-orange-50/50 p-3 sm:p-4 shadow-sm dark:border-amber-900/50 dark:from-slate-900 dark:via-amber-950/20 dark:to-orange-950/20">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              <Flame size={14} className="shrink-0 text-orange-500" />
              Racha sin paro
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0">
              Solo correctivo
            </span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-end gap-2 min-w-0">
              {daysWithout === null ? (
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 py-1">
                  Sin paros correctivos registrados en L1–L5
                </p>
              ) : (
                <>
                  <PulsingValue
                    value={daysWithout}
                    className={`text-4xl sm:text-5xl font-black leading-none tabular-nums ${
                      atOrBeatingRecord
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  />
                  <span className="pb-1 text-sm font-bold text-slate-500 dark:text-slate-400">
                    día{daysWithout === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </div>
            {bestStreak != null && bestStreak > 0 && (
              <div
                className="shrink-0 text-right rounded-xl border border-amber-200/80 bg-white/70 px-2.5 py-1.5 dark:border-amber-900/50 dark:bg-slate-900/50"
                title="Mayor racha histórica (días entre paros correctivos L1–L5)"
              >
                <div className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  <Trophy size={11} className="shrink-0" />
                  Récord
                </div>
                <p className="text-lg font-black leading-none text-slate-800 dark:text-slate-100 tabular-nums mt-0.5">
                  {bestStreak}
                  <span className="ml-0.5 text-[10px] font-bold text-slate-500">d</span>
                </p>
              </div>
            )}
          </div>
          {streakMessage && (
            <p
              key={streakMsgSeed}
              className={`mt-2 text-xs font-medium leading-snug ${
                atOrBeatingRecord
                  ? 'text-amber-800 dark:text-amber-200'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {streakMessage}
            </p>
          )}
          {lineStoppage?.lastStoppage && (
            <button
              type="button"
              onClick={() => navigate(`/dashboard?wo=${lineStoppage.lastStoppage!.id}`)}
              className="mt-2.5 w-full text-left rounded-xl border border-amber-200/70 bg-white/70 px-2.5 py-2 hover:border-amber-400 transition-colors dark:border-amber-900/60 dark:bg-slate-900/60"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                {hasStoppedLines || daysWithout === 0 ? 'Último / actual' : 'Último paro'}
              </p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                {lineStoppage.lastStoppage.line} · {formatWorkOrderFolio(lineStoppage.lastStoppage.folio)} ·{' '}
                {lineStoppage.lastStoppage.title}
              </p>
              <p className="text-[10px] text-slate-500 truncate">
                {lineStoppage.lastStoppage.assetName}
                {' · '}
                {new Date(lineStoppage.lastStoppage.created_at).toLocaleDateString('es-MX', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </button>
          )}
        </div>
      </section>

      {(inventorySummary?.low_stock_count ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => navigate('/inventory?filter=low_stock')}
          className="mb-4 w-full text-left rounded-2xl border border-orange-200/90 bg-gradient-to-br from-white via-orange-50/60 to-orange-100/30 p-3 sm:p-4 shadow-sm transition hover:border-orange-300 dark:border-orange-900/50 dark:from-slate-900 dark:via-orange-950/25 dark:to-orange-950/15"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
                <Package size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">
                  Stock bajo
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {inventorySummary!.low_stock_count} artículo
                  {inventorySummary!.low_stock_count === 1 ? '' : 's'} al mínimo o inferior
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {hasPermission('MANAGE_PURCHASES')
                    ? 'Toca para verlos en Inventario y generar borradores de OC'
                    : 'Toca para verlos en Inventario'}
                </p>
              </div>
            </div>
            {hasPermission('MANAGE_PURCHASES') && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-white">
                <ShoppingCart size={14} /> OC
              </span>
            )}
          </div>
        </button>
      )}

      <button
        type="button"
        onClick={() => navigate('/notes')}
        className="mb-6 w-full text-left rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white via-amber-50/50 to-orange-50/40 p-3 sm:p-4 shadow-sm transition hover:border-amber-300 dark:border-amber-900/50 dark:from-slate-900 dark:via-amber-950/20 dark:to-orange-950/15"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <StickyNote size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Notas y pendientes
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {notesSummary
                  ? `${notesSummary.open_total} abierto${notesSummary.open_total === 1 ? '' : 's'} · ${notesSummary.open_notes} nota${notesSummary.open_notes === 1 ? '' : 's'} · ${notesSummary.open_tasks_assigned} asignado${notesSummary.open_tasks_assigned === 1 ? '' : 's'} a ti${
                      notesSummary.unread_announcements
                        ? ` · ${notesSummary.unread_announcements} aviso${notesSummary.unread_announcements === 1 ? '' : 's'}`
                        : ''
                    }`
                  : 'Abre tus notas, pendientes y avisos globales'}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-black tabular-nums text-white">
            {notesSummary?.open_total ?? '—'}
          </span>
        </div>
      </button>

      {isControlRoomRole && (
        <section className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/40 p-3 sm:p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            <Siren size={14} />
            Sala de control · atención inmediata
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => goControlRoom('priority=URGENTE')}
              className="rounded-xl border border-rose-200 bg-white p-3 text-left shadow-sm transition hover:border-rose-400 dark:border-rose-900 dark:bg-slate-900"
            >
              <p className="text-[11px] font-semibold uppercase text-rose-600">Urgentes abiertas</p>
              <PulsingValue value={controlCounts.urgentOpen} className="mt-1 text-2xl font-black text-slate-900 dark:text-white" />
            </button>
            <button
              type="button"
              onClick={() => goControlRoom('unassigned=1')}
              className="rounded-xl border border-amber-200 bg-white p-3 text-left shadow-sm transition hover:border-amber-400 dark:border-amber-900 dark:bg-slate-900"
            >
              <p className="text-[11px] font-semibold uppercase text-amber-700 flex items-center gap-1">
                <UserX size={12} /> Sin asignar
              </p>
              <PulsingValue value={controlCounts.unassigned} className="mt-1 text-2xl font-black text-slate-900 dark:text-white" />
            </button>
            {slaEnabled && (
              <>
                <button
                  type="button"
                  onClick={() => goControlRoom('sla=RISK')}
                  className="rounded-xl border border-orange-200 bg-white p-3 text-left shadow-sm transition hover:border-orange-400 dark:border-orange-900 dark:bg-slate-900"
                >
                  <p className="text-[11px] font-semibold uppercase text-orange-700 flex items-center gap-1">
                    <ShieldAlert size={12} /> SLA en riesgo
                  </p>
                  <PulsingValue value={controlCounts.slaRisk} className="mt-1 text-2xl font-black text-slate-900 dark:text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => goControlRoom('sla=BREACHED')}
                  className="rounded-xl border border-rose-300 bg-white p-3 text-left shadow-sm transition hover:border-rose-500 dark:border-rose-800 dark:bg-slate-900"
                >
                  <p className="text-[11px] font-semibold uppercase text-rose-800">SLA vencido</p>
                  <PulsingValue value={controlCounts.slaBreached} className="mt-1 text-2xl font-black text-slate-900 dark:text-white" />
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {shiftByTech.length > 0 && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <Users size={14} className="text-sky-600 shrink-0" />
              Turno actual
            </div>
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0">
              {shiftByTech.length} téc. con OT
            </span>
          </div>
          <div className="overflow-x-auto max-h-72 sm:max-h-none rounded-lg border border-slate-100 dark:border-slate-800 sm:border-0">
            <table className="w-full min-w-0 table-fixed text-[11px] sm:text-sm leading-tight">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 sm:bg-transparent dark:sm:bg-transparent">
                <tr className="text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-1.5 pl-1.5 pr-1 sm:pb-2 sm:pr-2 font-semibold text-left w-[36%]" title="Técnico">Técnico</th>
                  <th className="py-1.5 px-0.5 sm:pb-2 sm:px-1 font-semibold text-center w-[12%]" title="Pendientes">Pend</th>
                  <th className="py-1.5 px-0.5 sm:pb-2 sm:px-1 font-semibold text-center w-[12%]" title="En proceso">Proc</th>
                  <th className="py-1.5 px-0.5 sm:pb-2 sm:px-1 font-semibold text-center w-[12%]" title="En espera">Esp</th>
                  {slaEnabled && (
                    <th className="py-1.5 pl-0.5 pr-1.5 sm:pb-2 sm:pl-1 font-semibold text-right w-[28%]" title="SLA">SLA</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shiftByTech.map((row) => (
                  <tr
                    key={row.id || row.name}
                    onClick={goToShiftRow}
                    className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-sky-50/70 dark:border-slate-800 dark:hover:bg-sky-950/30 transition-colors active:bg-sky-50 dark:active:bg-sky-950/40"
                  >
                    <td className="py-1.5 sm:py-2 pl-1.5 pr-1 sm:pr-2">
                      <div className="truncate font-semibold text-slate-800 dark:text-slate-100" title={row.name}>
                        {row.name}
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-medium text-slate-400 tabular-nums">{row.total} OT</div>
                    </td>
                    <td className="py-1.5 sm:py-2 px-0.5 sm:px-1 text-center tabular-nums">
                      <span className={row.pendientes ? 'font-bold text-amber-600' : 'text-slate-300'}>{row.pendientes}</span>
                    </td>
                    <td className="py-1.5 sm:py-2 px-0.5 sm:px-1 text-center tabular-nums">
                      <span className={row.enProceso ? 'font-bold text-sky-600' : 'text-slate-300'}>{row.enProceso}</span>
                    </td>
                    <td className="py-1.5 sm:py-2 px-0.5 sm:px-1 text-center tabular-nums">
                      <span className={row.enEspera ? 'font-bold text-violet-600' : 'text-slate-300'}>{row.enEspera}</span>
                    </td>
                    {slaEnabled && (
                      <td className="py-1.5 sm:py-2 pl-0.5 pr-1.5 sm:pl-1 text-right">
                        {(row.slaRisk > 0 || row.slaBreached > 0) ? (
                          <span className="inline-flex flex-wrap justify-end gap-0.5">
                            {row.slaRisk > 0 && (
                              <span
                                className="rounded bg-orange-100 px-1 py-0.5 text-[9px] sm:text-[10px] font-bold text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
                                title={`${row.slaRisk} en riesgo`}
                              >
                                {row.slaRisk}R
                              </span>
                            )}
                            {row.slaBreached > 0 && (
                              <span
                                className="rounded bg-rose-100 px-1 py-0.5 text-[9px] sm:text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                                title={`${row.slaBreached} vencidas`}
                              >
                                {row.slaBreached}V
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {paretoData.length > 0 && (
        <div className="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-orange-600" />
            Top Problemas Frecuentes (Correctivo)
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paretoData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#f97316" fontSize={12} tickLine={false} axisLine={false} tickFormatter={value => `${value}%`} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => [name === 'PorcentajeAcumulado' ? `${Number(value).toFixed(1)}%` : value, name === 'PorcentajeAcumulado' ? '% Acumulado' : name]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Frecuencia" barSize={40} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="PorcentajeAcumulado" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <FilterScopeFrame
        title="Resumen por periodo"
        icon={CalendarClock}
        tone="blue"
        hint="El periodo seleccionado se aplica a todas las tarjetas y a la distribución de mantenimiento dentro de este marco."
        toolbar={
          <>
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Filtro para resumen superior:</span>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              Desde:
              <input type="date" value={summaryStartDate} onChange={e => setSummaryStartDate(e.target.value)} className="text-sm px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              Hasta:
              <input type="date" value={summaryEndDate} onChange={e => setSummaryEndDate(e.target.value)} className="text-sm px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
            </label>
            {summaryStartDate || summaryEndDate ? (
              <button type="button" onClick={() => { setSummaryStartDate(''); setSummaryEndDate(''); }} className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1 bg-rose-50 rounded-lg">
                Limpiar filtro
              </button>
            ) : (
              <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200 flex items-center gap-1.5">
                <Activity size={14} /> Modo Histórico (Viendo Todo)
              </span>
            )}
          </>
        }
      >

      <div className="flex flex-col xl:flex-row gap-4 mb-6 sm:mb-8">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-6 gap-3 sm:gap-4">
          <SummaryCard title="Total recibidas" value={totalRecibidas} icon={<LayoutDashboard />} color="slate" emphasized hint="Sin contar invalidadas" detail={(summaryStartDate && summaryEndDate) ? `${summaryStartDate} — ${summaryEndDate}` : 'Histórico completo'} onClick={() => navigate('/dashboard?tab=all')} />
          <SummaryCard title="Pendientes" value={summary.PENDIENTE || 0} icon={<Clock />} color="amber" onClick={() => goToStatus('PENDIENTE')} detail={
            <div className="flex flex-wrap gap-1">
              {urgentCount > 0 && <span className="bg-rose-600 text-white px-1.5 py-0.5 rounded-sm">{urgentCount} URG</span>}
              {normalCount > 0 && <span className="bg-amber-700 text-white px-1.5 py-0.5 rounded-sm">{normalCount} NOR</span>}
              {lowCount > 0 && <span className="bg-emerald-700 text-white px-1.5 py-0.5 rounded-sm">{lowCount} BAJ</span>}
            </div>
          } />
          <SummaryCard title="En Proceso" value={summary.EN_PROCESO || 0} icon={<Wrench />} color="blue" onClick={() => goToStatus('EN_PROCESO')} detail={activeTechsText && `👤 ${activeTechsText}`} />
          <SummaryCard title="Pausadas" value={summary.EN_ESPERA || 0} icon={<AlertCircle />} color="purple" onClick={() => goToStatus('EN_ESPERA')} detail={pausedTechsText && `👤 ${pausedTechsText}`} />
          <SummaryCard title="Finalizadas" value={summary.FINALIZADO || 0} icon={<CheckCircle2 />} color="emerald" onClick={() => goToStatus('FINALIZADO')} />
          <SummaryCard title="Invalidadas" value={summary.ANULADO || 0} icon={<XCircle />} color="gray" onClick={() => goToStatus('ANULADO')} />
        </div>

        <div className="relative w-full xl:w-80 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-emerald-50/60 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950/30 p-5 shadow-sm">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-200/30 blur-2xl dark:bg-emerald-500/10" />
          <div className="relative">
            <div className="mb-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Distribución de mantenimiento</h3>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Proporción por tipo de orden</p>
            </div>
          {pieData.length > 0 ? (
            <div className="relative mx-auto h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={49}
                    outerRadius={68}
                    paddingAngle={4}
                    cornerRadius={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, _name: any, item: any) => [
                      `${value} orden${Number(value) === 1 ? '' : 'es'}`,
                      item.payload.name,
                    ]}
                    wrapperStyle={{ zIndex: 20 }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-fg)', boxShadow: '0 8px 20px rgb(15 23 42 / 0.12)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black leading-none text-slate-800 dark:text-white">{maintenanceTotal}</span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Órdenes</span>
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-slate-400">Sin datos para el periodo</div>
          )}
          <div className="space-y-2.5">
            {pieData.map(entry => {
              const percentage = maintenanceTotal ? Math.round((entry.value / maintenanceTotal) * 100) : 0;
              return (
              <div key={entry.name}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{entry.name}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {entry.value} <span className="font-medium text-slate-400">· {percentage}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%`, backgroundColor: entry.color }}
                  />
                </div>
              </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>
      </FilterScopeFrame>

      {/* Resumen semanal de finalizadas (Lunes → Domingo) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              Órdenes finalizadas esta semana
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Semana actual: {formatWeekDate(weekStart)} — {formatWeekDate(weekEnd)} (Lunes a Domingo)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total</span>
              <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 leading-none mt-0.5">
                {finishedThisWeek.length}
              </div>
            </div>
            <button
              type="button"
              onClick={() => goToStatus('FINALIZADO')}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-200 transition-colors"
            >
              Ver historial
            </button>
          </div>
        </div>

        <div className="h-48 w-full mb-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyBarData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-fg)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [value, 'Finalizadas']}
              />
              <Bar dataKey="Finalizadas" fill="#10b981" radius={[6, 6, 0, 0]} barSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {finishedThisWeek.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4 border-t border-slate-100 dark:border-slate-700">
            Aún no hay órdenes finalizadas en esta semana.
          </p>
        ) : (
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2 max-h-64 overflow-y-auto">
            {finishedThisWeek.slice(0, 12).map(wo => (
              <button
                key={wo.id}
                type="button"
                onClick={() => navigate(`/dashboard?wo=${wo.id}`)}
                className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    <span className="text-emerald-700 dark:text-emerald-400 mr-2">
                      {formatWorkOrderFolio(wo.folio)}
                    </span>
                    {wo.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {wo.asset?.name || 'Sin equipo'}
                    {wo.zone?.name ? ` · ${wo.zone.name}` : ''}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {new Date(wo.completed_at || wo.updated_at).toLocaleDateString('es-MX', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </button>
            ))}
            {finishedThisWeek.length > 12 && (
              <p className="text-xs text-center text-slate-400 pt-1">
                +{finishedThisWeek.length - 12} más esta semana
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
};

const cardColors: Record<string, string> = {
  slate: 'bg-slate-900 text-white border-slate-900',
  amber: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-transparent shadow-[0_0_15px_rgba(245,158,11,0.5)]',
  blue: 'bg-white dark:bg-slate-800 text-blue-600 border-blue-100',
  purple: 'bg-white dark:bg-slate-800 text-purple-600 border-purple-100',
  emerald: 'bg-white dark:bg-slate-800 text-emerald-600 border-emerald-100',
  gray: 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200',
};

/** One gentle scale pulse when a numeric value changes (skips first mount). */
const PulsingValue = ({ value, className }: { value?: number | undefined; className?: string }) => {
  const [pulse, setPulse] = useState(false);
  const mountedRef = useRef(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = value;
      return;
    }
    if (prevRef.current === value) return;
    prevRef.current = value;
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 500);
    return () => window.clearTimeout(t);
  }, [value]);

  return (
    <span className={`inline-block origin-left ${className || ''} ${pulse ? 'animate-value-heartbeat' : ''}`}>
      {value}
    </span>
  );
};

const SummaryCard = ({ title, value, icon, color, onClick, detail, hint, emphasized = false }: {
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  onClick?: () => void;
  detail?: ReactNode;
  hint?: string;
  emphasized?: boolean;
}) => {
  const className = `text-left p-3.5 sm:p-4 rounded-2xl border flex flex-col relative overflow-hidden group shadow-sm min-h-[130px] ${onClick ? 'cursor-pointer transition-all hover:scale-[1.03]' : 'cursor-default'} ${cardColors[color]}`;
  const content = (
    <>
    <div className="absolute -right-2 -top-2 opacity-20 group-hover:scale-110 transition-transform [&>svg]:w-20 [&>svg]:h-20">{icon}</div>
    <div className="relative z-10 h-full flex flex-col">
      <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider leading-tight h-8">{title}</span>
      <PulsingValue
        value={value}
        className={`${emphasized ? 'text-3xl sm:text-[2.75rem]' : 'text-2xl sm:text-4xl'} font-black ${color === 'slate' || color === 'amber' ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}
      />
      {hint && <span className="text-[9px] sm:text-[10px] font-medium opacity-70 leading-tight mt-0.5">{hint}</span>}
      {detail && <div className="mt-auto pt-2 text-[10px] font-semibold leading-tight line-clamp-2">{detail}</div>}
    </div>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>{content}</button>
  ) : (
    <div className={className}>{content}</div>
  );
};
