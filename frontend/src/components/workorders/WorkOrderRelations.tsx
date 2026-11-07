import { useCallback, useEffect, useState } from 'react';
import { Link2, Loader2, Plus, Trash2, X, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  getWorkOrderRelations, createWorkOrderRelation, deleteWorkOrderRelation,
  searchWorkOrdersForRelation, RELATION_TYPE_LABELS,
  type WorkOrderRelationRow, type WorkOrderRelationType, type WorkOrderSearchRow,
} from '../../api/woRelations';
import { formatWorkOrderFolio } from '../../utils/folio';

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  PAUSADA: 'Pausada',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
};

/**
 * Relaciones de la OT: duplicada, bloquea, causa o simplemente relacionada.
 * Se listan las dos direcciones; solo se puede borrar la que se creó desde aquí.
 */
export const WorkOrderRelations = ({
  workOrderId,
  isOpen,
  canWrite,
}: {
  workOrderId: string;
  isOpen: boolean;
  canWrite: boolean;
}) => {
  const [rows, setRows] = useState<WorkOrderRelationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkOrderSearchRow[]>([]);
  const [selected, setSelected] = useState<WorkOrderSearchRow | null>(null);
  const [relationType, setRelationType] = useState<WorkOrderRelationType>('RELACIONADA');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setRows(await getWorkOrderRelations(workOrderId));
      setError(null);
    } catch {
      setError('No se pudieron cargar las relaciones.');
    } finally {
      setIsLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isFormOpen) return;
    const term = query.trim();
    if (term.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setResults(await searchWorkOrdersForRelation(workOrderId, term));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, isFormOpen, workOrderId]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) {
      setError('Elige la orden que quieres relacionar.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await createWorkOrderRelation(workOrderId, {
        related_work_order_id: selected.id,
        relation_type: relationType,
        note: note.trim() || undefined,
      });
      setSelected(null);
      setQuery('');
      setResults([]);
      setNote('');
      setRelationType('RELACIONADA');
      setIsFormOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo crear la relación.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: WorkOrderRelationRow) => {
    if (!window.confirm(`¿Quitar la relación con ${formatWorkOrderFolio(row.work_order.folio)}?`)) return;
    try {
      await deleteWorkOrderRelation(workOrderId, row.id);
      await load();
    } catch {
      setError('No se pudo eliminar la relación.');
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-4 py-3">
        <Link2 size={16} className="text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Órdenes relacionadas</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {isLoading ? '…' : rows.length}
        </span>
        {canWrite && (
          <button
            type="button"
            onClick={() => setIsFormOpen((value) => !value)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isFormOpen ? <X size={13} /> : <Plus size={13} />}
            {isFormOpen ? 'Cancelar' : 'Relacionar'}
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {isFormOpen && (
        <form onSubmit={handleCreate} className="mx-4 mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="rel-search">
              Buscar OT por folio o título
            </label>
            <input
              id="rel-search"
              value={selected ? formatWorkOrderFolio(selected.folio) : query}
              onChange={(event) => {
                setSelected(null);
                setQuery(event.target.value);
              }}
              placeholder="Ej. 123 o «bomba»"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            {!selected && results.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {results.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => { setSelected(row); setResults([]); }}
                      className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{formatWorkOrderFolio(row.folio)}</span>
                      <span className="ml-2 text-slate-500 dark:text-slate-400">{row.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="rel-type">
                Tipo de relación
              </label>
              <select
                id="rel-type"
                value={relationType}
                onChange={(event) => setRelationType(event.target.value as WorkOrderRelationType)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                {(Object.keys(RELATION_TYPE_LABELS) as WorkOrderRelationType[]).map((type) => (
                  <option key={type} value={type}>{RELATION_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="rel-note">
                Nota (opcional)
              </label>
              <input
                id="rel-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Por qué se relacionan"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving || !selected}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Agregar relación
            </button>
          </div>
        </form>
      )}

      <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-slate-400">
            <Loader2 size={16} className="mr-2 animate-spin" /> Cargando relaciones…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
            Sin órdenes relacionadas. Usa «Relacionar» para vincular una duplicada, una que bloquea o la causa.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={`${row.id}-${row.direction}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                  {row.direction === 'out' ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {formatWorkOrderFolio(row.work_order.folio)} · {row.work_order.title}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {row.relation_label}
                    {row.direction === 'in' ? ' (desde la otra orden)' : ''}
                    {' · '}{STATUS_LABELS[row.work_order.status] || row.work_order.status}
                    {row.note ? ` · ${row.note}` : ''}
                    {row.created_by ? ` · ${row.created_by}` : ''}
                  </p>
                </div>
                {row.editable && canWrite && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(row)}
                    className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                    title="Quitar relación"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
