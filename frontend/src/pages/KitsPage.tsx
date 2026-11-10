import { useEffect, useMemo, useState } from 'react';
import {
  Boxes, Plus, Pencil, Trash2, Loader2, X, Search, CheckCircle2, PackageMinus,
} from 'lucide-react';
import { getKits, createKit, updateKit, deleteKit, getKitAvailability, type Kit } from '../api/kits';
import { getItems, createTransaction, type Item } from '../api/inventory';
import { getWorkOrders } from '../api/workOrders';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface DraftItem {
  item_id: string;
  quantity: number;
  name?: string;
  internal_code?: string;
  stock?: number;
}

interface Draft {
  id?: string;
  name: string;
  description: string;
  items: DraftItem[];
}

interface WorkOrderOption {
  id: string;
  folio: number;
  title: string;
  status: string;
}

const emptyDraft: Draft = { name: '', description: '', items: [] };

/** Kits: conjuntos de repuestos que se consumen de una vez en una orden. */
export default function KitsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_INVENTORY');

  const [kits, setKits] = useState<Kit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<WorkOrderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [consume, setConsume] = useState<{ kit: Kit; factor: number; workOrderId: string } | null>(null);
  const [consumeError, setConsumeError] = useState<string | null>(null);
  const [consuming, setConsuming] = useState(false);

  // Escape cierra el diálogo abierto (consumo o alta/edición).
  useEscapeKey(() => {
    if (consume) { setConsume(null); return; }
    if (draft) { setDraft(null); return; }
  }, Boolean(consume || draft));

  const load = async (background = false) => {
    try {
      if (!background) setLoading(true);
      setKits(await getKits());
    } catch {
      setError('No se pudieron cargar los kits.');
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void getItems().then((data: any) => setItems(Array.isArray(data) ? data : data?.items ?? [])).catch(() => setItems([]));
    void getWorkOrders()
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.work_orders ?? data?.orders ?? [];
        setOrders(list.filter((order: WorkOrderOption) => !['FINALIZADA', 'ANULADO', 'CERRADA'].includes(order.status)));
      })
      .catch(() => setOrders([]));
  }, []);

  useSocketRefresh('refresh_kits', () => { void load(true); });

  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase();
    const base = items.filter((item) => item.is_active !== false);
    if (!term) return base.slice(0, 40);
    return base
      .filter((item) => item.name.toLowerCase().includes(term) || (item.internal_code ?? '').toLowerCase().includes(term))
      .slice(0, 40);
  }, [items, itemSearch]);

  const openCreate = () => {
    setError(null);
    setItemSearch('');
    setDraft({ ...emptyDraft, items: [] });
  };

  const openEdit = (kit: Kit) => {
    setError(null);
    setItemSearch('');
    setDraft({
      id: kit.id,
      name: kit.name,
      description: kit.description ?? '',
      items: kit.items.map((row) => ({
        item_id: row.item_id,
        quantity: row.quantity,
        name: row.name,
        internal_code: row.internal_code,
        stock: row.stock,
      })),
    });
  };

  const toggleItem = (item: Item) => {
    if (!draft) return;
    const exists = draft.items.find((row) => row.item_id === item.id);
    if (exists) {
      setDraft({ ...draft, items: draft.items.filter((row) => row.item_id !== item.id) });
    } else {
      setDraft({
        ...draft,
        items: [...draft.items, {
          item_id: item.id,
          quantity: 1,
          name: item.name,
          internal_code: item.internal_code,
          stock: Number((item as any).stock ?? 0),
        }],
      });
    }
  };

  const setQuantity = (itemId: string, quantity: number) => {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((row) => (row.item_id === itemId ? { ...row, quantity: Math.max(1, quantity) } : row)),
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) {
      setError('Escribe el nombre del kit.');
      return;
    }
    if (draft.items.length === 0) {
      setError('Agrega al menos un repuesto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        items: draft.items.map((row) => ({ item_id: row.item_id, quantity: row.quantity })),
      };
      if (draft.id) await updateKit(draft.id, payload);
      else await createKit(payload);
      setDraft(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo guardar el kit.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (kit: Kit) => {
    if (!window.confirm(`¿Eliminar el kit «${kit.name}»?`)) return;
    try {
      await deleteKit(kit.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar el kit.');
    }
  };

  const startConsume = (kit: Kit) => {
    setConsumeError(null);
    setConsume({ kit, factor: 1, workOrderId: '' });
  };

  const doConsume = async () => {
    if (!consume) return;
    if (!consume.workOrderId) {
      setConsumeError('Elige la orden de trabajo.');
      return;
    }
    setConsuming(true);
    setConsumeError(null);
    try {
      const availability = await getKitAvailability(consume.kit.id, consume.factor);
      if (!availability.ok) {
        const detail = availability.shortages
          .map((row) => `${row.name}: faltan ${row.missing}`)
          .join(' · ');
        setConsumeError(`No alcanza el stock. ${detail}`);
        return;
      }
      const order = orders.find((row) => row.id === consume.workOrderId);
      const reason = `Kit ${consume.kit.name}${consume.factor > 1 ? ` ×${consume.factor}` : ''}${order ? ` — OT-${order.folio}` : ''}`;
      for (const row of consume.kit.items) {
        await createTransaction({
          item_id: row.item_id,
          amount: -(row.quantity * consume.factor),
          reason,
          work_order_id: consume.workOrderId,
        });
      }
      setConsume(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await load();
    } catch (err: any) {
      setConsumeError(err?.response?.data?.error || 'No se pudo consumir el kit.');
    } finally {
      setConsuming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
            <Boxes className="text-emerald-600 dark:text-emerald-400" size={28} />
            Kits de repuestos
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-300">
            Agrupa repuestos que siempre se usan juntos y consúmelos en una orden con un clic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={13} /> Listo
            </span>
          )}
          {canManage && (
            <button type="button" onClick={openCreate} className="ui-btn-primary">
              <Plus size={15} /> Nuevo kit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {kits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Boxes size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aún no hay kits</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Crea uno con los repuestos que se consumen juntos (por ejemplo, un kit de filtros).
          </p>
        </div>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kits.map((kit) => {
            const maxKits = kit.items.length ? Math.min(...kit.items.map((row) => row.available_kits)) : 0;
            return (
              <article key={kit.id} className="lift flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{kit.name}</h2>
                    {kit.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">{kit.description}</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" onClick={() => openEdit(kit)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800" title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button type="button" onClick={() => void remove(kit)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                <ul className="mt-2 space-y-1">
                  {kit.items.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                        {row.quantity} × {row.name}
                      </span>
                      <span className={`shrink-0 font-semibold ${row.stock < row.quantity ? 'text-rose-600' : 'text-slate-500'}`}>
                        stock {row.stock}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className={`text-[11px] font-bold ${maxKits > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                    {maxKits > 0 ? `Alcanza para ${maxKits} kit(s)` : 'Sin stock suficiente'}
                  </span>
                  <button
                    type="button"
                    onClick={() => startConsume(kit)}
                    disabled={maxKits === 0}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <PackageMinus size={12} /> Consumir en OT
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <form
            onSubmit={save}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {draft.id ? 'Editar kit' : 'Nuevo kit'}
              </h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="kit-name">Nombre</label>
                <input
                  id="kit-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Ej. Kit de filtros motor"
                  className="ui-input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="kit-desc">Descripción (opcional)</label>
                <input
                  id="kit-desc"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  className="ui-input"
                />
              </div>

              <div>
                <div className="relative mb-2">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Buscar repuesto…"
                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  {filteredItems.map((item) => {
                    const checked = draft.items.some((row) => row.item_id === item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${checked ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleItem(item)} className="h-4 w-4 accent-emerald-600" />
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{item.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-slate-400">{item.internal_code}</span>
                      </label>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-slate-400">Sin coincidencias.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Repuestos del kit ({draft.items.length})
                </p>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  {draft.items.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-slate-400">Selecciona repuestos a la izquierda.</p>
                  )}
                  {draft.items.map((row) => (
                    <div key={row.item_id} className="flex items-center gap-2 rounded-lg px-1 py-1">
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-700 dark:text-slate-200">{row.name}</span>
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(event) => setQuantity(row.item_id, Number(event.target.value))}
                        className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, items: draft.items.filter((item) => item.item_id !== row.item_id) })}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                        title="Quitar"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
              <button type="button" onClick={() => setDraft(null)} className="ui-btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="ui-btn-primary">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {draft.id ? 'Guardar cambios' : 'Crear kit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {consume && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setConsume(null)}>
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Consumir «{consume.kit.name}»</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Se descontará el stock de cada repuesto del kit y quedará ligado al costo de la orden.
            </p>

            <div className="mt-3 space-y-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="consume-order">
                  Orden de trabajo
                </label>
                <select
                  id="consume-order"
                  value={consume.workOrderId}
                  onChange={(event) => setConsume({ ...consume, workOrderId: event.target.value })}
                  className="ui-input"
                >
                  <option value="">Selecciona una orden abierta…</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>OT-{order.folio} · {order.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="consume-factor">
                  Cantidad de kits
                </label>
                <input
                  id="consume-factor"
                  type="number"
                  min="1"
                  max="100"
                  value={consume.factor}
                  onChange={(event) => setConsume({ ...consume, factor: Math.max(1, Number(event.target.value)) })}
                  className="ui-input"
                />
              </div>
            </div>

            {consumeError && (
              <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                {consumeError}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConsume(null)} className="ui-btn-secondary">Cancelar</button>
              <button type="button" onClick={() => void doConsume()} disabled={consuming} className="ui-btn-primary">
                {consuming ? <Loader2 size={14} className="animate-spin" /> : <PackageMinus size={14} />}
                Consumir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
