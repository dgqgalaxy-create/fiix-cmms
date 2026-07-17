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

type MetricStatus = 'good' | 'warn' | 'bad' | 'neutral';

const PERIOD_OPTIONS = [
  { value: 'THIS_WEEK', label: 'Esta semana' },
  { value: 'THIS_MONTH', label: 'Este mes' },
  { value: 'LAST_MONTH', label: 'Mes pasado' },
  { value: 'THIS_YEAR', label: 'Este año' },
  { value: 'LAST_12_MONTHS', label: 'Últimos 12 meses' },
  { value: 'ALL', label: 'Histórico' },
];

const GOAL_LABELS: Record<string, { label: string; unit: string; hint: string }> = {
  COMPLETED_MONTHLY: { label: 'OT finalizadas', unit: 'órdenes', hint: 'Meta de órdenes cerradas en el periodo' },
  MTTR: { label: 'MTTR', unit: 'horas', hint: 'Tiempo medio de reparación correctiva' },
  RESPONSE_TIME: { label: 'Tiempo de respuesta', unit: 'horas', hint: 'Desde creación hasta inicio de trabajo' },
  SLA: { label: 'Cumplimiento MTTR', unit: '%', hint: '% de correctivas bajo la meta de MTTR' },
  BACKLOG: { label: 'Backlog', unit: 'órdenes', hint: 'Órdenes abiertas (pendiente, proceso, espera)' },
  ASSET_AVAILABILITY: { label: 'Disponibilidad', unit: '%', hint: 'Tiempo productivo menos paros con máquina detenida' },
  REINCIDENCIA: { label: 'Retrabajo', unit: '%', hint: 'Correctivas con falla previa ≤ 7 días' },
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
    card: 'border-emerald-200 bg-white',
    value: 'text-emerald-700',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    label: 'En meta',
  },
  warn: {
    card: 'border-amber-200 bg-white',
    value: 'text-amber-700',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    label: 'Cerca de meta',
  },
  bad: {
    card: 'border-rose-200 bg-white',
    value: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    label: 'Fuera de meta',
  },
  neutral: {
    card: 'border-slate-200 bg-white',
    value: 'text-slate-700',
    chip: 'bg-slate-50 text-slate-600 border-slate-200',
    bar: 'bg-slate-400',
    label: 'Sin muestra',
  },
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
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [assetCosts, setAssetCosts] = useState<AssetCostData[]>([]);
  const [topFailingAssets, setTopFailingAssets] = useState<TopFailingAsset[]>([]);
  const [techPerformance, setTechPerformance] = useState<TechnicianPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [period, setPeriod] = useState('THIS_MONTH');
  const [loadError, setLoadError] = useState(false);

  const [selectedFailureAsset, setSelectedFailureAsset] = useState<{ id: string; name: string } | null>(null);
  const [failureOrders, setFailureOrders] = useState<FailureOrder[]>([]);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [goalsForm, setGoalsForm] = useState<Record<string, number>>({});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setLoadError(false);
      const [kpiData, chartData, costData, topFailingData, techData] = await Promise.all([
        getKPIs(period),
        getChartData(period).catch(() => []),
        getCostsByAsset(period).catch(() => []),
        getTopFailingAssets(period).catch(() => []),
        getTechnicianPerformance(period).catch(() => []),
      ]);
      setData(kpiData);
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
      setLoadError(true);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

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
      setFailureOrders(await getAssetFailureOrders(assetId, period));
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
        className={`text-left rounded-2xl border p-4 sm:p-5 shadow-sm transition hover:border-slate-300 ${styles.card} ${hero ? 'min-h-[150px]' : ''} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
            <div className={`mt-1 flex items-baseline gap-1.5 ${styles.value}`}>
              <span className={`font-black ${hero ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                {metric.isNull || (metric.sampleSize === 0 && metric.value === 0 && title !== 'Backlog' && title !== 'OT finalizadas')
                  ? '—'
                  : formatter(metric.value)}
              </span>
              <span className="text-xs font-semibold text-slate-400">{unit}</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-100 p-2 text-slate-600">{icon}</div>
        </div>

        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full transition-all ${styles.bar}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-500">
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
    return <div className="p-8 text-center text-slate-500">Cargando indicadores...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="hidden print:flex justify-between items-end border-b-2 border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reporte de Indicadores</h1>
          <p className="text-slate-500 mt-1">LPET CMMS — Mantenimiento</p>
        </div>
        <div className="text-right text-sm text-slate-600">
          <p className="font-bold">Generado:</p>
          <p>{new Date().toLocaleString('es-MX')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Indicadores de mantenimiento</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Periodo: <span className="font-semibold text-slate-700">{formatPeriodLabel()}</span>
            {data ? ` · ${data.totalOrders} registros relevantes` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="kpi-period">Periodo</label>
          <select
            id="kpi-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchData()}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="Actualizar"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            <Download size={16} />
            Exportar
          </button>
          {hasPermission('MANAGE_KPIS') && (
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              <Settings size={16} />
              Metas
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto text-amber-500 mb-2" size={28} />
          <p className="font-bold text-slate-800">No se pudieron cargar los indicadores</p>
          <button type="button" onClick={() => fetchData()} className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
            Reintentar
          </button>
        </div>
      )}

      {isEditing && data && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Configurar metas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.keys(goalsForm).map((key) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  {GOAL_LABELS[key]?.label || key}
                  <span className="ml-1 font-normal text-slate-400">({GOAL_LABELS[key]?.unit})</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-emerald-500"
                  value={goalsForm[key]}
                  onChange={(e) => setGoalsForm({ ...goalsForm, [key]: Number(e.target.value) })}
                />
                <p className="mt-1 text-[11px] text-slate-400">{GOAL_LABELS[key]?.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-medium">
              Cancelar
            </button>
            <button type="button" onClick={handleSaveGoals} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">
              Guardar metas
            </button>
          </div>
        </div>
      )}

      {data && data.totalOrders === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <Database size={40} className="mx-auto text-slate-300 mb-3" />
          <h2 className="text-xl font-bold text-slate-700">Sin datos en este periodo</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto text-sm">
            Cambia el periodo a <strong>Este año</strong> o <strong>Histórico</strong> para ver indicadores.
          </p>
          {period !== 'ALL' && (
            <button
              type="button"
              onClick={() => setPeriod('ALL')}
              className="mt-4 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold"
            >
              Ver histórico completo
            </button>
          )}
        </div>
      )}

      {data && data.totalOrders > 0 && (
        <>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Salud de planta</h2>
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Ejecución y calidad</h2>
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
                'Correctivas con falla previa del mismo equipo ≤ 7 días.',
              )}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="text-emerald-600" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800">MTTR y MTBF</h3>
                  <p className="text-xs text-slate-400">MTTR en correctivas · MTBF aproximado de flota</p>
                </div>
              </div>
              <div className="h-72">
                {charts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="mttr" name="MTTR (h)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="mtbf" name="MTBF flota (h)" stroke="#059669" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin serie temporal</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Package className="text-indigo-600" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800">Costo de refacciones</h3>
                  <p className="text-xs text-slate-400">Solo consumos de inventario ligados a OT</p>
                </div>
              </div>
              <div className="h-72">
                {charts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(val: number) => [`$${Number(val).toFixed(2)}`, 'Refacciones']}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                      />
                      <Bar dataKey="costos" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin consumos en el periodo</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-amber-500" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800">Equipos con más fallas</h3>
                  <p className="text-xs text-slate-400">Correctivas · clic para ver detalle</p>
                </div>
              </div>
              <div className="h-72">
                {topFailingAssets.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topFailingAssets} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="assetName"
                        width={120}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => (val.length > 16 ? `${val.slice(0, 16)}…` : val)}
                      />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }} />
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
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin fallas correctivas</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Database className="text-rose-600" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800">Top equipos por costo de refacciones</h3>
                  <p className="text-xs text-slate-400">Consumos de inventario del periodo</p>
                </div>
              </div>
              <div className="h-72">
                {assetCosts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={assetCosts} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <YAxis
                        type="category"
                        dataKey="assetName"
                        width={120}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(val) => (val.length > 16 ? `${val.slice(0, 16)}…` : val)}
                      />
                      <Tooltip
                        formatter={(val: number) => [`$${Number(val).toFixed(2)}`, 'Costo']}
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)' }}
                      />
                      <Bar dataKey="totalCost" fill="#e11d48" radius={[0, 4, 4, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sin consumos registrados en este periodo</div>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-blue-600" size={20} />
                <div>
                  <h3 className="font-bold text-slate-800">Carga por técnico</h3>
                  <p className="text-xs text-slate-400">Asignaciones abiertas y del periodo</p>
                </div>
              </div>
              {techPerformance.length > 0 ? (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-bold">Técnico</th>
                        <th className="text-right px-3 py-2 font-bold">Fin.</th>
                        <th className="text-right px-3 py-2 font-bold">Proc.</th>
                        <th className="text-right px-3 py-2 font-bold">Pend.</th>
                        <th className="text-right px-3 py-2 font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {techPerformance.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium text-slate-700">{row.name}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700 font-semibold">{row.Finalizadas}</td>
                          <td className="px-3 py-2.5 text-right text-blue-700 font-semibold">{row.EnProceso}</td>
                          <td className="px-3 py-2.5 text-right text-amber-700 font-semibold">{row.Pendientes}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-800">{row.Total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Sin carga asignada en el periodo</div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="text-rose-600" size={20} />
                  <div>
                    <h3 className="font-bold text-slate-800">Equipos con retrabajo</h3>
                    <p className="text-xs text-slate-400">Misma falla o mismo equipo ≤ 7 días</p>
                  </div>
                </div>
                <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 max-w-xs">
                  Correctiva finalizada tras otra correctiva cerrada en los 7 días previos (mismo equipo; mismo problema si está capturado).
                </div>
              </div>
              {data.metrics.REINCIDENCIA.details && data.metrics.REINCIDENCIA.details.length > 0 ? (
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-bold">Equipo</th>
                        <th className="text-right px-3 py-2 font-bold">Retrabajos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.metrics.REINCIDENCIA.details.map((asset) => (
                        <tr
                          key={asset.id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => handleAssetClick(asset.id, asset.name)}
                        >
                          <td className="px-3 py-2.5 font-medium text-slate-700">{asset.name}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="inline-flex rounded-full bg-rose-100 text-rose-700 px-2.5 py-0.5 text-xs font-bold">
                              {asset.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm">
                  <CheckCircle2 className="text-emerald-400 mb-2" size={28} />
                  Sin retrabajos en este periodo
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {selectedFailureAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Desglose de fallas"
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} />
                  Desglose de fallas
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Equipo: <span className="font-semibold text-slate-700">{selectedFailureAsset.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFailureAsset(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {isFetchingOrders ? (
                <div className="py-16 text-center text-slate-400 text-sm">Cargando órdenes...</div>
              ) : failureOrders.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Folio</th>
                      <th className="text-left px-3 py-2">Título</th>
                      <th className="text-left px-3 py-2">Estado</th>
                      <th className="text-left px-3 py-2">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {failureOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-2 font-semibold text-slate-700">
                          WO-{(order.folio || 0).toString().padStart(4, '0')}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{order.title}</td>
                        <td className="px-3 py-2 text-slate-500">{order.status}</td>
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(order.created_at).toLocaleDateString('es-MX')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-16 text-center text-slate-400 text-sm">Sin órdenes para este equipo</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
