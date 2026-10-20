import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowDownToLine, ArrowLeft, CheckCircle2, ChevronDown, Clock3, ExternalLink, Filter, Timer, Trophy, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getTechnicianPerformanceDetail } from '../api/kpis';
import type { TechnicianPerformanceDetail } from '../api/kpis';
import { getZones } from '../api/zones';
import { updateWorkOrder, type WorkOrder } from '../api/workOrders';
import { formatWorkOrderFolio } from '../utils/folio';
import { PageLoadError, PageLoadingState } from '../components/PageLoadState';
import { PeriodRangeFilter, firstDayOfMonthYmd, todayYmd } from '../components/common/PeriodRangeFilter';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { buildTechnicianPerformancePdf } from '../utils/technicianPerformancePdf';

const periods = [
  ['THIS_MONTH', 'Este mes'], ['LAST_MONTH', 'Mes pasado'], ['THIS_YEAR', 'Este año'],
  ['LAST_12_MONTHS', 'Últimos 12 meses'], ['ALL', 'Histórico'], ['CUSTOM', 'Personalizado'],
] as const;

const duration = (ms: number | null) => {
  if (ms === null || !Number.isFinite(ms)) return '—';
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)} min`;
  return `${hours.toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`;
};

const dateTime = (value: string | null) => value
  ? new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
  : '—';

const statusLabel: Record<string, string> = {
  PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', EN_ESPERA: 'En espera', FINALIZADO: 'Finalizada', ANULADO: 'Anulada',
};

const maintenanceLabels: Record<string, string> = {
  CORRECTIVO: 'Correctivo', PREVENTIVO: 'Preventivo', SERVICIO: 'Servicio',
};

const chartTooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  color: 'var(--color-fg)',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
};

export const TechnicianPerformancePage = () => {
  const { technicianId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as { returnTo?: { pathname?: string; search?: string; hash?: string; restorePersonnel?: { activeTab?: 'users' | 'requesters'; searchTerm?: string; showInactive?: boolean; viewMode?: 'cards' | 'table' } } } | null)?.returnTo;
  const [period, setPeriod] = useState<string>('THIS_MONTH');
  const [startDate, setStartDate] = useState(firstDayOfMonthYmd);
  const [endDate, setEndDate] = useState(todayYmd);
  const [data, setData] = useState<TechnicianPerformanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [zones, setZones] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zonesOpen, setZonesOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortMetric, setSortMetric] = useState<'' | 'response' | 'repair'>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedOrder, setSelectedOrder] = useState<TechnicianPerformanceDetail['orders'][number] | null>(null);

  const load = async () => {
    if (period === 'CUSTOM' && (!startDate || !endDate)) return;
    setLoading(true);
    setFailed(false);
    try {
      setData(await getTechnicianPerformanceDetail(technicianId, {
        period, startDate: period === 'CUSTOM' ? startDate : undefined,
        endDate: period === 'CUSTOM' ? endDate : undefined,
      }));
    } catch (error) {
      console.error('Error loading technician report', error);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [technicianId, period, startDate, endDate]);
  useEffect(() => {
    let active = true;
    getZones().then((result) => { if (active) setZones(result.map(({ id, name }) => ({ id, name }))); })
      .catch((error) => console.error('Error loading zones for technician filters', error));
    return () => { active = false; };
  }, []);

  const assets = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    (data?.orders ?? []).forEach((order) => byId.set(order.asset.id, order.asset));
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [data?.orders]);
  const visibleOrders = useMemo(() => {
    const filtered = (data?.orders ?? []).filter((order) =>
      (!selectedZoneIds.length || (!!order.zone?.id && selectedZoneIds.includes(order.zone.id))) &&
      (!selectedAssetId || order.asset.id === selectedAssetId) &&
      (!selectedType || order.maintenance_type === selectedType) &&
      (!selectedStatus || order.status === selectedStatus),
    );
    if (!sortMetric) return filtered;
    const measure = (order: TechnicianPerformanceDetail['orders'][number]) => {
      if (sortMetric === 'response') return order.started_at
        ? new Date(order.started_at).getTime() - new Date(order.created_at).getTime()
        : null;
      return order.status === 'FINALIZADO' ? order.accumulated_time_ms : null;
    };
    return [...filtered].sort((left, right) => {
      const leftValue = measure(left);
      const rightValue = measure(right);
      if (leftValue === null) return rightValue === null ? 0 : 1;
      if (rightValue === null) return -1;
      return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue;
    });
  }, [data?.orders, selectedZoneIds, selectedAssetId, selectedType, selectedStatus, sortMetric, sortDirection]);
  const hasFilters = selectedZoneIds.length > 0 || !!selectedAssetId || !!selectedType || !!selectedStatus;
  const filterNames = [
    selectedZoneIds.length ? `Zonas: ${zones.filter((zone) => selectedZoneIds.includes(zone.id)).map((zone) => zone.name).join(', ')}` : '',
    selectedAssetId ? `Activo: ${assets.find((asset) => asset.id === selectedAssetId)?.name ?? 'seleccionado'}` : '',
    selectedType ? `Tipo: ${maintenanceLabels[selectedType] ?? selectedType}` : '',
    selectedStatus ? `Estado: ${statusLabel[selectedStatus] ?? selectedStatus}` : '',
  ].filter(Boolean);
  const periodLabel = periods.find(([value]) => value === period)?.[1] ?? period;
  const exportScopeLabel = [
    ...filterNames,
    ...(sortMetric ? [`Orden: ${sortMetric === 'response' ? 'Tiempo de respuesta' : 'Tiempo de reparación'} (${sortDirection === 'desc' ? 'mayor a menor' : 'menor a mayor'})`] : []),
  ].join(' · ');
  const clearFilters = () => { setSelectedZoneIds([]); setSelectedAssetId(''); setSelectedType(''); setSelectedStatus(''); };
  const toggleZone = (zoneId: string) => setSelectedZoneIds((current) => current.includes(zoneId)
    ? current.filter((id) => id !== zoneId)
    : [...current, zoneId]);

  const metrics = data?.metrics;
  const typeCounts = new Map<string, number>();
  for (const order of data?.orders ?? []) {
    if (order.status === 'ANULADO') continue;
    typeCounts.set(order.maintenance_type, (typeCounts.get(order.maintenance_type) ?? 0) + 1);
  }
  const maintenanceMix = [...typeCounts.entries()].map(([type, count]) => ({
    name: maintenanceLabels[type] ?? type,
    value: count,
  }));
  const trend = (data?.trend ?? []).map((month) => ({
    ...month,
    responseHours: month.responseAverageMs === null ? null : month.responseAverageMs / 3_600_000,
    repairHours: month.repairAverageMs === null ? null : month.repairAverageMs / 3_600_000,
  }));
  const complianceLabel = (value: number | null | undefined) => value == null
    ? 'Sin muestra'
    : `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`;
  const ranking = data?.ranking;
  const rankingHint = !ranking?.place
    ? 'Aún no hay OT finalizadas para comparar'
    : ranking.place === 1 && ranking.tiedCount > 1
      ? `Empatado en el primer lugar · +1 OT para liderar`
      : ranking.place === 1
        ? 'Vas en primer lugar · ¡mantén el ritmo!'
        : `A ${Math.max(1, (ranking.nextPlaceCompleted ?? ranking.completed) - ranking.completed + 1)} OT de superar al grupo de arriba`;
  const rankColor = ranking?.place === 1
    ? { card: 'border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-white shadow-md shadow-amber-100/70 dark:border-amber-700 dark:from-amber-950/50 dark:via-amber-950/30 dark:to-slate-900', icon: 'text-amber-800 bg-amber-200 ring-1 ring-inset ring-amber-300 dark:text-amber-200 dark:bg-amber-900/70 dark:ring-amber-700', value: 'text-amber-800 dark:text-amber-300', badge: 'bg-amber-200 text-amber-900 dark:bg-amber-900/70 dark:text-amber-200', hint: 'text-amber-800 dark:text-amber-300' }
    : ranking?.place === 2
      ? { card: 'border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-50 shadow-md shadow-slate-200/70 dark:border-slate-600 dark:from-slate-800 dark:via-slate-900 dark:to-slate-900', icon: 'text-slate-700 bg-slate-200 ring-1 ring-inset ring-slate-300 dark:text-slate-200 dark:bg-slate-700 dark:ring-slate-600', value: 'text-slate-700 dark:text-slate-200', badge: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200', hint: 'text-slate-700 dark:text-slate-300' }
      : ranking?.place === 3
        ? { card: 'border-orange-300 bg-gradient-to-br from-orange-50 via-amber-50 to-white shadow-md shadow-orange-100/70 dark:border-orange-800 dark:from-orange-950/40 dark:via-amber-950/20 dark:to-slate-900', icon: 'text-orange-800 bg-orange-200 ring-1 ring-inset ring-orange-300 dark:text-orange-200 dark:bg-orange-900/60 dark:ring-orange-800', value: 'text-orange-800 dark:text-orange-300', badge: 'bg-orange-200 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200', hint: 'text-orange-800 dark:text-orange-300' }
        : { card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900 dark:from-emerald-950/30 dark:to-slate-900', icon: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60', value: 'text-emerald-800 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', hint: 'text-emerald-700 dark:text-emerald-400' };
  const podiumBadge = ranking?.place === 1 ? '1.er lugar'
    : ranking?.place === 2 ? '2.º lugar'
      : ranking?.place === 3 ? '3.er lugar'
        : ranking?.place ? 'EN ASCENSO' : 'SIN CLASIFICACIÓN';
  const cards: Array<{ label: string; value: string | number; detail: string; icon: LucideIcon; color: string; hint?: string; ranking?: boolean }> = [
    { label: 'OT asignadas', value: metrics?.assigned ?? 0, detail: 'En el periodo', icon: Wrench, color: 'text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/40' },
    { label: 'OT finalizadas', value: metrics?.completed ?? 0, detail: 'Cierre dentro del periodo', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40' },
    { label: 'Respuesta promedio', value: duration(metrics?.responseAverageMs ?? null), detail: `${metrics?.responseSample ?? 0} OT con inicio`, icon: Clock3, color: 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40' },
    { label: 'Reparación promedio', value: duration(metrics?.repairAverageMs ?? null), detail: `${metrics?.repairSample ?? 0} OT finalizadas`, icon: Timer, color: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40' },
    { label: 'Ciclo promedio', value: duration(metrics?.cycleAverageMs ?? null), detail: 'Creación hasta cierre', icon: Activity, color: 'text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/40' },
    { label: 'OT abiertas', value: metrics?.open ?? 0, detail: 'Pendientes, proceso o espera', icon: Activity, color: 'text-orange-700 bg-orange-50 dark:text-orange-300 dark:bg-orange-950/40' },
    { label: 'Horas de labor', value: duration(metrics?.totalLaborMs ?? 0), detail: 'Suma registrada en OT finalizadas', icon: Timer, color: 'text-cyan-700 bg-cyan-50 dark:text-cyan-300 dark:bg-cyan-950/40' },
    { label: 'OT vencidas', value: metrics?.overdueOpen ?? 0, detail: 'Abiertas después de su fecha límite', icon: Clock3, color: 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-950/40' },
    { label: 'Lugar entre el grupo', value: ranking?.place ? `#${ranking.place}` : '—', detail: `${ranking?.completed ?? 0} OT finalizadas · de ${ranking?.totalPeers ?? 0} personas`, icon: Trophy, color: rankColor.icon, hint: rankingHint, ranking: true },
  ];
  const goBack = () => {
    if (!returnTo?.pathname) {
      navigate(-1);
      return;
    }
    navigate(`${returnTo.pathname}${returnTo.search ?? ''}${returnTo.hash ?? ''}`, {
      state: returnTo.restorePersonnel ? { restorePersonnel: returnTo.restorePersonnel } : undefined,
    });
  };

  return (
    <div className="space-y-5">
      <button onClick={goBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-emerald-700 dark:text-slate-300">
        <ArrowLeft size={16} /> {returnTo?.pathname === '/users' ? 'Volver a Personal' : 'Volver a KPIs y Metas'}
      </button>
      {data && (
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Desempeño individual</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{data.technician.name}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{data.technician.role === 'TECNICO' ? 'Técnico' : 'Gestionador'}{data.technician.is_active ? '' : ' · Inactivo'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {periods.map(([value, label]) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${period === value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>{label}</button>)}
            <button onClick={() => buildTechnicianPerformancePdf({ data, periodLabel, orders: visibleOrders, filtersLabel: exportScopeLabel || 'Sin filtros ni orden específico; historial completo del periodo' })} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
              <ArrowDownToLine size={15} /> Descargar PDF
            </button>
          </div>
        </header>
      )}
      {period === 'CUSTOM' && <PeriodRangeFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />}
      {loading ? <PageLoadingState label="Cargando desempeño del técnico…" /> : failed || !data ? <PageLoadError message="No se pudo cargar el desempeño de este técnico." onRetry={() => void load()} /> : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {cards.map(({ label, value, detail, icon: Icon, color, hint, ranking: isRanking }) => <article key={label} className={`relative rounded-xl border p-4 shadow-sm ${isRanking ? `overflow-hidden ${rankColor.card}` : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
              <div className={`mb-3 inline-flex rounded-lg p-2 ${color}`}><Icon size={17} /></div>
              {isRanking && <Trophy aria-hidden="true" className="pointer-events-none absolute right-4 top-3 opacity-[0.09]" size={64} />}
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
              {isRanking && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide ${rankColor.badge}`}>{podiumBadge}</span>}
              <p className={`mt-1 font-black tracking-tight ${isRanking ? `text-4xl ${rankColor.value}` : 'text-2xl text-slate-900 dark:text-white'}`}>{value}</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{detail}</p>
              {hint && <p className={`mt-1 text-[11px] font-semibold ${isRanking ? rankColor.hint : 'text-amber-700 dark:text-amber-400'}`}>{hint}</p>}
            </article>)}
          </section>
          <p className="-mt-3 text-[11px] text-slate-500 dark:text-slate-400">El puesto compara técnicos y gestores activos por OT finalizadas en el periodo; las órdenes compartidas cuentan para cada asignado.</p>
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4"><h2 className="font-bold text-slate-900 dark:text-white">Actividad mensual</h2><p className="text-xs text-slate-500 dark:text-slate-400">OT creadas y finalizadas por este técnico · últimos 12 meses</p></div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.month ?? ''} />
                    <Legend />
                    <Bar dataKey="created" name="Creadas" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed" name="Finalizadas" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4"><h2 className="font-bold text-slate-900 dark:text-white">Tiempos promedio por mes</h2><p className="text-xs text-slate-500 dark:text-slate-400">Respuesta hasta iniciar y labor de reparación</p></div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 2 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e2e8f0)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.month ?? ''} formatter={(value, name) => [`${Number(value).toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`, name === 'responseHours' ? 'Respuesta' : 'Reparación']} />
                    <Legend formatter={(value) => value === 'responseHours' ? 'Respuesta' : 'Reparación'} />
                    <Line connectNulls={false} type="monotone" dataKey="responseHours" name="responseHours" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line connectNulls={false} type="monotone" dataKey="repairHours" name="repairHours" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3"><h2 className="font-bold text-slate-900 dark:text-white">Mezcla de mantenimiento</h2><p className="text-xs text-slate-500 dark:text-slate-400">Órdenes no anuladas en el periodo seleccionado</p></div>
              {maintenanceMix.length ? <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={maintenanceMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {maintenanceMix.map((entry, index) => <Cell key={entry.name} fill={['#0284c7', '#059669', '#d97706'][index % 3]} />)}
                    </Pie>
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div> : <div className="flex h-60 items-center justify-center text-sm text-slate-400">Sin órdenes en este periodo</div>}
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-5"><h2 className="font-bold text-slate-900 dark:text-white">Cumplimiento de metas</h2><p className="text-xs text-slate-500 dark:text-slate-400">Porcentaje de OT dentro de las metas globales configuradas</p></div>
              <div className="space-y-6">
                {([
                  { label: 'Respuesta dentro de meta', value: metrics?.responseWithinGoalPercent ?? null, target: metrics?.responseTargetHours ?? 1, unit: 'h', sample: metrics?.responseSample ?? 0, color: 'bg-violet-500' },
                  { label: 'Reparación correctiva dentro de meta', value: metrics?.repairWithinGoalPercent ?? null, target: metrics?.repairTargetHours ?? 4, unit: 'h', sample: metrics?.repairGoalSample ?? 0, color: 'bg-amber-500' },
                ]).map((item) => <div key={item.label}>
                  <div className="mb-2 flex items-end justify-between gap-3"><div><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.label}</p><p className="text-[11px] text-slate-500 dark:text-slate-400">Meta ≤ {item.target.toLocaleString('es-MX', { maximumFractionDigits: 1 })} {item.unit} · {item.sample} OT</p></div><span className="text-xl font-black text-slate-900 dark:text-white">{complianceLabel(item.value)}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(100, Math.max(0, item.value ?? 0))}%` }} /></div>
                </div>)}
              </div>
              <p className="mt-5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Respuesta usa órdenes con inicio registrado; cumplimiento de reparación usa correctivas finalizadas comparadas con la meta de MTTR. Las órdenes compartidas cuentan para cada técnico asignado.</p>
            </article>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div><h2 className="font-bold text-slate-900 dark:text-white">Historial de órdenes</h2><p className="text-xs text-slate-500 dark:text-slate-400">Incluye OT abiertas y órdenes creadas o cerradas durante el periodo.</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{visibleOrders.length}{hasFilters ? ` de ${data.orders.length}` : ''} órdenes</span>
            </div>
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              La respuesta se mide desde la creación hasta el primer inicio registrado. La reparación usa horas de labor registradas. En OT con varios técnicos, la orden y sus tiempos completos aparecen en el expediente de cada asignado; el sistema no distribuye el tiempo entre ellos.
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400"><Filter size={14} /> Filtrar historial</span>
              <div className="relative">
                <button type="button" aria-haspopup="true" aria-expanded={zonesOpen} aria-controls="technician-zone-filter" onClick={() => setZonesOpen((open) => !open)} className="inline-flex min-w-36 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <span className="truncate">{selectedZoneIds.length ? `Zonas (${selectedZoneIds.length})` : 'Todas las zonas'}</span><ChevronDown size={14} />
                </button>
                {zonesOpen && <div id="technician-zone-filter" role="group" aria-label="Seleccionar una o varias zonas" className="absolute left-0 top-full z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-1 flex items-center justify-between border-b border-slate-100 px-2 pb-2 dark:border-slate-800"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Selecciona una o varias</span><button type="button" onClick={() => setSelectedZoneIds([])} className="text-[11px] font-bold text-emerald-700 hover:underline dark:text-emerald-400">Limpiar</button></div>
                  {zones.map((zone) => <label key={zone.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={selectedZoneIds.includes(zone.id)} onChange={() => toggleZone(zone.id)} className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />{zone.name}</label>)}
                  {!zones.length && <p className="px-2 py-3 text-xs text-slate-500">No hay zonas disponibles.</p>}
                </div>}
              </div>
              <select aria-label="Filtrar por activo" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="">Todos los activos</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
              <select aria-label="Filtrar por tipo" value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="">Todos los tipos</option>{Object.entries(maintenanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Filtrar por estado" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="">Todos los estados</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select aria-label="Ordenar historial por" value={sortMetric} onChange={(event) => setSortMetric(event.target.value as '' | 'response' | 'repair')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="">Orden original</option><option value="response">Tiempo de respuesta</option><option value="repair">Tiempo de reparación</option>
              </select>
              <select aria-label="Dirección del orden" value={sortDirection} onChange={(event) => setSortDirection(event.target.value as 'asc' | 'desc')} disabled={!sortMetric} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="desc">Mayor a menor</option><option value="asc">Menor a mayor</option>
              </select>
              {hasFilters && <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-slate-500 hover:bg-white hover:text-rose-600 dark:hover:bg-slate-800"><X size={14} /> Limpiar filtros</button>}
              <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">Filtros combinables para historial y PDF; métricas del periodo completo</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr>
                  <th className="px-4 py-3">OT</th><th className="px-4 py-3">Activo / zona</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Creada</th><th className="px-4 py-3">Respuesta</th><th className="px-4 py-3">Reparación</th><th className="px-4 py-3">Ciclo</th><th className="px-4 py-3"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleOrders.map((order) => {
                    const response = order.started_at ? new Date(order.started_at).getTime() - new Date(order.created_at).getTime() : null;
                    const cycle = order.completed_at ? new Date(order.completed_at).getTime() - new Date(order.created_at).getTime() : null;
                    const repair = order.status === 'FINALIZADO' ? order.accumulated_time_ms : null;
                    return <tr key={order.id} role="button" tabIndex={0} onClick={() => setSelectedOrder(order)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedOrder(order); } }} className="cursor-pointer hover:bg-emerald-50/60 focus:bg-emerald-50/60 focus:outline-none dark:hover:bg-slate-800/70 dark:focus:bg-slate-800/70">
                      <td className="px-4 py-3"><div className="font-bold text-emerald-700 dark:text-emerald-400">{formatWorkOrderFolio(order.folio)}</div><div className="max-w-56 truncate text-slate-500" title={order.title}>{order.title}</div>{order.machine_stopped && <span className="mt-1 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Paro</span>}</td>
                      <td className="px-4 py-3"><div className="font-semibold text-slate-700 dark:text-slate-200">{order.asset.name}</div><div className="text-slate-500">{order.zone?.name ?? 'Sin zona'}</div></td>
                      <td className="px-4 py-3">{order.maintenance_type}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold dark:bg-slate-800">{statusLabel[order.status] ?? order.status}</span></td>
                      <td className="px-4 py-3 tabular-nums">{dateTime(order.created_at)}</td><td className="px-4 py-3 tabular-nums">{duration(response)}</td><td className="px-4 py-3 tabular-nums">{duration(repair)}</td><td className="px-4 py-3 tabular-nums">{duration(cycle)}</td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400" title="Ver detalle">Ver detalle <ExternalLink size={13} /></span></td>
                    </tr>;
                  })}
                  {!visibleOrders.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">{hasFilters ? 'No hay órdenes que coincidan con los filtros seleccionados.' : 'No hay órdenes asignadas en este periodo.'}</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          {selectedOrder && <ErrorBoundary><WorkOrderDetailModal
            key={selectedOrder.id}
            workOrder={selectedOrder as unknown as WorkOrder}
            isOpen
            onClose={() => setSelectedOrder(null)}
            onUpdate={async (id, changes) => {
              const result = await updateWorkOrder(id, changes);
              await load();
              return result;
            }}
          /></ErrorBoundary>}
        </>
      )}
    </div>
  );
};
