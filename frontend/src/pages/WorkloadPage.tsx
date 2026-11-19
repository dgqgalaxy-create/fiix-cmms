import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Loader2, RefreshCw, Scale, UserCheck, Users } from 'lucide-react';
import { getWorkload, type WorkloadResponse, type WorkloadRow } from '../api/workload';
import { getWorkOrderById, type WorkOrder } from '../api/workOrders';
import { WorkloadOrdersModal } from '../components/workload/WorkloadOrdersModal';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { getZones } from '../api/zones';
import type { Zone } from '../api/zones';

const DAY_LABELS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const SHIFT_TITLES: Record<string, string> = {
  MIXTO: 'Mixto',
  '4X4_FIJO': '4x4 fijo',
  '4X4_ROTATORIO': '4x4 rotatorio',
};

const loadStyles: Record<WorkloadRow['load_level'], { bar: string; text: string; label: string }> = {
  alta: { bar: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300', label: 'Alta' },
  media: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', label: 'Media' },
  baja: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'Baja' },
};

const dayCountStyle = (count: number): string => {
  if (count >= 4) return 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300';
  if (count >= 2) return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  if (count === 1) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  return 'bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-600';
};

export function WorkloadPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTech, setDetailTech] = useState<WorkloadRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getWorkload({ days, zoneIds: zoneId ? [zoneId] : [] });
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo cargar la carga de trabajo.');
    } finally {
      setLoading(false);
    }
  }, [days, zoneId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getZones().then(setZones).catch(() => undefined);
  }, []);

  const dayHeaders = useMemo(() => {
    if (!data) return [] as Array<{ key: string; label: string }>;
    return data.rows[0]?.per_day?.map((day) => {
      const date = new Date(day.date);
      return {
        key: day.date,
        label: `${DAY_LABELS[date.getUTCDay()]} ${date.getUTCDate()}`,
      };
    }) ?? [];
  }, [data]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            <Scale className="text-emerald-600" size={26} /> Carga de trabajo
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
            Quién tiene cuántas órdenes abiertas y qué días se concentra la carga, para asignar sin sobrecargar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">Todas las zonas</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
            {[7, 14, 21].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                  days === option ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {option} días
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
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Users size={14} /> OT abiertas
            </div>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{data.totals.open_wos}</p>
            <p className="text-[11px] text-slate-500">
              {data.totals.unassigned} sin asignar · promedio {data.totals.avg_open} por técnico
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <CalendarDays size={14} /> Vencidas
            </div>
            <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">{data.totals.overdue}</p>
            <p className="text-[11px] text-slate-500">Con fecha límite ya pasada</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <UserCheck size={14} /> Técnicos
            </div>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{data.totals.technicians}</p>
            <p className="text-[11px] text-slate-500">Activos con o sin horario</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <Scale size={14} /> Sugerencia
            </div>
            <p className="mt-1 truncate text-sm font-black text-emerald-800 dark:text-emerald-200">
              {data.suggestion ? data.suggestion.name : 'Sin datos'}
            </p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
              {data.suggestion ? data.suggestion.reason : 'Registra horarios para sugerir a quién asignar'}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            <CalendarDays size={14} />
            {data
              ? `${new Date(data.from).toLocaleDateString()} — ${new Date(data.to).toLocaleDateString()}`
              : 'Cargando periodo…'}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Cada celda cuenta las OT programadas o con fecha límite ese día.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                <th className="px-3 py-2">Técnico</th>
                <th className="px-3 py-2 text-right">Abiertas</th>
                <th className="px-3 py-2 text-right">En proceso</th>
                <th className="px-3 py-2 text-right">Vencidas</th>
                <th className="px-3 py-2 text-right">Horas turno</th>
                <th className="px-3 py-2">Carga</th>
                {dayHeaders.map((day) => (
                  <th key={day.key} className="px-1 py-2 text-center">{day.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={6 + dayHeaders.length} className="px-4 py-10 text-center text-sm text-slate-500">
                    <Loader2 className="mx-auto mb-2 animate-spin text-emerald-600" size={20} /> Calculando…
                  </td>
                </tr>
              )}
              {data?.rows.map((row) => {
                const style = loadStyles[row.load_level];
                return (
                  <tr key={row.user_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                    <td className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                      <button type="button" onClick={() => setDetailTech(row)} className="text-left">
                        <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{row.name}</span>
                        <span className="block text-[10.5px] text-slate-500 dark:text-slate-400">
                          {row.role === 'GESTIONADOR' ? 'Gestionador' : 'Técnico'}
                          {row.shift_code ? ` · ${SHIFT_TITLES[row.shift_code] ?? row.shift_code}` : ' · sin horario'}
                        </span>
                      </button>
                    </td>
                    <td className="border-t border-slate-100 px-3 py-2 text-right text-xs font-bold tabular-nums text-slate-700 dark:border-slate-800 dark:text-slate-200">
                      {row.open_wos}
                    </td>
                    <td className="border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {row.in_progress}
                    </td>
                    <td className={`border-t border-slate-100 px-3 py-2 text-right text-xs font-bold tabular-nums dark:border-slate-800 ${row.overdue > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {row.overdue}
                    </td>
                    <td className="border-t border-slate-100 px-3 py-2 text-right text-xs tabular-nums text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {row.scheduled_hours > 0 ? `${row.scheduled_hours} h` : '—'}
                    </td>
                    <td className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <span className={`block h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, row.load_pct)}%` }} />
                        </span>
                        <span className={`text-[10.5px] font-bold ${style.text}`}>{row.load_pct}%</span>
                      </div>
                    </td>
                    {row.per_day.map((day) => (
                      <td key={day.date} className="border-t border-slate-100 px-1 py-2 text-center dark:border-slate-800">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ${dayCountStyle(day.count)}`}>
                          {day.count || '·'}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
              {data && data.rows.length === 0 && (
                <tr>
                  <td colSpan={6 + dayHeaders.length} className="px-4 py-10 text-center text-sm text-slate-500">
                    No hay técnicos activos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        La carga relativa compara las OT abiertas de cada persona contra el promedio del equipo (100 % = promedio).
        Las horas de turno salen del calendario de Horarios (patrones mixto y 4x4, excepciones y turnos importados).
        Haz clic en el nombre para abrir su ficha de desempeño.
      </p>

      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
        <button type="button" onClick={() => navigate('/stats/team')} className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline dark:text-emerald-300">
          Ver desempeño del equipo <ArrowUpRight size={12} />
        </button>
        <span className="inline-flex items-center gap-1 opacity-60">
          <ChevronLeft size={12} /> Periodo calculado hacia adelante desde hoy <ChevronRight size={12} />
        </span>
      </div>
      {detailTech && !selectedOrder && (
        <WorkloadOrdersModal
          row={detailTech}
          loadingOrderId={loadingOrderId}
          onClose={() => setDetailTech(null)}
          onOpenOrder={(orderId) => {
            setLoadingOrderId(orderId);
            getWorkOrderById(orderId)
              .then((order) => setSelectedOrder(order))
              .catch(() => setError('No se pudo abrir la orden.'))
              .finally(() => setLoadingOrderId(null));
          }}
          onOpenPerformance={() => navigate('/stats/team?period=30')}
        />
      )}

      {selectedOrder && (
        <WorkOrderDetailModal
          workOrder={selectedOrder}
          isOpen
          onClose={() => setSelectedOrder(null)}
          onUpdate={async (id) => {
            const fresh = await getWorkOrderById(id);
            setSelectedOrder(fresh);
            void load();
            return fresh;
          }}
        />
      )}
    </div>
  );
}
