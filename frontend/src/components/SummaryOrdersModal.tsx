import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { getWorkOrdersPage, updateWorkOrder, type WorkOrder, type Paginated } from '../api/workOrders';
import { WorkOrderDetailModal } from './WorkOrderDetailModal';
import { formatWorkOrderFolio } from '../utils/folio';
const labels: Record<string, string> = { PENDIENTE: 'Pendientes', EN_PROCESO: 'En proceso', EN_ESPERA: 'Pausadas', FINALIZADO: 'Finalizadas', ANULADO: 'Invalidadas', TOTAL: 'Total recibidas' };
export function SummaryOrdersModal({ status, startDate, endDate, onClose, onChanged }: {
  status: string; startDate: string; endDate: string; onClose: () => void; onChanged: () => void;
}) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<WorkOrder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    getWorkOrdersPage({ page, limit: 20, sort: 'newest', startDate: startDate || undefined, endDate: endDate || undefined,
      status: status === 'TOTAL' ? undefined : status, excludeCancelled: status === 'TOTAL' }, controller.signal)
      .then(data => { if (!controller.signal.aborted) { setResult(data); if (page > data.totalPages) setPage(data.totalPages); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [status, startDate, endDate, page, revision]);
  return <>
    {!selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="summary-orders-title" className="flex max-h-[90dvh] w-full max-w-3xl flex-col rounded-2xl bg-white text-slate-900 shadow-xl dark:bg-slate-900 dark:text-slate-100" onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)'));
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
          }
        }}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
          <div><h2 id="summary-orders-title" className="text-lg font-bold">{labels[status]}{!loading && !error && result ? ` · ${result.total}` : ''}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Fecha de creación: {startDate || 'Sin inicio'} — {endDate || 'Sin fin'}</p>
            {status === 'TOTAL' && <p className="text-xs text-slate-500">No incluye invalidadas.</p>}
          </div>
          <button ref={closeRef} type="button" aria-label="Cerrar lista" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
        </header>
        <div className="min-h-32 overflow-y-auto p-3" aria-busy={loading}>
          {loading ? <p role="status" className="p-4">Cargando solicitudes…</p> : error ? <div role="alert" className="p-4">No se pudo cargar la lista. <button type="button" className="underline" onClick={() => setRevision(v => v + 1)}>Reintentar</button></div> : result?.data.length ?
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">{result.data.map(order => <li key={order.id}>
              <button type="button" onClick={() => setSelected(order)} className="w-full rounded-lg p-3 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-slate-800">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{formatWorkOrderFolio(order.folio)} · {labels[order.status]}</span>
                <span className="block break-words font-semibold">{order.title}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(order.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} · Abrir detalle</span>
              </button>
            </li>)}</ul> : <p className="p-4">No hay solicitudes para este estado y periodo.</p>}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-3 text-sm dark:border-slate-700">
          <button type="button" disabled={loading} onClick={() => { setRevision(v => v + 1); onChanged(); }} className="flex items-center gap-1 p-2 disabled:opacity-40"><RefreshCw size={16} />Actualizar</button>
          <div className="flex items-center gap-2"><button type="button" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 disabled:opacity-40">Anterior</button>
          <span>{page} / {result?.totalPages || 1}</span><button type="button" disabled={loading || error || page >= (result?.totalPages || 1)} onClick={() => setPage(p => p + 1)} className="p-2 disabled:opacity-40">Siguiente</button></div>
        </footer>
      </section>
    </div>}
    {selected && <WorkOrderDetailModal workOrder={selected} isOpen onClose={() => { setSelected(null); setRevision(v => v + 1); onChanged(); requestAnimationFrame(() => closeRef.current?.focus()); }}
      onUpdate={async (id, data) => { const updated = await updateWorkOrder(id, data); setRevision(v => v + 1); onChanged(); return updated; }} />}
  </>;
}
