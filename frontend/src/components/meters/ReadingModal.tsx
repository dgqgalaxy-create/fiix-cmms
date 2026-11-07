import { useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { addMeterReading, type Meter } from '../../api/meters';

const overlay = 'fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm';
const panel = 'w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900';
const inputCls = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const labelCls = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300';

const numberFmt = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const fmt = (value: number | null | undefined) => numberFmt.format(Number(value ?? 0));
const UNIT_SHORT: Record<string, string> = {
  HORAS: 'h', KILOMETROS: 'km', CICLOS: 'ciclos', PIEZAS: 'pzas', OTRO: '',
};
const unitShort = (unit: string) => UNIT_SHORT[unit] ?? unit.toLowerCase();

/**
 * Alta de una lectura con confirmación de las OT que se hayan disparado.
 * Se usa tanto desde la pestaña Medidores del activo como desde la página global.
 */
export const ReadingModal = ({
  meter, onClose, onSaved,
}: {
  meter: Meter;
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}) => {
  const [value, setValue] = useState(String(meter.current_value ?? ''));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fired, setFired] = useState<string[] | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Escribe un número mayor o igual a cero.');
      return;
    }
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
