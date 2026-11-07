import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Package, MapPin } from 'lucide-react';
import { getItemAssets, type ItemAssetUsage } from '../../api/inventory';

/** Pestaña «Equipos» del detalle de un repuesto: dónde está instalado. */
export const ItemAssetsTab = ({ itemId }: { itemId: string }) => {
  const [rows, setRows] = useState<ItemAssetUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getItemAssets(itemId)
      .then((data) => { if (!cancelled) { setRows(data); setError(null); } })
      .catch(() => { if (!cancelled) setError('No se pudieron cargar los equipos.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [itemId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="mr-2 animate-spin" size={18} /> Cargando equipos…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertTriangle size={16} /> {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <Package size={26} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Este repuesto no está asignado a ningún equipo.</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Se asigna desde la ficha del activo, en la sección de repuestos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {rows.length} equipo{rows.length === 1 ? '' : 's'} con este repuesto asignado.
      </p>
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.asset.name}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-mono">{row.asset.internal_code}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {row.asset.zone?.name ?? 'Sin zona'}
              </span>
              {row.asset.is_critical && (
                <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  Crítico
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cantidad</p>
            <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{row.quantity}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
