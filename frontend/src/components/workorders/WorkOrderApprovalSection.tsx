import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import {
  getApprovalHistory,
  approveWorkOrder,
  rejectWorkOrder,
  type ApprovalHistoryRow,
} from '../../api/approvals';
import { useAuth } from '../../context/AuthContext';

interface Props {
  workOrderId: string;
  approvalStatus?: string | null;
  isOpen?: boolean;
  /** Se llama después de aprobar o rechazar para refrescar la orden. */
  onDecided?: () => void;
}

/** Bloque de aprobación dentro del detalle de la orden. */
export function WorkOrderApprovalSection({ workOrderId, approvalStatus, isOpen = true, onDecided }: Props) {
  const { hasPermission } = useAuth();
  const canApprove = hasPermission('APPROVE_WORK_ORDERS');

  const [history, setHistory] = useState<ApprovalHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');

  const load = async () => {
    try {
      const rows = await getApprovalHistory(workOrderId);
      setHistory(rows);
    } catch {
      setError('No se pudo cargar el historial de aprobación.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, isOpen]);

  const pending = approvalStatus === 'PENDIENTE';

  if (!pending && history.length === 0) return null;

  const decide = async (approve: boolean) => {
    if (!approve && !comment.trim()) {
      setError('Escribe el motivo del rechazo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (approve) await approveWorkOrder(workOrderId);
      else await rejectWorkOrder(workOrderId, comment.trim());
      setRejecting(false);
      setComment('');
      await load();
      onDecided?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo registrar la decisión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-4 ${pending ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        {pending
          ? <AlertTriangle size={15} className="text-amber-600" />
          : approvalStatus === 'APROBADA'
            ? <CheckCircle2 size={15} className="text-emerald-600" />
            : <XCircle size={15} className="text-rose-600" />}
        Aprobación
      </h3>

      {pending && (
        <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">
          Esta orden requiere autorización antes de iniciar o finalizar.
        </p>
      )}

      {loading ? (
        <div className="mt-2 flex justify-center py-2">
          <Loader2 size={16} className="animate-spin text-emerald-600" />
        </div>
      ) : (
        <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
          {history.map((row) => (
            <li key={row.id}>
              <span className={`font-bold ${row.status === 'APROBADA' ? 'text-emerald-700 dark:text-emerald-400' : row.status === 'RECHAZADA' ? 'text-rose-600' : 'text-amber-700 dark:text-amber-300'}`}>
                {row.status === 'APROBADA' ? 'Aprobada' : row.status === 'RECHAZADA' ? 'Rechazada' : 'Pendiente'}
              </span>
              {row.rule?.name ? ` · ${row.rule.name}` : ''}
              {row.decided_by?.name ? ` · por ${row.decided_by.name}` : ''}
              {row.comment ? ` · ${row.comment}` : ''}
            </li>
          ))}
        </ul>
      )}

      {pending && canApprove && (
        <div className="mt-3">
          {rejecting ? (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Motivo del rechazo (obligatorio)"
                className="ui-input"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setRejecting(false); setError(null); }} className="ui-btn-secondary py-1.5 text-xs">
                  Cancelar
                </button>
                <button type="button" onClick={() => void decide(false)} disabled={busy} className="ui-btn-danger py-1.5 text-xs">
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Confirmar rechazo
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void decide(true)} disabled={busy} className="ui-btn-primary py-1.5 text-xs">
                {busy ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Aprobar
              </button>
              <button type="button" onClick={() => setRejecting(true)} disabled={busy} className="ui-btn-secondary py-1.5 text-xs">
                <XCircle size={13} /> Rechazar
              </button>
            </div>
          )}
        </div>
      )}

      {pending && !canApprove && (
        <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Necesitas el permiso «Aprobar órdenes de trabajo» para decidir.
        </p>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
