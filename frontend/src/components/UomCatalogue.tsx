import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Scale } from 'lucide-react';
import { getUoms, createUom, updateUom, deleteUom } from '../api/settings';
import type { UnitOfMeasure } from '../api/settings';
import type { QtyMode } from '../utils/qtyMode';
import { SearchableSelect } from './ui/SearchableSelect';

export const UomCatalogue = () => {
  const [uoms, setUoms] = useState<UnitOfMeasure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<QtyMode>('INTEGER');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUoms();
  }, []);

  const fetchUoms = async () => {
    try {
      setIsLoading(true);
      const data = await getUoms();
      setUoms(data);
    } catch (err) {
      console.error('Error fetching UOMs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setIsSaving(true);
      setError(null);
      const created = await createUom(newName.trim(), newMode);
      setUoms([...uoms, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewMode('INTEGER');
      setIsCreating(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo crear la unidad');
    } finally {
      setIsSaving(false);
    }
  };

  const handleModeChange = async (id: string, default_qty_mode: QtyMode) => {
    const prev = uoms.find((u) => u.id === id);
    if (!prev || (prev.default_qty_mode || 'INTEGER') === default_qty_mode) return;

    setUoms((list) =>
      list.map((u) => (u.id === id ? { ...u, default_qty_mode } : u))
    );
    try {
      setSavingId(id);
      setError(null);
      const updated = await updateUom(id, { default_qty_mode });
      setUoms((list) => list.map((u) => (u.id === id ? updated : u)));
    } catch (err: any) {
      setUoms((list) =>
        list.map((u) =>
          u.id === id ? { ...u, default_qty_mode: prev.default_qty_mode } : u
        )
      );
      setError(err?.response?.data?.error || 'No se pudo actualizar el modo');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta unidad de medida?')) return;
    try {
      await deleteUom(id);
      setUoms(uoms.filter((u) => u.id !== id));
    } catch (err) {
      console.error('Error deleting UOM:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-40">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Scale className="text-indigo-600" size={24} />
            Unidades de Medida
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiona las unidades del inventario. Puedes cambiar Enteros/Decimales en cualquier momento; al crear un artículo se sugiere este modo (luego se puede ajustar por ítem).
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          disabled={isSaving}
          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          Añadir Unidad
        </button>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {error}
          </div>
        )}

        {isCreating && (
          <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              type="text"
              autoFocus
              className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 dark:text-slate-100 uppercase"
              placeholder="Ej. CAJAS, LITROS..."
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <SearchableSelect
              value={newMode}
              onChange={(v) => setNewMode(v as QtyMode)}
              options={[
                { value: 'INTEGER', label: 'Enteros' },
                { value: 'DECIMAL', label: 'Decimales' },
              ]}
              title="Modo de cantidad sugerido"
              placeholder="Modo…"
              className="min-w-[8.5rem]"
              inputClassName="px-3 py-2 pr-8 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || isSaving}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="text-slate-500 hover:text-slate-700 px-2"
            >
              Cancelar
            </button>
          </div>
        )}

        <div className="space-y-3">
          {uoms.map((uom) => (
            <div
              key={uom.id}
              className="group flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-200 dark:hover:border-emerald-800/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-wrap min-w-0 flex-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{uom.name}</span>
                <SearchableSelect
                  value={uom.default_qty_mode || 'INTEGER'}
                  disabled={savingId === uom.id}
                  onChange={(v) => void handleModeChange(uom.id, v as QtyMode)}
                  options={[
                    { value: 'INTEGER', label: 'Enteros' },
                    { value: 'DECIMAL', label: 'Decimales' },
                  ]}
                  title="Modo de cantidad sugerido al usar esta unidad"
                  placeholder="Modo…"
                  className="min-w-[7.5rem]"
                  inputClassName="px-2.5 py-1.5 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60"
                />
                {savingId === uom.id && (
                  <Loader2 size={14} className="animate-spin text-emerald-600" />
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDelete(uom.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {uoms.length === 0 && !isCreating && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              No hay unidades de medida registradas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
