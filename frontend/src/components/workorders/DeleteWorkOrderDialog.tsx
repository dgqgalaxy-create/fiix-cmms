import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, ShieldAlert, Trash2, X } from 'lucide-react';
import type { WorkOrder } from '../../api/workOrders';
import { formatWorkOrderFolio } from '../../utils/folio';
import { useEscapeKey } from '../../hooks/useEscapeKey';

const CONFIRM_WORD = 'ELIMINAR';

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  EN_ESPERA: 'En Espera',
  FINALIZADO: 'Finalizado',
  ANULADO: 'Anulado',
};

type Props = {
  workOrder: WorkOrder | null;
  isOpen: boolean;
  onClose: () => void;
  /** Debe lanzar si la contraseña es incorrecta o la operación falla. */
  onConfirm: (password: string) => Promise<void>;
};

/**
 * Confirmación de borrado definitivo de una orden de trabajo.
 * Exige la contraseña maestra (igual que Opciones de Desarrollador) y escribir
 * ELIMINAR, porque la operación revierte inventario y borra archivos.
 */
export function DeleteWorkOrderDialog({ workOrder, isOpen, onClose, onConfirm }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setConfirmation('');
    setError(null);
    setRemainingAttempts(null);
    setIsSubmitting(false);
    const timer = window.setTimeout(() => passwordRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isOpen, workOrder?.id]);

  useEscapeKey(() => {
    if (!isSubmitting) onClose();
  }, isOpen);

  if (!isOpen || !workOrder) return null;

  const consumedParts = (workOrder.inventory_transactions ?? []).filter((tx) => tx.amount < 0);
  const canSubmit = password.trim().length > 0 && confirmation.trim().toUpperCase() === CONFIRM_WORD && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    setRemainingAttempts(null);
    try {
      await onConfirm(password);
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; error?: string; remainingAttempts?: number } } })
        ?.response?.data;
      setError(data?.message || data?.error || 'No se pudo eliminar la orden. Intenta de nuevo.');
      setRemainingAttempts(typeof data?.remainingAttempts === 'number' ? data.remainingAttempts : null);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-wo-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
            <ShieldAlert size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="delete-wo-title" className="text-base font-black text-slate-900 dark:text-white">
              Eliminar orden definitivamente
            </h2>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-semibold">{formatWorkOrderFolio(workOrder.folio)}</span>
              {' · '}
              {workOrder.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/40">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
              <AlertTriangle size={14} /> Esto no se puede deshacer
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-red-800 dark:text-red-200">
              <li>Se borrarán las fotos, firmas, documentos y comentarios de la orden.</li>
              <li>Se registrará la eliminación en la bitácora de auditoría.</li>
              <li>
                Estado actual:{' '}
                <span className="font-semibold">
                  {STATUS_LABELS[workOrder.status] ?? workOrder.status}
                </span>
                {workOrder.asset?.name ? <> · Activo: {workOrder.asset.name}</> : null}
              </li>
            </ul>
            {consumedParts.length > 0 && (
              <div className="mt-3 rounded-lg border border-red-200 bg-white/70 p-2 dark:border-red-900/60 dark:bg-slate-950/40">
                <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                  Refacciones que se devolverán al inventario
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                  {consumedParts.map((tx) => (
                    <li key={tx.id} className="flex justify-between gap-3">
                      <span className="truncate">{tx.item?.name ?? 'Repuesto'}</span>
                      <span className="shrink-0 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        +{Math.abs(tx.amount)} {tx.item?.uom ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="delete-wo-password"
              className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              Contraseña de desarrollador
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 text-slate-400" size={16} />
              <input
                id="delete-wo-password"
                ref={passwordRef}
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                placeholder="Contraseña maestra…"
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="delete-wo-confirm"
              className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300"
            >
              Escribe <span className="font-mono text-red-600 dark:text-red-400">{CONFIRM_WORD}</span> para confirmar
            </label>
            <input
              id="delete-wo-confirm"
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold uppercase tracking-wider text-slate-900 outline-none transition-colors focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              placeholder={CONFIRM_WORD}
              required
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
            >
              <p className="font-medium">{error}</p>
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Intentos restantes: {remainingAttempts} de 3
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end dark:border-slate-800 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
            {isSubmitting ? 'Eliminando…' : 'Eliminar orden'}
          </button>
        </div>
      </form>
    </div>
  );
}
