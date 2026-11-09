import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Receipt } from 'lucide-react';
import {
  getCostCategories, getWorkOrderCosts, addWorkOrderCost, deleteWorkOrderCost, createCostCategory,
  type CostCategory, type WorkOrderCost,
} from '../../api/workOrderCosts';

interface Props {
  workOrderId: string;
  isOpen?: boolean;
  canWrite: boolean;
}

const money = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

/** Costos adicionales de la orden: servicios externos, fletes, refacciones compradas fuera. */
export function WorkOrderCostsSection({ workOrderId, isOpen = true, canWrite }: Props) {
  const [costs, setCosts] = useState<WorkOrderCost[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const load = async () => {
    try {
      const [data, cats] = await Promise.all([getWorkOrderCosts(workOrderId), getCostCategories()]);
      setCosts(data.costs);
      setTotal(data.total);
      setCategories(cats);
    } catch {
      setError('No se pudieron cargar los costos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, isOpen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Escribe un monto mayor a cero.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let resolvedCategoryId = categoryId || null;
      if (!resolvedCategoryId && newCategory.trim()) {
        const created = await createCostCategory(newCategory.trim());
        resolvedCategoryId = created.id;
        setCategories((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      }
      await addWorkOrderCost(workOrderId, {
        category_id: resolvedCategoryId,
        description: description.trim() || undefined,
        amount: value,
      });
      setAmount('');
      setDescription('');
      setNewCategory('');
      setOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo guardar el costo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cost: WorkOrderCost) => {
    if (!window.confirm(`¿Eliminar el costo de ${money(cost.amount)}?`)) return;
    try {
      await deleteWorkOrderCost(workOrderId, cost.id);
      await load();
    } catch {
      setError('No se pudo eliminar el costo.');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <Receipt size={15} className="text-emerald-600" /> Costos adicionales
        </h3>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{money(total)}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 size={18} className="animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {costs.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sin costos adicionales. Úsalos para servicios de terceros, fletes o refacciones compradas fuera del inventario.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {costs.map((cost) => (
                <li key={cost.id} className="flex items-start gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {cost.category?.name ?? 'Sin categoría'}
                    </p>
                    {cost.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cost.description}</p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {new Date(cost.incurred_at).toLocaleDateString('es-MX')}
                      {cost.created_by?.name ? ` · ${cost.created_by.name}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-slate-800 dark:text-slate-100">{money(cost.amount)}</span>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => void remove(cost)}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      title="Eliminar costo"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canWrite && (
            <div className="mt-2">
              {!open ? (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Plus size={13} /> Agregar costo
                </button>
              ) : (
                <form onSubmit={submit} className="space-y-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="cost-category">
                        Categoría
                      </label>
                      <select
                        id="cost-category"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="">— Nueva categoría —</option>
                        {categories.filter((category) => category.is_active).map((category) => (
                          <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="cost-amount">
                        Monto (MXN)
                      </label>
                      <input
                        id="cost-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  {!categoryId && (
                    <input
                      value={newCategory}
                      onChange={(event) => setNewCategory(event.target.value)}
                      placeholder="Nombre de la nueva categoría (ej. Flete)"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    />
                  )}
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Descripción (opcional)"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setOpen(false); setError(null); }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Guardar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
