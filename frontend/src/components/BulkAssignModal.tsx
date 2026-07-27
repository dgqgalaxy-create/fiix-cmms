import { useEffect, useMemo, useState } from 'react';
import { Loader2, Users, X } from 'lucide-react';
import type { WorkOrder } from '../api/workOrders';
import { updateWorkOrder } from '../api/workOrders';
import { getUsers } from '../api/users';
import type { User } from '../api/users';
import { formatWorkOrderFolio } from '../utils/folio';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  candidates: WorkOrder[];
  onDone: () => void;
};

export function BulkAssignModal({ isOpen, onClose, candidates, onDone }: Props) {
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCandidates = useMemo(
    () => candidates.filter((wo) => wo.status !== 'FINALIZADO' && wo.status !== 'ANULADO'),
    [candidates]
  );

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSelectedOrderIds(openCandidates.slice(0, 20).map((wo) => wo.id));
    setSelectedTechIds([]);
    setLoading(true);
    getUsers()
      .then((users) => {
        setTechnicians(users.filter((u) => u.is_active && (u.role === 'TECNICO' || u.role === 'GESTIONADOR' || u.role === 'ADMINISTRADOR')));
      })
      .catch(() => setError('No se pudieron cargar los técnicos'))
      .finally(() => setLoading(false));
  }, [isOpen, openCandidates]);

  if (!isOpen) return null;

  const toggleOrder = (id: string) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleTech = (id: string) => {
    setSelectedTechIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAssign = async () => {
    if (selectedOrderIds.length === 0) {
      setError('Selecciona al menos una orden');
      return;
    }
    if (selectedTechIds.length === 0) {
      setError('Selecciona al menos un técnico');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const id of selectedOrderIds) {
        await updateWorkOrder(id, { assigned_technicians_ids: selectedTechIds });
      }
      onDone();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al asignar órdenes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <Users size={20} className="text-blue-600" />
            Asignar órdenes
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Órdenes ({selectedOrderIds.length}/{openCandidates.length})
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  {openCandidates.length === 0 ? (
                    <p className="p-2 text-sm text-slate-500">No hay órdenes abiertas en el filtro actual.</p>
                  ) : (
                    openCandidates.map((wo) => (
                      <label key={wo.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={selectedOrderIds.includes(wo.id)}
                          onChange={() => toggleOrder(wo.id)}
                        />
                        <span className="min-w-0 text-sm">
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{formatWorkOrderFolio(wo.folio)}</span>
                          <span className="ml-2 text-slate-600 dark:text-slate-400">{wo.title}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Técnicos ({selectedTechIds.length})
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  {technicians.map((tech) => (
                    <label key={tech.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedTechIds.includes(tech.id)}
                        onChange={() => toggleTech(tech.id)}
                      />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{tech.name}</span>
                      <span className="text-[10px] uppercase text-slate-400">{tech.role}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleAssign()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Asignar
          </button>
        </div>
      </div>
    </div>
  );
}
