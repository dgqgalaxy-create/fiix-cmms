import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, AlertTriangle, Plus, Play, Square, Trash2, Clock, Activity, Timer, TrendingUp, X,
} from 'lucide-react';
import {
  getDowntimes, createDowntime, closeDowntime, deleteDowntime, getDowntimeStats,
  type AssetDowntime, type DowntimeStats,
} from '../../api/downtimes';
import { formatDateTime } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';

const minutesBetween = (start: string, end?: string | null) =>
  Math.max(0, ((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 60000);

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours < 24) return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours > 0 ? `${days} d ${restHours} h` : `${days} d`;
};

const toLocalInput = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * Pestaña «Paros» del activo: registra paros y muestra MTBF, MTTR y
 * disponibilidad de los últimos 30 días.
 */
export const AssetDowntimes = ({ assetId, canManage }: { assetId: string; canManage: boolean }) => {
  const { user } = useAuth();
  const canDelete = canManage || user?.role === 'ADMINISTRADOR';

  const [stops, setStops] = useState<AssetDowntime[]>([]);
  const [stats, setStats] = useState<DowntimeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [startedAt, setStartedAt] = useState(toLocalInput(new Date()));
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rows, summary] = await Promise.all([
        getDowntimes({ assetId }),
        getDowntimeStats({ assetId }),
      ]);
      setStops(rows);
      setStats(summary);
      setError(null);
    } catch {
      setError('No se pudieron cargar los paros del activo.');
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await createDowntime({
        asset_id: assetId,
        reason: reason.trim() || undefined,
        started_at: startedAt ? new Date(startedAt).toISOString() : undefined,
      });
      setReason('');
      setStartedAt(toLocalInput(new Date()));
      setIsFormOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo registrar el paro.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async (stop: AssetDowntime) => {
    setBusyId(stop.id);
    try {
      await closeDowntime(stop.id);
      await load();
    } catch {
      setError('No se pudo cerrar el paro.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (stop: AssetDowntime) => {
    if (!window.confirm('¿Eliminar este paro del historial?')) return;
    setBusyId(stop.id);
    try {
      await deleteDowntime(stop.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar el paro.');
    } finally {
      setBusyId(null);
    }
  };

  const openStop = stops.find((stop) => !stop.ended_at);

  return (
    <div className="space-y-3">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard icon={<Activity size={14} />} label="Paros (30 d)" value={stats ? String(stats.stops) : '—'} tone="rose" />
        <StatCard
          icon={<Clock size={14} />}
          label="Tiempo parado"
          value={stats ? formatDuration((stats.downtime_hours ?? 0) * 60) : '—'}
          tone="amber"
        />
        <StatCard
          icon={<Timer size={14} />}
          label="MTBF"
          value={stats?.mtbf_hours != null ? `${stats.mtbf_hours.toFixed(1)} h` : '—'}
          tone="sky"
        />
        <StatCard
          icon={<TrendingUp size={14} />}
          label="Disponibilidad"
          value={stats?.availability_pct != null ? `${stats.availability_pct.toFixed(1)}%` : '—'}
          tone="emerald"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {openStop
            ? 'Hay un paro abierto; la máquina se considera detenida.'
            : 'Registra cuándo se detuvo la máquina para medir MTBF y disponibilidad.'}
        </p>
        <button
          type="button"
          onClick={() => setIsFormOpen((value) => !value)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
        >
          {isFormOpen ? <X size={15} /> : <Plus size={15} />}
          {isFormOpen ? 'Cancelar' : 'Registrar paro'}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleCreate} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="downtime-reason">
                Motivo (opcional)
              </label>
              <input
                id="downtime-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Falla mecánica, falta de material…"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="downtime-start">
                Inicio del paro
              </label>
              <input
                id="downtime-start"
                type="datetime-local"
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Iniciar paro
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="mr-2 animate-spin" size={18} /> Cargando paros…
        </div>
      ) : stops.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <Clock size={26} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Sin paros registrados.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Cuando la máquina se detenga, regístralo aquí.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {stops.map((stop) => {
            const isOpen = !stop.ended_at;
            const duration = minutesBetween(stop.started_at, stop.ended_at);
            return (
              <li
                key={stop.id}
                className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
                  isOpen
                    ? 'border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/30'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isOpen ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/50' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                  {isOpen ? <Square size={14} /> : <Clock size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {stop.reason || (isOpen ? 'Paro en curso' : 'Paro sin motivo')}
                    {isOpen && (
                      <span className="ml-2 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Abierto
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDateTime(stop.started_at)} → {stop.ended_at ? formatDateTime(stop.ended_at) : 'en curso'}
                    {' · '}{formatDuration(duration)}
                    {stop.reported_by?.name ? ` · ${stop.reported_by.name}` : ''}
                    {stop.work_order ? ` · OT-${stop.work_order.folio}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => void handleClose(stop)}
                      disabled={busyId === stop.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      title="Finalizar el paro ahora"
                    >
                      {busyId === stop.id ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} />}
                      Finalizar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(stop)}
                      disabled={busyId === stop.id}
                      className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                      title="Eliminar paro"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const toneMap = {
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
} as const;

const StatCard = ({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof toneMap;
}) => (
  <div className={`rounded-xl border px-2.5 py-2 ${toneMap[tone]}`}>
    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
      {icon} {label}
    </p>
    <p className="mt-0.5 text-sm font-bold">{value}</p>
  </div>
);
