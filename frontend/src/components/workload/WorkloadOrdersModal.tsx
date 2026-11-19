import { CalendarClock, ChevronRight, Loader2, Trophy, X } from 'lucide-react';
import type { WorkloadOrder, WorkloadRow } from '../../api/workload';
import { useEscapeKey } from '../../hooks/useEscapeKey';

type Props = {
  row: WorkloadRow;
  onClose: () => void;
  onOpenOrder: (orderId: string, folio: number) => void;
  onOpenPerformance: () => void;
  loadingOrderId?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  EN_ESPERA: 'En espera',
  FINALIZADO: 'Finalizado',
  ANULADO: 'Anulado',
};

const STATUS_STYLES: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  EN_PROCESO: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  EN_ESPERA: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
  FINALIZADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  ANULADO: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

const priorityStyle = (order: WorkloadOrder): string =>
  order.priority === 'URGENTE'
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
    : order.priority === 'NORMAL'
      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';

const formatDate = (value: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
};

/**
 * Ventana con las órdenes abiertas de un técnico desde «Carga de trabajo».
 * Al elegir una, se abre el detalle de la orden como panel lateral.
 */
export function WorkloadOrdersModal({ row, onClose, onOpenOrder, onOpenPerformance, loadingOrderId }: Props) {
  useEscapeKey(onClose, true);

  const orders = row.orders ?? [];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workload-orders-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-black text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            {row.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="workload-orders-title" className="truncate text-base font-black text-slate-900 dark:text-white">
              {row.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {row.open_wos} orden(es) abiertas · {row.in_progress} en proceso
              {row.overdue > 0 ? ` · ${row.overdue} vencida(s)` : ''}
              {row.scheduled_hours > 0 ? ` · ${row.scheduled_hours} h de turno` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenPerformance}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              title="Abrir la ficha de desempeño del técnico"
            >
              <Trophy size={13} /> Desempeño
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Este técnico no tiene órdenes abiertas.
            </div>
          )}

          {orders.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.map((order) => {
                const isLoading = loadingOrderId === order.id;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => onOpenOrder(order.id, order.folio)}
                      disabled={Boolean(loadingOrderId)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60 dark:hover:bg-slate-800/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            FOL-{order.folio}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priorityStyle(order)}`}>
                            {order.priority}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_STYLES[order.status] ?? ''}`}>
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100">{order.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {order.asset_name ?? 'Sin activo'}
                          {order.zone_name ? ` · ${order.zone_name}` : ''}
                          {order.scheduled_date ? ` · programada ${formatDate(order.scheduled_date)}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold ${
                            order.overdue
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                              : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                          title={order.overdue ? 'Fecha límite vencida' : 'Fecha límite'}
                        >
                          <CalendarClock size={12} /> {formatDate(order.due_date)}
                        </span>
                      </div>
                      {isLoading ? (
                        <Loader2 size={16} className="shrink-0 animate-spin text-emerald-600" />
                      ) : (
                        <ChevronRight size={16} className="shrink-0 text-slate-300 dark:text-slate-600" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-right dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
