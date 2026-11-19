import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Plus, Tags, Trash2, Wrench } from 'lucide-react';
import {
  createAssetCategory,
  createWorkOrderCategory,
  deleteAssetCategory,
  deleteWorkOrderCategory,
  getAssetCategories,
  getWorkOrderCategories,
  updateAssetCategory,
  updateWorkOrderCategory,
  type AssetCategory,
  type WorkOrderCategory,
} from '../../api/categories';
import { useAuth } from '../../context/AuthContext';

type Kind = 'asset' | 'work_order';

/**
 * Administración de categorías de activos y de órdenes de trabajo.
 * Son aditivas: si una categoría está en uso, sólo se puede desactivar.
 */
export function CategoriesSettings() {
  const { hasPermission } = useAuth();
  const canAssets = hasPermission('MANAGE_ASSETS');
  const canOrders = hasPermission('EDIT_WORK_ORDERS');

  const [assetCategories, setAssetCategories] = useState<AssetCategory[]>([]);
  const [orderCategories, setOrderCategories] = useState<WorkOrderCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newName, setNewName] = useState<Record<Kind, string>>({ asset: '', work_order: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assets, orders] = await Promise.all([getAssetCategories(), getWorkOrderCategories()]);
      setAssetCategories(assets);
      setOrderCategories(orders);
    } catch {
      setError('No se pudieron cargar las categorías.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 5000);
  };

  const handleAdd = async (kind: Kind) => {
    const name = newName[kind].trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      if (kind === 'asset') await createAssetCategory({ name });
      else await createWorkOrderCategory({ name });
      setNewName((current) => ({ ...current, [kind]: '' }));
      await load();
      flash('Categoría agregada.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo agregar la categoría.');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (kind: Kind, id: string, value: string) => {
    const name = value.trim();
    if (!name) return;
    try {
      if (kind === 'asset') await updateAssetCategory(id, { name });
      else await updateWorkOrderCategory(id, { name });
      flash('Cambios guardados.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo renombrar.');
      await load();
    }
  };

  const handleToggle = async (kind: Kind, id: string, active: boolean) => {
    try {
      if (kind === 'asset') await updateAssetCategory(id, { is_active: active });
      else await updateWorkOrderCategory(id, { is_active: active });
      await load();
    } catch {
      setError('No se pudo cambiar el estado.');
    }
  };

  const handleDelete = async (kind: Kind, id: string, name: string) => {
    if (!window.confirm(`¿Eliminar la categoría «${name}»? Si está en uso, se pedirá desactivarla.`)) return;
    try {
      if (kind === 'asset') await deleteAssetCategory(id);
      else await deleteWorkOrderCategory(id);
      await load();
      flash('Categoría eliminada.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar la categoría.');
    }
  };

  const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  const renderList = (kind: Kind, rows: Array<AssetCategory | WorkOrderCategory>, canManage: boolean) => (
    <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
      {rows.length === 0 && (
        <p className="py-3 text-xs text-slate-500 dark:text-slate-400">Todavía no hay categorías.</p>
      )}
      {rows.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center gap-2 py-2">
          <input
            defaultValue={row.name}
            disabled={!canManage}
            onBlur={(event) => {
              if (event.target.value.trim() !== row.name) void handleRename(kind, row.id, event.target.value);
            }}
            className={`${inputClass} max-w-xs flex-1`}
          />
          {!row.is_active && (
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Inactiva
            </span>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => void handleToggle(kind, row.id, !row.is_active)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                {row.is_active ? 'Desactivar' : 'Activar'}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(kind, row.id, row.name)}
                className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:hover:bg-rose-950/30"
                title="Eliminar categoría"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
          <Tags size={20} className="text-emerald-600" /> Categorías de activos y de órdenes
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Clasifican la información para filtrar y reportar. Si una categoría está asignada, no se puede borrar: desactívala.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <Check size={16} /> {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin text-emerald-600" /> Cargando categorías…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
              <Wrench size={16} /> Activos
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Bombas, motores, bandas, tableros…</p>
            {canAssets && (
              <div className="mt-3 flex gap-2">
                <input
                  value={newName.asset}
                  onChange={(event) => setNewName((current) => ({ ...current, asset: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleAdd('asset');
                  }}
                  placeholder="Nueva categoría de activo"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => void handleAdd('asset')}
                  disabled={saving || !newName.asset.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
            )}
            {renderList('asset', assetCategories, canAssets)}
          </div>

          <div className={cardClass}>
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-500">
              <Tags size={16} /> Órdenes de trabajo
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Seguridad, mejora, proyecto, consumible…</p>
            {canOrders && (
              <div className="mt-3 flex gap-2">
                <input
                  value={newName.work_order}
                  onChange={(event) => setNewName((current) => ({ ...current, work_order: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleAdd('work_order');
                  }}
                  placeholder="Nueva categoría de orden"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => void handleAdd('work_order')}
                  disabled={saving || !newName.work_order.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>
            )}
            {renderList('work_order', orderCategories, canOrders)}
          </div>
        </div>
      )}
    </div>
  );
}
