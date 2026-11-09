import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Activity, DollarSign, Loader2, AlertTriangle, RefreshCw,
  ClipboardList, Boxes, Inbox,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend,
} from 'recharts';
import {
  getStatsAging, getStatsConsumption, getStatsReliability, getStatsCosts, getStatsRequests,
  type AgingResponse, type ConsumptionResponse, type ReliabilityResponse, type CostsResponse, type RequestsResponse,
} from '../api/stats';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/dateUtils';
import { formatWorkOrderFolio } from '../utils/folio';

type Section = 'orders' | 'assets' | 'parts' | 'requests' | 'costs';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'orders', label: 'Órdenes de trabajo', icon: <ClipboardList size={15} /> },
  { id: 'assets', label: 'Activos', icon: <Activity size={15} /> },
  { id: 'parts', label: 'Repuestos', icon: <Boxes size={15} /> },
  { id: 'requests', label: 'Solicitudes', icon: <Inbox size={15} /> },
  { id: 'costs', label: 'Costos', icon: <DollarSign size={15} /> },
];

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  EN_ESPERA: 'En espera',
  FINALIZADO: 'Finalizado',
  ANULADO: 'Anulado',
};

const COLORS = ['#059669', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Estadística por entidad: órdenes, activos, repuestos, solicitudes y costos, con gráficas. */
export const StatsPage = () => {
  const [section, setSection] = useState<Section>('orders');
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => isoDay(new Date()));

  const [aging, setAging] = useState<AgingResponse | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionResponse | null>(null);
  const [reliability, setReliability] = useState<ReliabilityResponse | null>(null);
  const [costs, setCosts] = useState<CostsResponse | null>(null);
  const [requests, setRequests] = useState<RequestsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [agingData, consumptionData, reliabilityData, costsData, requestsData] = await Promise.all([
        getStatsAging(),
        getStatsConsumption(from, to),
        getStatsReliability(from, to),
        getStatsCosts(from, to),
        getStatsRequests(from, to),
      ]);
      setAging(agingData);
      setConsumption(consumptionData);
      setReliability(reliabilityData);
      setCosts(costsData);
      setRequests(requestsData);
    } catch {
      setError('No se pudieron cargar las estadísticas.');
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const agingChart = useMemo(
    () => (aging?.buckets ?? []).map((bucket) => ({ name: bucket.label, cantidad: bucket.count })),
    [aging]
  );

  const availabilityChart = useMemo(
    () => (reliability?.assets ?? [])
      .slice()
      .sort((a, b) => a.availability_pct - b.availability_pct)
      .slice(0, 10)
      .map((row) => ({ name: row.asset.internal_code || row.asset.name, disponibilidad: Number(row.availability_pct.toFixed(1)) })),
    [reliability]
  );

  const consumptionChart = useMemo(
    () => (consumption?.items ?? []).slice(0, 10).map((item) => ({ name: item.internal_code || item.name, costo: Math.round(item.cost) })),
    [consumption]
  );

  const consumptionPie = useMemo(
    () => (consumption?.categories ?? []).slice(0, 6).map((row) => ({ name: row.category, value: Math.round(row.cost) })),
    [consumption]
  );

  const requestsChart = useMemo(
    () => (requests?.by_month ?? []).map((row) => ({ name: row.month, solicitudes: row.count })),
    [requests]
  );

  const requestsPie = useMemo(
    () => (requests?.by_status ?? []).map((row) => ({ name: STATUS_LABELS[row.status] ?? row.status, value: row.count })),
    [requests]
  );

  const chartTooltip = {
    contentStyle: { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 },
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            <BarChart3 className="text-emerald-600 dark:text-emerald-400" size={30} />
            Estadística
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-300">
            Órdenes, activos, repuestos, solicitudes y costos, con gráficas y detalle por periodo.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400" htmlFor="stats-from">Desde</label>
            <input
              id="stats-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400" htmlFor="stats-to">Hasta</label>
            <input
              id="stats-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            title="Actualizar"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* Selector de entidad, como el de Estadística de Atlas */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            aria-current={section === item.id ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              section === item.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {isLoading && !aging ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="mr-2 animate-spin" size={18} /> Cargando estadísticas…
        </div>
      ) : section === 'orders' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="OT abiertas" value={String(aging?.total ?? 0)} />
            <Stat
              label="Más antigua"
              value={`${Math.max(0, ...(aging?.orders ?? []).map((order) => order.days))} días`}
              tone="rose"
            />
            <Stat label="Total de OT" value={String((costs?.totals.orders ?? 0))} hint="en el periodo" />
          </div>

          <ChartCard title="Antigüedad de las órdenes abiertas" subtitle="Cantidad de OT por tramo de días">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={agingChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Órdenes abiertas más antiguas</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">OT</th>
                    <th className="px-4 py-2">Equipo</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2 text-center">Días</th>
                    <th className="px-4 py-2">Creada</th>
                  </tr>
                </thead>
                <tbody>
                  {(aging?.oldest ?? []).map((order) => (
                    <tr key={order.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{formatWorkOrderFolio(order.folio)}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{order.asset?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{STATUS_LABELS[order.status] ?? order.status}</td>
                      <td className="px-4 py-2 text-center font-bold text-rose-600 dark:text-rose-400">{order.days}</td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{formatDateTime(order.created_at)}</td>
                    </tr>
                  ))}
                  {(aging?.oldest ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Sin órdenes abiertas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : section === 'assets' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Activos con datos" value={String(reliability?.assets.length ?? 0)} />
            <Stat
              label="Disponibilidad promedio"
              value={reliability?.assets.length
                ? `${(reliability.assets.reduce((sum, row) => sum + row.availability_pct, 0) / reliability.assets.length).toFixed(1)}%`
                : '—'}
              tone="emerald"
            />
            <Stat
              label="Peor disponibilidad"
              value={reliability?.assets.length
                ? `${Math.min(...reliability.assets.map((row) => row.availability_pct)).toFixed(1)}%`
                : '—'}
              tone="rose"
            />
          </div>

          <ChartCard title="Disponibilidad por equipo" subtitle="Los 10 equipos con menor disponibilidad del periodo">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={availabilityChart} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="disponibilidad" radius={[0, 6, 6, 0]}>
                  {availabilityChart.map((entry, index) => (
                    <Cell key={index} fill={entry.disponibilidad >= 95 ? '#059669' : entry.disponibilidad >= 85 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Equipo</th>
                    <th className="px-4 py-2 text-center">Paros</th>
                    <th className="px-4 py-2 text-center">Fallas</th>
                    <th className="px-4 py-2 text-right">Tiempo parado</th>
                    <th className="px-4 py-2 text-right">MTBF</th>
                    <th className="px-4 py-2 text-right">MTTR</th>
                    <th className="px-4 py-2 text-right">Disponibilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {(reliability?.assets ?? []).map((row) => (
                    <tr key={row.asset.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{row.asset.name}</p>
                        <p className="font-mono text-[10px] text-slate-500">{row.asset.internal_code}</p>
                      </td>
                      <td className="px-4 py-2 text-center">{row.stops}</td>
                      <td className="px-4 py-2 text-center">{row.failures}</td>
                      <td className="px-4 py-2 text-right">{row.downtime_hours.toFixed(1)} h</td>
                      <td className="px-4 py-2 text-right">{row.mtbf_hours != null ? `${row.mtbf_hours.toFixed(1)} h` : '—'}</td>
                      <td className="px-4 py-2 text-right">{row.mttr_hours != null ? `${row.mttr_hours.toFixed(1)} h` : '—'}</td>
                      <td className={`px-4 py-2 text-right font-bold ${row.availability_pct >= 95 ? 'text-emerald-600 dark:text-emerald-400' : row.availability_pct >= 85 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {row.availability_pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {(reliability?.assets ?? []).length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Sin datos de paros ni fallas en el periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : section === 'parts' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Costo del consumo" value={formatCurrency(consumption?.total_cost ?? 0)} />
            <Stat label="Cantidad total" value={String(consumption?.total_quantity ?? 0)} />
            <Stat label="Repuestos distintos" value={String(consumption?.items.length ?? 0)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Top 10 repuestos por costo" subtitle="Consumo del periodo">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={consumptionChart} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9 }} />
                  <Tooltip {...chartTooltip} formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="costo" radius={[0, 6, 6, 0]} fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Costo por categoría" subtitle="Distribución del consumo">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={consumptionPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {consumptionPie.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltip} formatter={(value) => formatCurrency(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Repuesto</th>
                    <th className="px-4 py-2">Categoría</th>
                    <th className="px-4 py-2 text-right">Cantidad</th>
                    <th className="px-4 py-2 text-right">Movimientos</th>
                    <th className="px-4 py-2 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {(consumption?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{item.name}</p>
                        <p className="font-mono text-[10px] text-slate-500">{item.internal_code}</p>
                      </td>
                      <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{item.category ?? '—'}</td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{item.quantity.toLocaleString('es-MX')} {item.uom}</td>
                      <td className="px-4 py-2 text-right text-slate-500 dark:text-slate-400">{item.movements}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(item.cost)}</td>
                    </tr>
                  ))}
                  {(consumption?.items ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Sin consumo en el periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : section === 'requests' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Solicitudes" value={String(requests?.total ?? 0)} />
            <Stat label="Abiertas" value={String(requests?.open ?? 0)} tone="amber" />
            <Stat
              label="Atención promedio"
              value={requests?.average_attention_hours != null ? `${requests.average_attention_hours.toFixed(1)} h` : '—'}
              tone="emerald"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="Solicitudes por mes" subtitle="Volumen recibido en el periodo">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={requestsChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip {...chartTooltip} />
                  <Bar dataKey="solicitudes" radius={[6, 6, 0, 0]} fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Solicitudes por estado" subtitle="Situación actual">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={requestsPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                    {requestsPie.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Solicitantes frecuentes</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Solicitante</th>
                    <th className="px-4 py-2 text-center">Solicitudes</th>
                    <th className="px-4 py-2 text-center">Abiertas</th>
                  </tr>
                </thead>
                <tbody>
                  {(requests?.top_requesters ?? []).map((row) => (
                    <tr key={row.name} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 font-semibold text-slate-800 dark:text-slate-100">{row.name}</td>
                      <td className="px-4 py-2 text-center">{row.count}</td>
                      <td className="px-4 py-2 text-center text-amber-600 dark:text-amber-400">{row.open}</td>
                    </tr>
                  ))}
                  {(requests?.top_requesters ?? []).length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Sin solicitudes en el periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Costo total" value={formatCurrency(costs?.totals.total ?? 0)} />
            <Stat label="Mano de obra" value={formatCurrency(costs?.totals.labor ?? 0)} />
            <Stat label="Repuestos" value={formatCurrency(costs?.totals.parts ?? 0)} />
            <Stat label="Horas de trabajo" value={`${(costs?.totals.hours ?? 0).toFixed(1)} h`} />
          </div>

          <ChartCard title="Costo por equipo" subtitle="Mano de obra = tiempo de la OT × tarifa promedio de los asignados">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={(costs?.assets ?? []).slice(0, 10).map((row) => ({
                  name: row.asset.internal_code || row.asset.name,
                  mano: Math.round(row.labor),
                  repuestos: Math.round(row.parts),
                }))}
                layout="vertical"
                margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9 }} />
                <Tooltip {...chartTooltip} formatter={(value) => formatCurrency(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="mano" name="Mano de obra" stackId="costos" fill="#059669" radius={[0, 0, 0, 0]} />
                <Bar dataKey="repuestos" name="Repuestos" stackId="costos" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2">Equipo</th>
                    <th className="px-4 py-2 text-center">OT</th>
                    <th className="px-4 py-2 text-right">Mano de obra</th>
                    <th className="px-4 py-2 text-right">Repuestos</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(costs?.assets ?? []).map((row) => (
                    <tr key={row.asset.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{row.asset.name}</p>
                        <p className="font-mono text-[10px] text-slate-500">{row.asset.internal_code}</p>
                      </td>
                      <td className="px-4 py-2 text-center">{row.orders}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(row.labor)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(row.parts)}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                  {(costs?.assets ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Sin costos en el periodo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const Stat = ({ label, value, tone, hint }: { label: string; value: string; tone?: 'emerald' | 'rose' | 'amber'; hint?: string }) => {
  const color = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'rose' ? 'text-rose-600 dark:text-rose-400'
      : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
};

const ChartCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
    {subtitle && <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
    {children}
  </div>
);
