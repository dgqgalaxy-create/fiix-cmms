import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gauge, Search, RefreshCw, Loader2, AlertTriangle, CheckCircle2, ArrowDownToLine, ExternalLink } from 'lucide-react';
import { getMeters, type Meter } from '../api/meters';
import { ReadingModal } from '../components/meters/ReadingModal';
import { formatDateTime } from '../utils/dateUtils';

const numberFmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const fmt = (value: number | null | undefined) => numberFmt.format(Number(value ?? 0));
const UNIT_SHORT: Record<string, string> = {
  HORAS: 'h', KILOMETROS: 'km', CICLOS: 'ciclos', PIEZAS: 'pzas', OTRO: '',
};
const unitShort = (unit: string) => UNIT_SHORT[unit] ?? unit.toLowerCase();

/** Próximo servicio de un medidor (umbral GTE más cercano). */
const nextService = (meter: Meter) => {
  const gte = meter.triggers
    .filter((t) => t.is_active && t.condition === 'GTE')
    .sort((a, b) => a.threshold - b.threshold)[0];
  if (!gte) return null;
  const remaining = gte.threshold - meter.current_value;
  return { trigger: gte, remaining };
};

/**
 * Página global de medidores: todos los puntos de medición de la planta, con la
 * zona para ubicarlos y dos acciones claras: registrar medición o ir al activo.
 */
export const MetersPage = () => {
  const navigate = useNavigate();
  const [meters, setMeters] = useState<Meter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [modalMeter, setModalMeter] = useState<Meter | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setMeters(await getMeters());
      setError(null);
    } catch {
      setError('No se pudieron cargar los medidores.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 9000);
    return () => clearTimeout(timer);
  }, [banner]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return meters
      .filter((meter) => {
        if (!term) return true;
        const haystack = `${meter.name} ${meter.asset?.name ?? ''} ${meter.asset?.internal_code ?? ''} ${meter.asset?.zone?.name ?? ''}`.toLowerCase();
        return haystack.includes(term);
      })
      .filter((meter) => {
        if (!onlyPending) return true;
        const next = nextService(meter);
        return Boolean(next && next.remaining <= 0);
      })
      .sort((a, b) => {
        const ra = nextService(a)?.remaining ?? Number.POSITIVE_INFINITY;
        const rb = nextService(b)?.remaining ?? Number.POSITIVE_INFINITY;
        if (ra !== rb) return ra - rb;
        return (a.asset?.zone?.name ?? '').localeCompare(b.asset?.zone?.name ?? '');
      });
  }, [meters, search, onlyPending]);

  const pendingCount = meters.filter((meter) => {
    const next = nextService(meter);
    return Boolean(next && next.remaining <= 0);
  }).length;

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            <Gauge className="text-emerald-600 dark:text-emerald-400" size={30} />
            Medidores
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-300">
            Todos los puntos de medición de la planta. Registra la lectura y el sistema avisa si toca servicio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {banner && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={16} /> {banner}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-96">
          <Search size={18} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por zona, activo o medidor…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {filtered.length} de {meters.length} medidores
          </span>
          <button
            type="button"
            onClick={() => setOnlyPending((prev) => !prev)}
            aria-pressed={onlyPending}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold transition-colors ${
              onlyPending
                ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <AlertTriangle size={14} /> Vencidos ({pendingCount})
          </button>
        </div>
      </div>

      {isLoading && meters.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="mr-2 animate-spin" size={18} /> Cargando medidores…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Gauge size={30} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {meters.length === 0 ? 'Todavía no hay medidores registrados.' : 'Ningún medidor coincide con el filtro.'}
          </p>
          {meters.length === 0 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Crea el primero desde Activos → abre un equipo → pestaña «Medidores».
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((meter) => {
            const next = nextService(meter);
            const overdue = Boolean(next && next.remaining <= 0);
            const unit = unitShort(meter.unit);

            return (
              <div
                key={meter.id}
                className={`grid gap-3 rounded-2xl border bg-white p-3 shadow-sm dark:bg-slate-900 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] sm:items-center ${
                  overdue ? 'border-rose-300 dark:border-rose-800' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100" title={meter.name}>
                    {meter.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {meter.asset?.zone?.name ?? 'Sin zona'}
                    </span>
                    <span className="truncate" title={meter.asset?.name ?? ''}>{meter.asset?.name ?? 'Activo'}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {meter.unit}
                    {meter.last_reading_at ? ` · última lectura ${formatDateTime(meter.last_reading_at)}` : ' · sin lecturas'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Actual</p>
                    <p className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">
                      {fmt(meter.current_value)} <span className="text-sm font-semibold text-slate-400">{unit}</span>
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Próximo servicio</p>
                    {next ? (
                      <>
                        <p className={`text-sm font-semibold ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                          {fmt(next.trigger.threshold)} {unit}
                          <span className={`ml-1 font-normal ${overdue ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
                            {overdue ? '· vencido' : `· faltan ${fmt(next.remaining)} ${unit}`}
                          </span>
                        </p>
                        <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">{next.trigger.name}</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Sin disparador</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setModalMeter(meter)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <ArrowDownToLine size={15} /> Registrar medición
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/assets?asset=${meter.asset_id}&from=${encodeURIComponent('/meters')}`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ExternalLink size={15} /> Ir al activo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalMeter && (
        <ReadingModal
          meter={modalMeter}
          onClose={() => setModalMeter(null)}
          onSaved={async (message) => {
            setModalMeter(null);
            setBanner(message);
            await load();
          }}
        />
      )}
    </div>
  );
};
