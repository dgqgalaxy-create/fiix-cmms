import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Loader2, Minus, Package, Plus, X } from 'lucide-react';
import { consumeKit, getKits, type Kit } from '../../api/kits';
import { useEscapeKey } from '../../hooks/useEscapeKey';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
  workOrderFolio?: number | string | null;
  onConsumed: (message: string) => void;
};

/**
 * Consumo de un kit completo desde el detalle de la OT.
 * Muestra la disponibilidad real antes de confirmar y el backend descuenta
 * todo o nada: si un repuesto no alcanza, no se descuenta ninguno.
 */
export function ConsumeKitModal({ isOpen, onClose, workOrderId, workOrderFolio, onConsumed }: Props) {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(() => {
    if (!submitting) onClose();
  }, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId(null);
    setQuantity(1);
    setError(null);
    setSubmitting(false);
    setLoading(true);
    getKits()
      .then((data) => {
        const usable = data.filter((kit) => kit.is_active && kit.items.length > 0);
        setKits(usable);
        setSelectedId(usable[0]?.id ?? null);
      })
      .catch(() => setError('No se pudieron cargar los kits.'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const selected = useMemo(() => kits.find((kit) => kit.id === selectedId) ?? null, [kits, selectedId]);

  const availability = useMemo(() => {
    if (!selected) return { available: 0, rows: [] as Array<{ name: string; code: string; needed: number; stock: number; unit: string | null; enough: boolean }> };
    const rows = selected.items.map((row) => {
      const needed = row.quantity * quantity;
      return {
        name: row.name,
        code: row.internal_code,
        needed,
        stock: row.stock,
        unit: row.unit ?? null,
        enough: row.stock >= needed,
      };
    });
    const available = selected.items.reduce(
      (min, row) => Math.min(min, Math.floor(row.stock / (row.quantity || 1))),
      Number.POSITIVE_INFINITY
    );
    return { available: Number.isFinite(available) ? available : 0, rows };
  }, [selected, quantity]);

  const canConsume = Boolean(selected) && quantity >= 1 && quantity <= availability.available && !submitting;

  const handleConsume = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await consumeKit(selected.id, { work_order_id: workOrderId, quantity });
      onConsumed(result.message);
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.error;
      setError(detail || 'No se pudo consumir el kit.');
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Boxes size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Consumir kit en la orden</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Descuenta todos los repuestos del kit y los liga a la OT{workOrderFolio ? ` ${workOrderFolio}` : ''}.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin text-emerald-600" /> Cargando kits…
            </div>
          )}

          {!loading && kits.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
              No hay kits activos con repuestos. Créalos en Inventario → Kits.
            </div>
          )}

          {!loading && kits.length > 0 && (
            <>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Kit</label>
              <select
                value={selectedId ?? ''}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setError(null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {kits.map((kit) => (
                  <option key={kit.id} value={kit.id}>
                    {kit.name} · {kit.items.length} repuesto(s)
                  </option>
                ))}
              </select>

              {selected?.description && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{selected.description}</p>
              )}

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Cantidad de kits</label>
                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1 dark:border-slate-700 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                      disabled={quantity <= 1 || submitting}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((value) => Math.min(50, value + 1))}
                      disabled={quantity >= 50 || submitting}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <p className="pb-1 text-xs text-slate-500 dark:text-slate-400">
                  Disponibles según stock actual: <strong className="text-slate-700 dark:text-slate-200">{availability.available}</strong> kit(s)
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2">Repuesto</th>
                      <th className="px-3 py-2 text-right">Necesario</th>
                      <th className="px-3 py-2 text-right">En almacén</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availability.rows.map((row) => (
                      <tr key={`${row.code}-${row.name}`} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-1.5">
                          <span className="mr-2 font-mono text-[10px] text-slate-400">{row.code}</span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">{row.name}</span>
                        </td>
                        <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${row.enough ? 'text-slate-600 dark:text-slate-300' : 'text-rose-600'}`}>
                          {row.needed} {row.unit ?? ''}
                        </td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${row.enough ? 'text-emerald-600' : 'text-rose-600 font-bold'}`}>
                          {row.stock} {row.unit ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {availability.available === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                  <AlertTriangle size={14} /> No hay stock suficiente para armar un kit completo.
                </p>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConsume()}
            disabled={!canConsume}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
            Consumir kit
          </button>
        </div>
      </div>
    </div>
  );
}
