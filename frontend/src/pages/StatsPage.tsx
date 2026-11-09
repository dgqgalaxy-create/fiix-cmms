import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock, Package, Activity, DollarSign, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import {
  getStatsAging, getStatsConsumption, getStatsReliability, getStatsCosts,
  type AgingResponse, type ConsumptionResponse, type ReliabilityResponse, type CostsResponse,
} from '../api/stats';
import { formatCurrency } from '../utils/currency';
import { formatDateTime } from '../utils/dateUtils';
import { formatWorkOrderFolio } from '../utils/folio';

type Tab = 'aging' | 'consumption' | 'reliability' | 'costs';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'aging', label: 'Antigüedad de OT', icon: <Clock size={15} /> },
  { id: 'consumption', label: 'Consumo de repuestos', icon: <Package size={15} /> },
  { id: 'reliability', label: 'Confiabilidad', icon: <Activity size={15} /> },
  { id: 'costs', label: 'Costos', icon: <DollarSign size={15} /> },
];

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  EN_ESPERA: 'En espera',
  FINALIZADO: 'Finalizado',
  ANULADO: 'Anulado',
};

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Estadística operativa: antigüedad de OT, consumo, confiabilidad y costos. */
export const StatsPage = () => {
  const [tab, setTab] = useState<Tab>('aging');
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => isoDay(new Date()));

  const [aging, setAging] = useState<AgingResponse | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionResponse | null>(null);
  const [reliability, setReliability] = useState<ReliabilityResponse | null>(null);
  const [costs, setCosts] = useState<CostsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [agingData, consumptionData, reliabilityData, costsData] = await Promise.all([
        getStatsAging(),
        getStatsConsumption(from, to),
        getStatsReliability(from, to),
        getStatsCosts(from, to),
      ]);
      setAging(agingData);
      setConsumption(consumptionData);
      setReliability(reliabilityData);
      setCosts(costsData);
    } catch {
      setError('No se pudieron cargar las estadísticas.');
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  const maxBucket = useMemo(
    () => Math.max(1, ...(aging?.buckets.map((bucket) => bucket.count) ?? [1])),
    [aging]
  );

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            <BarChart3 className="text-emerald-600 dark:text-emerald-400" size={30} />
            Estadística
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-300">
            Antigüedad de órdenes, consumo de repuestos, confiabilidad por equipo y costos del periodo.
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

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === item.id
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
      ) : tab === 'aging' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {aging?.buckets.map((bucket) => (
              <div key={bucket.key} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{bucket.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{bucket.count}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(bucket.count / maxBucket) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

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
      ) : tab === 'consumption' ? (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Costo del consumo" value={formatCurrency(consumption?.total_cost ?? 0)} />
            <Stat label="Cantidad total" value={String(consumption?.total_quantity ?? 0)} />
            <Stat label="Repuestos distintos" value={String(consumption?.items.length ?? 0)} />
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
      ) : tab === 'reliability' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
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
        </section>
      ) : (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Costo total" value={formatCurrency(costs?.totals.total ?? 0)} />
            <Stat label="Mano de obra" value={formatCurrency(costs?.totals.labor ?? 0)} />
            <Stat label="Repuestos" value={formatCurrency(costs?.totals.parts ?? 0)} />
            <Stat label="Horas de trabajo" value={`${(costs?.totals.hours ?? 0).toFixed(1)} h`} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Costo por equipo</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mano de obra = tiempo de la OT × tarifa promedio de los técnicos asignados.
              </p>
            </div>
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

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
  </div>
);
