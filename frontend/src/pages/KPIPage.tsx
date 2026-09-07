import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getKPIs,
  updateKPIGoals,
  getChartData,
  getCostsByAsset,
  getTopFailingAssets,
  getAssetFailureOrders,
  getTechnicianPerformance,
} from '../api/kpis';
import type {
  KPIResponse,
  KPIMetric,
  ChartData,
  AssetCostData,
  TopFailingAsset,
  FailureOrder,
  TechnicianPerformance,
} from '../api/kpis';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import {
  Target,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Database,
  Settings,
  Download,
  X,
  RefreshCw,
  Users,
  Wrench,
  Activity,
  Package,
  PauseCircle,
  Timer,
  CalendarCheck,
  CalendarClock,
  Filter,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatWorkOrderFolio } from '../utils/folio';
import { downloadWorkbook, excelDateStamp } from '../utils/excelExport';
import { formatCurrency, formatCurrencyAxis } from '../utils/currency';
import {
  PeriodRangeFilter,
  firstDayOfMonthYmd,
  todayYmd,
} from '../components/common/PeriodRangeFilter';
import { FilterScopeFrame } from '../components/common/FilterScopeFrame';
import { SearchableSelect } from '../components/ui/SearchableSelect';

type MetricStatus = 'good' | 'warn' | 'bad' | 'neutral';

const PERIOD_OPTIONS = [
  { value: 'THIS_WEEK', label: 'Esta semana' },
  { value: 'LAST_WEEK', label: 'Semana pasada' },
  { value: 'THIS_MONTH', label: 'Este mes' },
  { value: 'LAST_MONTH', label: 'Mes pasado' },
  { value: 'THIS_YEAR', label: 'Este año' },
  { value: 'LAST_12_MONTHS', label: 'Últimos 12 meses' },
  { value: 'CUSTOM', label: 'Periodo personalizado…' },
  { value: 'ALL', label: 'Histórico' },
];

const REWORK_DAY_PRESETS = [3, 7, 14, 30];
const DEFAULT_REWORK_DAYS = 7;

const GOAL_LABELS: Record<string, { label: string; unit: string; hint: string }> = {
  COMPLETED_MONTHLY: { label: 'OT finalizadas', unit: 'órdenes', hint: 'Meta de órdenes cerradas en el periodo' },
  MTTR: { label: 'MTTR', unit: 'horas', hint: 'Tiempo medio de reparación correctiva' },
  RESPONSE_TIME: { label: 'Tiempo de respuesta', unit: 'horas', hint: 'Desde creación hasta inicio de trabajo' },
  SLA: { label: 'Cumplimiento MTTR', unit: '%', hint: '% de correctivas bajo la meta de MTTR' },
  BACKLOG: { label: 'Backlog', unit: 'órdenes', hint: 'Órdenes abiertas (pendiente, proceso, espera)' },
  ASSET_AVAILABILITY: { label: 'Disponibilidad', unit: '%', hint: 'Tiempo productivo menos paros con máquina detenida' },
  REINCIDENCIA: { label: 'Retrabajo', unit: '%', hint: 'Correctivas con falla previa dentro de la ventana definida' },
};

const getStatus = (metric: KPIMetric, moreIsBetter: boolean): MetricStatus => {
  if (metric.isNull || metric.sampleSize === 0) return 'neutral';
  const { value, goal } = metric;
  const target = goal.targetValue;
  if (moreIsBetter) {
    if (value >= target) return 'good';
    if (value >= target * 0.85) return 'warn';
    return 'bad';
  }
  if (value <= target) return 'good';
  if (value <= target * 1.15) return 'warn';
  return 'bad';
};

const statusStyles: Record<MetricStatus, { card: string; value: string; chip: string; bar: string; label: string }> = {
  good: {
    card: 'border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-slate-900',
    value: 'text-emerald-700 dark:text-emerald-400',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
    bar: 'bg-emerald-500',
    label: 'En meta',
  },
  warn: {
    card: 'border-amber-200 bg-white dark:border-amber-900/50 dark:bg-slate-900',
    value: 'text-amber-700 dark:text-amber-400',
    chip: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
    bar: 'bg-amber-500',
    label: 'Cerca de meta',
  },
  bad: {
    card: 'border-rose-200 bg-white dark:border-rose-900/50 dark:bg-slate-900',
    value: 'text-rose-700 dark:text-rose-400',
    chip: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50',
    bar: 'bg-rose-500',
    label: 'Fuera de meta',
  },
  neutral: {
    card: 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
    value: 'text-slate-700 dark:text-slate-300',
    chip: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    bar: 'bg-slate-400',
    label: 'Sin muestra',
  },
};

const panelClass = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-5 shadow-sm';

const formatHours = (hours: number): string => {
  if (!Number.isFinite(hours) || hours <= 0) return '0 h';
  return `${hours.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`;
};

/** Versión corta para tablas densas (ej. 1,5h). */
const formatHoursCompact = (hours: number): string => {
  if (!Number.isFinite(hours) || hours <= 0) return '0h';
  return `${hours.toLocaleString('es-MX', { maximumFractionDigits: 1 })}h`;
};

const progressPct = (metric: KPIMetric, moreIsBetter: boolean) => {
  if (!metric.goal.targetValue) return 0;
  if (moreIsBetter) return Math.min(100, (metric.value / metric.goal.targetValue) * 100);
  if (metric.value <= 0) return 100;
  return Math.min(100, (metric.goal.targetValue / Math.max(metric.value, 0.0001)) * 100);
};

export const KPIPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [data, setData] = useState<KPIResponse | null>(null);
  const [compareData, setCompareData] = useState<KPIResponse | null>(null);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [assetCosts, setAssetCosts] = useState<AssetCostData[]>([]);
  const [topFailingAssets, setTopFailingAssets] = useState<TopFailingAsset[]>([]);
  const [techPerformance, setTechPerformance] = useState<TechnicianPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [period, setPeriod] = useState('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState(firstDayOfMonthYmd);
  const [customEndDate, setCustomEndDate] = useState(todayYmd);
  const [reworkDays, setReworkDays] = useState(DEFAULT_REWORK_DAYS);
  const [reworkDaysInput, setReworkDaysInput] = useState(String(DEFAULT_REWORK_DAYS));
  const [loadError, setLoadError] = useState(false);

  const [selectedFailureAsset, setSelectedFailureAsset] = useState<{ id: string; name: string } | null>(null);
  const [failureOrders, setFailureOrders] = useState<FailureOrder[]>([]);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [goalsForm, setGoalsForm] = useState<Record<string, number>>({});

  const periodQuery = {
    period,
    startDate: period === 'CUSTOM' ? customStartDate : undefined,
    endDate: period === 'CUSTOM' ? customEndDate : undefined,
    reworkDays,
  };

  const fetchData = async (background = false) => {
    if (period === 'CUSTOM' && (!customStartDate || !customEndDate)) {
      if (!background) setIsLoading(false);
      return;
    }
    try {
      if (!background) {
        setIsLoading(true);
        setLoadError(false);
      }
      const [kpiData, chartData, costData, topFailingData, techData] = await Promise.all([
        getKPIs(periodQuery),
        getChartData(periodQuery).catch(() => []),
        getCostsByAsset(periodQuery).catch(() => []),
        getTopFailingAssets(periodQuery).catch(() => []),
        getTechnicianPerformance(periodQuery).catch(() => []),
      ]);
      setData(kpiData);

      if (period === 'THIS_WEEK') {
        try {
          setCompareData(await getKPIs({ period: 'LAST_WEEK', reworkDays }));
        } catch {
          setCompareData(null);
        }
      } else {
        setCompareData(null);
      }

      if (kpiData.reworkWindowDays) {
        setReworkDays(kpiData.reworkWindowDays);
        setReworkDaysInput(String(kpiData.reworkWindowDays));
      }
      setCharts(chartData);
      setAssetCosts(costData);
      setTopFailingAssets(topFailingData);
      setTechPerformance(techData);

      const formState: Record<string, number> = {};
      Object.entries(kpiData.metrics).forEach(([key, metric]) => {
        formState[key] = metric.goal.targetValue;
      });
      setGoalsForm(formState);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      if (!background) {
        setLoadError(true);
        setData(null);
        setCompareData(null);
      }
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, reworkDays, customStartDate, customEndDate]);

  useSocketRefresh(['refresh_work_orders', 'refresh_inventory'], () => { void fetchData(true); });

  const applyReworkDays = (value: number) => {
    const clamped = Math.min(90, Math.max(1, Math.round(value) || DEFAULT_REWORK_DAYS));
    setReworkDays(clamped);
    setReworkDaysInput(String(clamped));
  };

  useEffect(() => {
    if (!selectedFailureAsset) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedFailureAsset(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFailureAsset]);

  const handleSaveGoals = async () => {
    try {
      setIsLoading(true);
      const updated = Object.entries(goalsForm).map(([key, value]) => ({
        metricKey: key,
        targetValue: value,
        unit: GOAL_LABELS[key]?.unit || 'auto',
      }));
      await updateKPIGoals(updated);
      setIsEditing(false);
      await fetchData();
    } catch (error) {
      console.error(error);
      alert('Error al guardar las metas');
      setIsLoading(false);
    }
  };

  const handleAssetClick = async (assetId: string, assetName: string) => {
    setSelectedFailureAsset({ id: assetId, name: assetName });
    setIsFetchingOrders(true);
    try {
      setFailureOrders(await getAssetFailureOrders(assetId, periodQuery));
    } catch (error) {
      console.error(error);
      alert('Error al obtener el detalle de fallas');
    } finally {
      setIsFetchingOrders(false);
    }
  };

  const formatPeriodLabel = () => {
    if (!data?.period) return PERIOD_OPTIONS.find((p) => p.value === period)?.label || period;
    const start = new Date(data.period.start).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const end = new Date(data.period.end).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${start} — ${end}`;
  };

  const handleExportExcel = () => {
    if (!data) {
      alert('No hay datos de KPIs para exportar. Espera a que cargue el periodo.');
      return;
    }
    const periodLabel = formatPeriodLabel();
    const resumenRows = Object.entries(data.metrics).map(([key, metric]) => {
      const meta = GOAL_LABELS[key];
      return {
        Indicador: meta?.label || key,
        Valor: metric.isNull ? '' : metric.value,
        Meta: metric.goal.targetValue,
        Unidad: meta?.unit || metric.goal.unit || '',
        Muestra: metric.sampleSize ?? '',
        Periodo: periodLabel,
        'OT relevantes': data.totalOrders,
      };
    });
    const ordenesRows = topFailingAssets.map((a) => ({
      Equipo: a.assetName,
      Fallas: a.count,
      Periodo: periodLabel,
    }));
    const costosRows = assetCosts.map((a) => ({
      Equipo: a.assetName,
      'Costo total': a.totalCost,
      Periodo: periodLabel,
    }));
    const tecnicosRows = techPerformance.map((t) => ({
      Técnico: t.name,
      Finalizadas: t.Finalizadas,
      'Horas labor periodo': t.HorasLaborPeriodo ?? 0,
      'Tiempo promedio (h)': t.TiempoPromedioHoras ?? 0,
      'En proceso': t.EnProceso,
      Pendientes: t.Pendientes,
      Pausadas: t.Pausadas,
      Total: t.Total,
      'Carga hoy': t.CargaHoy,
      'Tiempo espera (h)': t.TiempoEsperaHoras,
      'Finalizadas semana': t.FinalizadasSemana,
      'Horas labor semana': t.HorasLaborSemana,
    }));
    const chartsRows = charts.map((c) => ({
      Mes: c.month,
      Costos: c.costos,
      MTTR: c.mttr,
      MTBF: c.mtbf,
      'Muestra MTBF': c.mtbfSample ?? '',
    }));

    downloadWorkbook(`kpis_${excelDateStamp()}.xlsx`, [
      { name: 'Resumen', rows: resumenRows },
      { name: 'Top fallas', rows: ordenesRows },
      { name: 'Costos por equipo', rows: costosRows },
      { name: 'Tecnicos', rows: tecnicosRows },
      { name: 'Tendencia', rows: chartsRows },
    ]);
  };

  const techDashSummary = {
    cargaHoy: techPerformance.reduce((s, r) => s + (r.CargaHoy ?? 0), 0),
    pausadas: techPerformance.reduce((s, r) => s + (r.Pausadas ?? 0), 0),
    tiempoEspera: techPerformance.reduce((s, r) => s + (r.TiempoEsperaHoras ?? 0), 0),
    finalizadasSemana: techPerformance.reduce((s, r) => s + (r.FinalizadasSemana ?? 0), 0),
    horasLaborSemana: techPerformance.reduce((s, r) => s + (r.HorasLaborSemana ?? 0), 0),
  };

  const techWeeklyChart = [...techPerformance]
    .filter((r) => (r.FinalizadasSemana ?? 0) > 0 || (r.HorasLaborSemana ?? 0) > 0)
    .sort((a, b) => (b.FinalizadasSemana ?? 0) - (a.FinalizadasSemana ?? 0))
    .slice(0, 8)
    .map((r) => ({
      name: r.name.split(' ')[0] || r.name,
      fullName: r.name,
      finalizadas: r.FinalizadasSemana ?? 0,
      horas: r.HorasLaborSemana ?? 0,
    }));

  const techPeriodCompletedChart = [...techPerformance]
    .filter((r) => (r.Finalizadas ?? 0) > 0)
    .sort((a, b) => (b.Finalizadas ?? 0) - (a.Finalizadas ?? 0))
    .slice(0, 12)
    .map((r) => ({
      name: r.name.length > 18 ? `${r.name.slice(0, 18)}…` : r.name,
      fullName: r.name,
      finalizadas: r.Finalizadas ?? 0,
    }));

  const techPeriodAvgTimeChart = [...techPerformance]
    .filter((r) => (r.Finalizadas ?? 0) > 0 && (r.TiempoPromedioHoras ?? 0) > 0)
    .sort((a, b) => (a.TiempoPromedioHoras ?? 0) - (b.TiempoPromedioHoras ?? 0))
    .slice(0, 12)
    .map((r) => ({
      name: r.name.length > 18 ? `${r.name.slice(0, 18)}…` : r.name,
      fullName: r.name,
      promedio: r.TiempoPromedioHoras ?? 0,
      finalizadas: r.Finalizadas ?? 0,
    }));

  const renderKpiCard = (
    title: string,
    icon: ReactNode,
    metric: KPIMetric,
    moreIsBetter: boolean,
    formatter: (val: number) => string,
    unit: string,
    tooltip: string,
    onClick?: () => void,
    hero = false,
  ) => {
    const status = getStatus(metric, moreIsBetter);
    const styles = statusStyles[status];
    const pct = progressPct(metric, moreIsBetter);

    return (
      <button
        type="button"
        title={tooltip}
        onClick={onClick}
        className={`text-left rounded-2xl border p-4 sm:p-5 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600 ${styles.card} ${hero ? 'min-h-[150px]' : ''} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
            <div className={`mt-1 flex items-baseline gap-1.5 ${styles.value}`}>
              <span className={`font-black ${hero ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                {metric.isNull || (metric.sampleSize === 0 && metric.value === 0 && title !== 'Backlog' && title !== 'OT finalizadas')
                  ? '—'
                  : formatter(metric.value)}
              </span>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{unit}</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-400">{icon}</div>
        </div>

        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className={`h-full rounded-full transition-all ${styles.bar}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-500 dark:text-slate-400">
            Meta: {formatter(metric.goal.targetValue)} {unit}
          </span>
          <span className={`rounded-full border px-2 py-0.5 font-bold ${styles.chip}`}>{styles.label}</span>
        </div>
        {typeof metric.sampleSize === 'number' && (
          <p className="mt-2 text-[11px] text-slate-400">{metric.sampleSize} muestra{metric.sampleSize === 1 ? '' : 's'}</p>
        )}
      </button>
    );
  };

  if (isLoading && !data) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando indicadores...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="hidden print:flex justify-between items-end border-b-2 border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Reporte de Indicadores</h1>
          <p className="text-slate-500 mt-1">GTZ CMMS — Mantenimiento</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p className="font-bold">Generado:</p>
          <p>{new Date().toLocaleString('es-MX')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Indicadores de mantenimiento</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Periodo activo: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatPeriodLabel()}</span>
            {data ? ` · ${data.totalOrders} registros relevantes` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            title="Exportar periodo a Excel (.xlsx)"
          >
            <Download size={16} />
            Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Imprimir / PDF"
          >
            <Download size={16} />
            Imprimir
          </button>
          {hasPermission('MANAGE_KPIS') && (
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Settings size={16} />
              Metas
            </button>
          )}
        </div>
      </div>

      {isEditing && data && (
        <div className={`${panelClass} print:hidden`}>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Configurar metas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.keys(goalsForm).map((key) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {GOAL_LABELS[key]?.label || key}
                  <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">({GOAL_LABELS[key]?.unit})</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  value={goalsForm[key]}
                  onChange={(e) => setGoalsForm({ ...goalsForm, [key]: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-slate-400">{GOAL_LABELS[key]?.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button type="button" onClick={handleSaveGoals} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Guardar metas
            </button>
          </div>
        </div>
      )}

      <FilterScopeFrame
        title="Indicadores por periodo"
        icon={CalendarClock}
        tone="blue"
        className="print:border-0 print:bg-transparent print:p-0"
        hint="El periodo elegido aplica a tarjetas, gráficos, costos, fallas, finalizadas por técnico y retrabajo dentro de este marco."
        toolbar={
          <>
            <Filter size={16} className="text-slate-400 shrink-0" />
            <label className="sr-only" htmlFor="kpi-period">Periodo</label>
            <SearchableSelect
              id="kpi-period"
              value={period}
              onChange={(next) => {
                setPeriod(next);
                if (next === 'CUSTOM') {
                  if (!customStartDate) setCustomStartDate(firstDayOfMonthYmd());
                  if (!customEndDate) setCustomEndDate(todayYmd());
                }
              }}
              options={PERIOD_OPTIONS}
              placeholder="Buscar…"
              inputClassName="px-3 py-2 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {period === 'CUSTOM' && (
              <PeriodRangeFilter
                startDate={customStartDate}
                endDate={customEndDate}
                onStartChange={setCustomStartDate}
                onEndChange={setCustomEndDate}
                size="sm"
              />
            )}
            <button
              type="button"
              onClick={() => fetchData()}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 ml-auto"
              title="Actualizar"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </>
        }
      >

      {period === 'THIS_WEEK' && data && compareData && (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-3 dark:border-sky-900/50 dark:bg-sky-950/20 print:hidden">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Esta semana vs semana pasada
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {([
              {
                key: 'orders',
                label: 'Órdenes',
                current: data.totalOrders,
                previous: compareData.totalOrders,
                format: (v: number) => String(v),
                invert: false,
              },
              {
                key: 'completed',
                label: 'Finalizadas',
                current: data.metrics.COMPLETED_MONTHLY.value,
                previous: compareData.metrics.COMPLETED_MONTHLY.value,
                format: (v: number) => String(Math.round(v)),
                invert: false,
              },
              {
                key: 'mttr',
                label: 'MTTR',
                current: data.metrics.MTTR.value,
                previous: compareData.metrics.MTTR.value,
                format: (v: number) => formatHours(v),
                invert: true,
              },
              {
                key: 'sla',
                label: 'SLA',
                current: data.metrics.SLA.value,
                previous: compareData.metrics.SLA.value,
                format: (v: number) => `${v.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`,
                invert: false,
              },
              {
                key: 'backlog',
                label: 'Backlog',
                current: data.metrics.BACKLOG.value,
                previous: compareData.metrics.BACKLOG.value,
                format: (v: number) => String(Math.round(v)),
                invert: true,
              },
            ] as const).map((item) => {
              const delta = item.current - item.previous;
              const better = item.invert ? delta < 0 : delta > 0;
              const worse = item.invert ? delta > 0 : delta < 0;
              const deltaAbs = Math.abs(delta);
              const deltaLabel =
                item.key === 'mttr'
                  ? formatHours(deltaAbs)
                  : item.key === 'sla'
                    ? `${deltaAbs.toLocaleString('es-MX', { maximumFractionDigits: 1 })} pp`
                    : String(Math.round(deltaAbs));
              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-white/80 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-0.5 text-base font-black tabular-nums text-slate-800 dark:text-slate-100">
                    {item.format(item.current)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    ant. {item.format(item.previous)}
                    {delta !== 0 && (
                      <span
                        className={`ml-1.5 font-bold ${
                          better ? 'text-emerald-600' : worse ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        {delta > 0 ? '↑' : '↓'} {deltaLabel}
                      </span>
                    )}
                    {delta === 0 && <span className="ml-1.5 font-medium text-slate-400">=</span>}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-6 text-center">
          <AlertTriangle className="mx-auto text-amber-500 mb-2" size={28} />
          <p className="font-bold text-slate-800 dark:text-slate-100">No se pudieron cargar los indicadores</p>
          <button type="button" onClick={() => fetchData()} className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
            Reintentar
          </button>
        </div>
      )}

      {data && data.totalOrders === 0 && (
        <div className={`${panelClass} py-16 text-center`}>
          <Database size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Sin datos en este periodo</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto text-sm">
            Cambia el periodo a <strong>Este año</strong> o <strong>Histórico</strong> para ver indicadores.
          </p>
          {period !== 'ALL' && (
            <button
              type="button"
              onClick={() => setPeriod('ALL')}
              className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              Ver histórico completo
            </button>
          )}
        </div>
      )}

      {data && data.totalOrders > 0 && (
        <>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Salud de planta</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderKpiCard(
                'Disponibilidad',
                <Activity size={18} />,
                data.metrics.ASSET_AVAILABILITY,
                true,
                (v) => v.toFixed(1),
                '%',
                'Tiempo productivo menos paros con máquina detenida, recortado al periodo.',
                undefined,
                true,
              )}
              {renderKpiCard(
                'MTTR',
                <Wrench size={18} />,
                data.metrics.MTTR,
                false,
                (v) => v.toFixed(1),
                'h',
                'Tiempo medio de labor activa en correctivas finalizadas.',
                undefined,
                true,
              )}
              {renderKpiCard(
                'Backlog',
                <AlertTriangle size={18} />,
                data.metrics.BACKLOG,
                false,
                (v) => v.toString(),
                'OT',
                'Órdenes abiertas ahora: pendientes, en proceso y en espera.',
                () => navigate('/dashboard'),
                true,
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Ejecución y calidad</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {renderKpiCard(
                'OT finalizadas',
                <CheckCircle2 size={18} />,
                data.metrics.COMPLETED_MONTHLY,
                true,
                (v) => v.toString(),
                'OT',
                'Órdenes finalizadas con completed_at dentro del periodo.',
                () => navigate('/dashboard?status=FINALIZADO'),
              )}
              {renderKpiCard(
                'Tiempo respuesta',
                <Clock size={18} />,
                data.metrics.RESPONSE_TIME,
                false,
                (v) => v.toFixed(1),
                'h',
                'Promedio desde creación hasta started_at.',
              )}
              {renderKpiCard(
                'Cumpl. MTTR',
                <Target size={18} />,
                data.metrics.SLA,
                true,
                (v) => v.toFixed(1),
                '%',
                '% de correctivas finalizadas bajo la meta de MTTR.',
              )}
              {renderKpiCard(
                'Retrabajo',
                <RefreshCw size={18} />,
                data.metrics.REINCIDENCIA,
                false,
                (v) => v.toFixed(1),
                '%',
                'Correctivas con falla previa del mismo equipo dentro de la ventana de retrabajo.',
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={panelClass}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="text-emerald-600 dark:text-emerald-400" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">MTTR y MTBF</h3>
                  <p className="text-xs text-slate-400">Tendencia mensual de tiempos de mantenimiento</p>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800">
                  <strong>Horizontal:</strong> mes
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800">
                  <strong>Vertical:</strong> horas
                </span>
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                  <strong>MTTR:</strong> reparación (↓ mejor)
                </span>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <strong>MTBF:</strong> entre fallas (↑ mejor)
                </span>
              </div>
              <div className="h-80">
                {charts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts} margin={{ top: 4, right: 16, left: 8, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <Legend verticalAlign="top" height={32} />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }}
                        tickMargin={6}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Mes / periodo', position: 'bottom', offset: 18, fill: 'var(--color-fg-muted)', fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }}
                        width={48}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Horas', angle: -90, position: 'insideLeft', offset: 0, fill: 'var(--color-fg-muted)', fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(val, name) => [`${Number(val).toFixed(2)} h`, name ?? '']}
                        contentStyle={{ borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-fg)', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                      />
                      <Line type="monotone" dataKey="mttr" name="MTTR (horas)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="mtbf" name="MTBF flota (horas)" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Sin serie temporal</div>
                )}
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex items-center gap-2 mb-4">
                <Package className="text-emerald-600 dark:text-emerald-400" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Costo de refacciones</h3>
                  <p className="text-xs text-slate-400">Solo consumos de inventario ligados a OT</p>
                </div>
              </div>
              <div className="h-72">
                {charts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="month" tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyAxis(v)} />
                      <Tooltip
                        formatter={(val) => [formatCurrency(Number(val)), 'Refacciones']}
                        contentStyle={{ borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-fg)', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                      />
                      <Bar dataKey="costos" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Sin consumos en el periodo</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={panelClass}>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-amber-500" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Equipos con más fallas</h3>
                  <p className="text-xs text-slate-400">Correctivas · clic para ver detalle</p>
                </div>
              </div>
              <div className="h-72">
                {topFailingAssets.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topFailingAssets} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="var(--color-border)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="assetName"
                        width={120}
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => (val.length > 16 ? `${val.slice(0, 16)}…` : val)}
                      />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-fg)', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }} />
                      <Bar
                        dataKey="count"
                        name="Fallas"
                        fill="#f59e0b"
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                        className="cursor-pointer"
                        onClick={(row: any) => {
                          if (row?.assetId) handleAssetClick(row.assetId, row.assetName);
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Sin fallas correctivas</div>
                )}
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex items-center gap-2 mb-4">
                <Database className="text-rose-600 dark:text-rose-400" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Top equipos por costo de refacciones</h3>
                  <p className="text-xs text-slate-400">Consumos de inventario del periodo</p>
                </div>
              </div>
              <div className="h-72">
                {assetCosts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetCosts} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="var(--color-border)" />
                      <XAxis type="number" tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrencyAxis(v)} />
                      <YAxis
                        type="category"
                        dataKey="assetName"
                        width={120}
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => (val.length > 16 ? `${val.slice(0, 16)}…` : val)}
                      />
                      <Tooltip
                        formatter={(val) => [formatCurrency(Number(val)), 'Costo']}
                        contentStyle={{ borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-fg)', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                      />
                      <Bar dataKey="totalCost" fill="#e11d48" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">Sin consumos registrados en este periodo</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className={panelClass}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Solicitudes finalizadas por técnico</h3>
                  <p className="text-xs text-slate-400">OT cerradas en el periodo del marco</p>
                </div>
              </div>
              <div className="h-80">
                {techPeriodCompletedChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={techPeriodCompletedChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="var(--color-border)" />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val) => [val, 'Finalizadas']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || _}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-fg)',
                          boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                        }}
                      />
                      <Bar dataKey="finalizadas" fill="#059669" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                    Sin OT finalizadas en este periodo
                  </div>
                )}
              </div>
            </div>

            <div className={panelClass}>
              <div className="flex items-center gap-2 mb-4">
                <Timer className="text-sky-600 dark:text-sky-400" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Tiempo promedio de labor</h3>
                  <p className="text-xs text-slate-400">
                    Horas de trabajo activo por OT (sin pausas) · periodo
                  </p>
                </div>
              </div>
              <div className="h-80">
                {techPeriodAvgTimeChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={techPeriodAvgTimeChart} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="var(--color-border)" />
                      <XAxis
                        type="number"
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}h`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(val, _key, item) => [
                          formatHours(Number(val)),
                          `Promedio (${item?.payload?.finalizadas ?? 0} OT)`,
                        ]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || _}
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-fg)',
                          boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                        }}
                      />
                      <Bar dataKey="promedio" fill="#0284c7" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm text-center px-4">
                    Sin tiempos de labor registrados en OT finalizadas del periodo
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4">
            <div className={panelClass}>
              <div className="flex flex-col gap-4 mb-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="text-rose-600 dark:text-rose-400" size={20} />
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Equipos con retrabajo</h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Misma falla o mismo equipo ≤ {reworkDays} día{reworkDays === 1 ? '' : 's'} · periodo del marco
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 rounded-xl px-3 py-2 max-w-xs">
                    Correctiva finalizada tras otra correctiva cerrada en los {reworkDays} días previos
                    (mismo equipo; mismo problema si está capturado).
                  </div>
                </div>

                <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ventana de retrabajo</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Define cuántos días hacia atrás se busca una falla previa.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {REWORK_DAY_PRESETS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => applyReworkDays(days)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                          reworkDays === days
                            ? 'bg-rose-600 text-white'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-400'
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={reworkDaysInput}
                        onChange={(e) => setReworkDaysInput(e.target.value)}
                        onBlur={() => applyReworkDays(Number(reworkDaysInput))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') applyReworkDays(Number(reworkDaysInput));
                        }}
                        className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-center text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20"
                        aria-label="Días personalizados de retrabajo"
                      />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">días</span>
                    </div>
                  </div>
                </div>
              </div>
              {data.metrics.REINCIDENCIA.details && data.metrics.REINCIDENCIA.details.length > 0 ? (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-bold">Equipo</th>
                        <th className="text-right px-3 py-2 font-bold">Retrabajos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.metrics.REINCIDENCIA.details.map((asset) => (
                        <tr
                          key={asset.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => handleAssetClick(asset.id, asset.name)}
                        >
                          <td className="px-3 py-2.5 font-medium text-slate-700 dark:text-slate-300">{asset.name}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-2.5 py-0.5 text-xs font-bold">
                              {asset.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                  <CheckCircle2 className="text-emerald-400 mb-2" size={28} />
                  Sin retrabajos en este periodo
                </div>
              )}
            </div>
          </section>
        </>
      )}
      </FilterScopeFrame>

      {data && data.totalOrders > 0 && (
          <section className={`${panelClass} space-y-5 mt-6`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="text-sky-600 dark:text-sky-400" size={22} />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Dashboard de técnicos</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Vista operativa del día y productividad de la semana (lun–dom). No usa el filtro de periodo de arriba.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/80 dark:bg-sky-950/30 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  <Activity size={14} /> Carga del día
                </div>
                <p className="mt-1 text-2xl font-black text-sky-800 dark:text-sky-200">{techDashSummary.cargaHoy}</p>
                <p className="text-[11px] text-sky-600/80 dark:text-sky-400/80">OT abiertas asignadas</p>
              </div>
              <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/30 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <PauseCircle size={14} /> OTs pausadas
                </div>
                <p className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-200">{techDashSummary.pausadas}</p>
                <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">En espera ahora</p>
              </div>
              <div className="rounded-xl border border-orange-100 dark:border-orange-900/40 bg-orange-50/80 dark:bg-orange-950/30 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-300">
                  <Timer size={14} /> Tiempo en espera
                </div>
                <p className="mt-1 text-2xl font-black text-orange-800 dark:text-orange-200">
                  {formatHours(techDashSummary.tiempoEspera)}
                </p>
                <p className="text-[11px] text-orange-600/80 dark:text-orange-400/80">Suma relojes detenidos</p>
              </div>
              <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/30 p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <CalendarCheck size={14} /> Productividad semanal
                </div>
                <p className="mt-1 text-2xl font-black text-emerald-800 dark:text-emerald-200">
                  {techDashSummary.finalizadasSemana}
                  <span className="ml-1.5 text-sm font-bold text-emerald-600/90 dark:text-emerald-400">
                    · {formatHours(techDashSummary.horasLaborSemana)}
                  </span>
                </p>
                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">Cerradas · horas de labor</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Detalle por técnico
                </h4>
                {techPerformance.length > 0 ? (
                  <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full min-w-0 table-fixed text-[11px] leading-tight">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="text-left pl-2 pr-1 py-1.5 font-bold w-[28%]" title="Técnico">Técnico</th>
                          <th className="text-right px-0.5 py-1.5 font-bold w-[8%]" title="Carga del día">Hoy</th>
                          <th className="text-right px-0.5 py-1.5 font-bold w-[8%]" title="En espera">Paus</th>
                          <th className="text-right px-0.5 py-1.5 font-bold w-[10%]" title="Tiempo en espera">Esp</th>
                          <th className="text-right px-0.5 py-1.5 font-bold w-[8%]" title="Finalizadas esta semana">Sem</th>
                          <th className="text-right px-0.5 py-1.5 font-bold w-[10%]" title="Horas de labor esta semana">Lab</th>
                          <th className="text-right px-0.5 py-1.5 font-bold w-[8%]" title="Finalizadas en el periodo">Fin</th>
                          <th className="text-right px-0.5 py-1.5 font-bold w-[8%]" title="En proceso">Proc</th>
                          <th className="text-right pl-0.5 pr-2 py-1.5 font-bold w-[8%]" title="Pendientes">Pend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {techPerformance.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="pl-2 pr-1 py-1.5 font-medium text-slate-700 dark:text-slate-300 truncate" title={row.name}>
                              {row.name}
                            </td>
                            <td className="px-0.5 py-1.5 text-right font-semibold text-sky-700 dark:text-sky-400 tabular-nums">
                              {row.CargaHoy ?? 0}
                            </td>
                            <td className="px-0.5 py-1.5 text-right font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                              {row.Pausadas ?? 0}
                            </td>
                            <td className="px-0.5 py-1.5 text-right text-orange-700 dark:text-orange-400 tabular-nums">
                              {formatHoursCompact(row.TiempoEsperaHoras ?? 0)}
                            </td>
                            <td className="px-0.5 py-1.5 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                              {row.FinalizadasSemana ?? 0}
                            </td>
                            <td className="px-0.5 py-1.5 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                              {formatHoursCompact(row.HorasLaborSemana ?? 0)}
                            </td>
                            <td className="px-0.5 py-1.5 text-right text-slate-600 dark:text-slate-400 tabular-nums">{row.Finalizadas}</td>
                            <td className="px-0.5 py-1.5 text-right text-sky-600 dark:text-sky-400 tabular-nums">{row.EnProceso}</td>
                            <td className="pl-0.5 pr-2 py-1.5 text-right text-amber-600 dark:text-amber-400 tabular-nums">{row.Pendientes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    Sin carga asignada
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Productividad semanal (top 8)
                </h4>
                {techWeeklyChart.length > 0 ? (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={techWeeklyChart} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                        <Tooltip
                          formatter={(val, key) =>
                            key === 'horas' ? [formatHours(Number(val)), 'Horas labor'] : [val, 'Finalizadas']
                          }
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || _}
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                            color: 'var(--color-fg)',
                            boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="finalizadas" name="Finalizadas" fill="#059669" radius={[4, 4, 0, 0]} barSize={16} />
                        <Bar dataKey="horas" name="Horas labor" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    Sin cierres esta semana
                  </div>
                )}
              </div>
            </div>
          </section>
      )}

      {selectedFailureAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Desglose de fallas"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} />
                  Desglose de fallas
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Equipo: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedFailureAsset.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFailureAsset(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-800"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {isFetchingOrders ? (
                <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">Cargando órdenes...</div>
              ) : failureOrders.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Folio</th>
                      <th className="text-left px-3 py-2">Título</th>
                      <th className="text-left px-3 py-2">Estado</th>
                      <th className="text-left px-3 py-2">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {failureOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                          {formatWorkOrderFolio(order.folio)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{order.title}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{order.status}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {new Date(order.created_at).toLocaleDateString('es-MX')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">Sin órdenes para este equipo</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
