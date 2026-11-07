import { useCallback, useEffect, useState } from 'react';
import {
  Gauge, Plus, X, Loader2, Trash2, Pencil, Bell, ArrowDownToLine, CheckCircle2, AlertTriangle, Power,
} from 'lucide-react';
import {
  getMeters, createMeter, updateMeter, deleteMeter,
  getMeterReadings, addMeterReading, deleteMeterReading,
  createMeterTrigger, updateMeterTrigger, deleteMeterTrigger,
  type Meter, type MeterReading, type MeterTrigger, type MeterUnit, type MeterTriggerCondition,
} from '../../api/meters';
import { formatDateTime } from '../../utils/dateUtils';

const UNIT_OPTIONS: { value: MeterUnit; label: string }[] = [
  { value: 'HORAS', label: 'Horas (horómetro)' },
  { value: 'KILOMETROS', label: 'Kilómetros (odómetro)' },
  { value: 'CICLOS', label: 'Ciclos' },
  { value: 'PIEZAS', label: 'Piezas' },
  { value: 'OTRO', label: 'Otra unidad' },
];

const UNIT_SHORT: Record<string, string> = {
  HORAS: 'h',
  KILOMETROS: 'km',
  CICLOS: 'ciclos',
  PIEZAS: 'pzas',
  OTRO: '',
};

const numberFmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const fmt = (value: number | null | undefined) => numberFmt.format(Number(value ?? 0));

const unitShort = (unit: string) => UNIT_SHORT[unit] ?? unit.toLowerCase();

interface Props {
  assetId: string;
  assetName?: string;
  canManage: boolean;
}

/**
 * Medidores de uso del activo: horómetro, odómetro, ciclos…
 * Cada medidor muestra su lectura actual, el próximo servicio y sus disparadores.
 */
export const AssetMeters = ({ assetId, assetName, canManage }: Props) => {
  const [meters, setMeters] = useState<Meter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [meterForm, setMeterForm] = useState<{ mode: 'create' | 'edit'; meter?: Meter } | null>(null);
  const [readingFor, setReadingFor] = useState<Meter | null>(null);
  const [triggersFor, setTriggersFor] = useState<Meter | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setMeters(await getMeters(assetId));
      setError(null);
    } catch {
      setError('No se pudieron cargar los medidores.');
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 8000);
    return () => clearTimeout(timer);
  }, [success]);

  const handleDeleteMeter = async (meter: Meter) => {
    if (!window.confirm(`¿Eliminar el medidor «${meter.name}» y todo su historial?`)) return;
    try {
      await deleteMeter(meter.id);
      await load();
    } catch {
      setError('No se pudo eliminar el medidor.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="mr-2 animate-spin" size={18} /> Cargando medidores…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Gauge size={16} className="text-emerald-600 dark:text-emerald-400" /> Medidores de uso
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Horómetro, odómetro o ciclos de {assetName || 'este activo'}. Al llegar al umbral se genera la OT.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setMeterForm({ mode: 'create' })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <Plus size={16} /> Nuevo medidor
          </button>
        )}
      </div>

      {meters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <Gauge size={28} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Este activo aún no tiene medidores.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Ejemplo: un horómetro que dispare el cambio de aceite cada 250 horas.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {meters.map((meter) => {
            const activeTriggers = meter.triggers.filter((t) => t.is_active);
            const nextGte = activeTriggers
              .filter((t) => t.condition === 'GTE')
              .sort((a, b) => a.threshold - b.threshold)[0];
            const nextLte = activeTriggers
              .filter((t) => t.condition === 'LTE')
              .sort((a, b) => b.threshold - a.threshold)[0];
            const remaining = nextGte ? nextGte.threshold - meter.current_value : null;
            const unit = unitShort(meter.unit);

            return (
              <div
                key={meter.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100" title={meter.name}>
                      {meter.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {meter.is_active ? 'Activo' : 'Inactivo'}
                      {meter.last_reading_at ? ` · última lectura ${formatDateTime(meter.last_reading_at)}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {meter.unit}
                  </span>
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-black tabular-nums text-slate-900 dark:text-white">
                    {fmt(meter.current_value)}
                  </span>
                  <span className="pb-1 text-sm font-semibold text-slate-400">{unit}</span>
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  {nextGte ? (
                    <p className={remaining != null && remaining <= 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}>
                      Próximo servicio: <span className="font-semibold">{fmt(nextGte.threshold)} {unit}</span>
                      {' · '}
                      {remaining != null && remaining > 0
                        ? `faltan ${fmt(remaining)} ${unit}`
                        : 'umbral alcanzado'}
                      <span className="text-slate-400"> ({nextGte.name})</span>
                    </p>
                  ) : nextLte ? (
                    <p className="text-slate-600 dark:text-slate-300">
                      Se dispara al bajar a <span className="font-semibold">{fmt(nextLte.threshold)} {unit}</span>
                      <span className="text-slate-400"> ({nextLte.name})</span>
                    </p>
                  ) : (
                    <p className="text-slate-400 dark:text-slate-500">Sin disparadores activos.</p>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReadingFor(meter)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                  >
                    <ArrowDownToLine size={14} /> Registrar lectura
                  </button>
                  <button
                    type="button"
                    onClick={() => setTriggersFor(meter)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Bell size={14} /> Disparadores ({meter.triggers.length})
                  </button>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => setMeterForm({ mode: 'edit', meter })}
                        aria-label={`Editar ${meter.name}`}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteMeter(meter)}
                        aria-label={`Eliminar ${meter.name}`}
                        className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meterForm && (
        <MeterFormModal
          assetId={assetId}
          mode={meterForm.mode}
          meter={meterForm.meter}
          onClose={() => setMeterForm(null)}
          onSaved={async (message) => {
            setMeterForm(null);
            setSuccess(message);
            await load();
          }}
        />
      )}

      {readingFor && (
        <ReadingModal
          meter={readingFor}
          onClose={() => setReadingFor(null)}
          onSaved={async (message) => {
            setReadingFor(null);
            setSuccess(message);
            await load();
          }}
        />
      )}

      {triggersFor && (
        <TriggersModal
          meter={triggersFor}
          canManage={canManage}
          onClose={() => setTriggersFor(null)}
          onChanged={load}
        />
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Modales                                                                    */
/* -------------------------------------------------------------------------- */

const overlay = 'fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm';
const panel = 'w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900';
const inputCls = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const labelCls = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';

const MeterFormModal = ({
  assetId, mode, meter, onClose, onSaved,
}: {
  assetId: string;
  mode: 'create' | 'edit';
  meter?: Meter;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) => {
  const [name, setName] = useState(meter?.name ?? '');
  const [unit, setUnit] = useState<MeterUnit>((meter?.unit as MeterUnit) ?? 'HORAS');
  const [initialValue, setInitialValue] = useState('');
  const [notes, setNotes] = useState(meter?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError('Escribe un nombre para el medidor.'); return; }
    setSaving(true);
    setError(null);
    try {
      if (mode === 'create') {
        const parsed = initialValue.trim() === '' ? null : Number(initialValue);
        if (parsed != null && (!Number.isFinite(parsed) || parsed < 0)) {
          setError('La lectura inicial debe ser un número mayor o igual a cero.');
          setSaving(false);
          return;
        }
        await createMeter({ asset_id: assetId, name: name.trim(), unit, initial_value: parsed, notes: notes.trim() || undefined });
        await onSaved(`Medidor «${name.trim()}» creado.`);
      } else if (meter) {
        await updateMeter(meter.id, { name: name.trim(), unit, notes: notes.trim() || null });
        await onSaved(`Medidor «${name.trim()}» actualizado.`);
      }
    } catch {
      setError('No se pudo guardar el medidor.');
      setSaving(false);
    }
  };

  return (
    <div className={overlay} onClick={onClose}>
      <form className={panel} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {mode === 'create' ? 'Nuevo medidor' : 'Editar medidor'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="meter-name">Nombre</label>
            <input id="meter-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Horómetro principal" autoFocus />
          </div>
          <div>
            <label className={labelCls} htmlFor="meter-unit">Unidad</label>
            <select id="meter-unit" className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value as MeterUnit)}>
              {UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          {mode === 'create' && (
            <div>
              <label className={labelCls} htmlFor="meter-initial">Lectura actual (opcional)</label>
              <input id="meter-initial" className={inputCls} value={initialValue} onChange={(e) => setInitialValue(e.target.value)} inputMode="decimal" placeholder="0" />
              <p className="mt-1 text-[11px] text-slate-500">Si el equipo ya lleva horas/km, escríbelas aquí para arrancar el conteo.</p>
            </div>
          )}
          <div>
            <label className={labelCls} htmlFor="meter-notes">Notas (opcional)</label>
            <textarea id="meter-notes" className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {saving && <Loader2 size={15} className="animate-spin" />} Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

const ReadingModal = ({
  meter, onClose, onSaved,
}: {
  meter: Meter;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) => {
  const [value, setValue] = useState(String(meter.current_value ?? ''));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fired, setFired] = useState<string[] | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) { setError('Escribe un número mayor o igual a cero.'); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await addMeterReading(meter.id, { value: parsed, notes: notes.trim() || undefined });
      if (result.fired_work_orders.length > 0) {
        setFired(result.fired_work_orders.map((wo) => wo.trigger_name));
        setSaving(false);
        return;
      }
      await onSaved(`Lectura ${fmt(parsed)} ${unitShort(meter.unit)} registrada.`);
    } catch {
      setError('No se pudo registrar la lectura.');
      setSaving(false);
    }
  };

  if (fired) {
    return (
      <div className={overlay} onClick={onClose}>
        <div className={panel} onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={22} />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lectura registrada</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Se alcanzó el umbral y se generaron estas órdenes de trabajo:
          </p>
          <ul className="mt-2 list-inside list-disc text-sm font-medium text-slate-800 dark:text-slate-100">
            {fired.map((name) => <li key={name}>{name}</li>)}
          </ul>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => void onSaved(`Lectura ${fmt(Number(value))} ${unitShort(meter.unit)} registrada · ${fired.length} OT generada(s).`)}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={overlay} onClick={onClose}>
      <form className={panel} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Registrar lectura</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {meter.name} · actual {fmt(meter.current_value)} {unitShort(meter.unit)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls} htmlFor="reading-value">Lectura ({meter.unit})</label>
            <input
              id="reading-value"
              className={`${inputCls} text-lg font-bold`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="reading-notes">Notas (opcional)</label>
            <input id="reading-notes" className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {saving && <Loader2 size={15} className="animate-spin" />} Guardar lectura
          </button>
        </div>
      </form>
    </div>
  );
};

const TriggersModal = ({
  meter, canManage, onClose, onChanged,
}: {
  meter: Meter;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) => {
  const [triggers, setTriggers] = useState<MeterTrigger[]>(meter.triggers);
  const [name, setName] = useState('');
  const [condition, setCondition] = useState<MeterTriggerCondition>('GTE');
  const [threshold, setThreshold] = useState('');
  const [interval, setIntervalValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReadings, setShowReadings] = useState(false);
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [loadingReadings, setLoadingReadings] = useState(false);

  const reload = async () => {
    const meters = await getMeters(meter.asset_id);
    const updated = meters.find((m) => m.id === meter.id);
    if (updated) setTriggers(updated.triggers);
    await onChanged();
  };

  const loadReadings = async () => {
    setShowReadings(true);
    setLoadingReadings(true);
    try {
      setReadings(await getMeterReadings(meter.id, 20));
    } finally {
      setLoadingReadings(false);
    }
  };

  const addTrigger = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedThreshold = Number(threshold);
    const parsedInterval = interval.trim() === '' ? null : Number(interval);
    if (!name.trim() || !Number.isFinite(parsedThreshold)) { setError('Escribe el nombre y un umbral válido.'); return; }
    if (parsedInterval != null && (!Number.isFinite(parsedInterval) || parsedInterval <= 0)) {
      setError('El intervalo debe ser un número mayor que cero.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createMeterTrigger(meter.id, {
        name: name.trim(),
        condition,
        threshold: parsedThreshold,
        interval: parsedInterval,
      });
      setName(''); setThreshold(''); setIntervalValue('');
      await reload();
    } catch {
      setError('No se pudo crear el disparador.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTrigger = async (trigger: MeterTrigger) => {
    try {
      await updateMeterTrigger(meter.id, trigger.id, { is_active: !trigger.is_active });
      await reload();
    } catch {
      setError('No se pudo cambiar el estado del disparador.');
    }
  };

  const removeTrigger = async (trigger: MeterTrigger) => {
    if (!window.confirm(`¿Eliminar el disparador «${trigger.name}»?`)) return;
    try {
      await deleteMeterTrigger(meter.id, trigger.id);
      await reload();
    } catch {
      setError('No se pudo eliminar el disparador.');
    }
  };

  const removeReading = async (reading: MeterReading) => {
    if (!window.confirm('¿Eliminar esta lectura? Se recalculará el valor actual del medidor.')) return;
    try {
      await deleteMeterReading(meter.id, reading.id);
      setReadings(await getMeterReadings(meter.id, 20));
      await onChanged();
    } catch {
      setError('No se pudo eliminar la lectura.');
    }
  };

  return (
    <div className={overlay} onClick={onClose}>
      <div className={`${panel} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Disparadores</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {meter.name} · actual {fmt(meter.current_value)} {unitShort(meter.unit)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {triggers.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500 dark:border-slate-700">
              Sin disparadores. Añade uno para que se genere la OT automáticamente.
            </p>
          )}
          {triggers.map((trigger) => (
            <div key={trigger.id} className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{trigger.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {trigger.condition === 'GTE' ? 'Cuando llegue a' : 'Cuando baje a'}{' '}
                    <span className="font-semibold">{fmt(trigger.threshold)} {unitShort(meter.unit)}</span>
                    {trigger.interval ? ` · se repite cada ${fmt(trigger.interval)} ${unitShort(meter.unit)}` : ' · una sola vez'}
                    {!trigger.is_active && ' · inactivo'}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleTrigger(trigger)}
                      title={trigger.is_active ? 'Desactivar' : 'Activar'}
                      className={`rounded-lg p-1.5 ${trigger.is_active ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                      <Power size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeTrigger(trigger)}
                      title="Eliminar"
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {canManage && (
          <form onSubmit={addTrigger} className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nuevo disparador</p>
            <input className={inputCls} placeholder="Ej. Cambio de aceite" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls} htmlFor="trig-cond">Condición</label>
                <select id="trig-cond" className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value as MeterTriggerCondition)}>
                  <option value="GTE">Al llegar a</option>
                  <option value="LTE">Al bajar a</option>
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="trig-threshold">Umbral</label>
                <input id="trig-threshold" className={inputCls} value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" placeholder="250" />
              </div>
            </div>
            <div>
              <label className={labelCls} htmlFor="trig-interval">Repetir cada (opcional)</label>
              <input id="trig-interval" className={inputCls} value={interval} onChange={(e) => setIntervalValue(e.target.value)} inputMode="decimal" placeholder="250" />
              <p className="mt-1 text-[11px] text-slate-500">Déjalo vacío para que se dispare una sola vez.</p>
            </div>
            <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-700">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Añadir disparador
            </button>
          </form>
        )}

        {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          {!showReadings ? (
            <button
              type="button"
              onClick={() => void loadReadings()}
              className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Ver últimas lecturas
            </button>
          ) : (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Últimas lecturas</p>
              {loadingReadings ? (
                <p className="text-xs text-slate-500">Cargando…</p>
              ) : readings.length === 0 ? (
                <p className="text-xs text-slate-500">Sin lecturas registradas.</p>
              ) : (
                <ul className="space-y-1">
                  {readings.map((reading) => (
                    <li key={reading.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs dark:bg-slate-800/60">
                      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        {fmt(reading.value)} {unitShort(meter.unit)}
                      </span>
                      <span className="truncate text-slate-500 dark:text-slate-400">
                        {formatDateTime(reading.reading_at)}
                        {reading.created_by?.name ? ` · ${reading.created_by.name}` : ''}
                      </span>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void removeReading(reading)}
                          className="shrink-0 rounded p-1 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40"
                          aria-label="Eliminar lectura"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
