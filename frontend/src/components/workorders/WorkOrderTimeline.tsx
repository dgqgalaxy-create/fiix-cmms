import { useEffect, useState } from 'react';
import {
  Loader2, Plus, MessageSquare, RefreshCw, Package, Image as ImageIcon, Paperclip, History, ChevronDown,
} from 'lucide-react';
import { getWorkOrderTimeline, type WorkOrderTimelineEvent } from '../../api/woTimeline';
import { formatDateTime } from '../../utils/dateUtils';
import { mediaUrl } from '../../utils/mediaUrl';

const kindStyles: Record<string, { icon: React.ReactNode; ring: string; bg: string }> = {
  created: { icon: <Plus size={13} />, ring: 'border-emerald-200 text-emerald-600 dark:border-emerald-800 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  comment: { icon: <MessageSquare size={13} />, ring: 'border-sky-200 text-sky-600 dark:border-sky-800 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  status: { icon: <RefreshCw size={13} />, ring: 'border-violet-200 text-violet-600 dark:border-violet-800 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  update: { icon: <History size={13} />, ring: 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
  part: { icon: <Package size={13} />, ring: 'border-orange-200 text-orange-600 dark:border-orange-800 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  photo: { icon: <ImageIcon size={13} />, ring: 'border-rose-200 text-rose-600 dark:border-rose-800 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
};

/**
 * Bitácora de la OT: línea de tiempo con todo lo que pasó (creación, comentarios,
 * cambios de estado, repuestos entregados y fotos), de lo más reciente a lo más viejo.
 */
export const WorkOrderTimeline = ({
  workOrderId,
  isOpen,
  onZoomImage,
}: {
  workOrderId: string;
  isOpen: boolean;
  onZoomImage?: (src: string) => void;
}) => {
  const [events, setEvents] = useState<WorkOrderTimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    let cancelled = false;
    setIsLoading(true);
    getWorkOrderTimeline(workOrderId)
      .then((data) => {
        if (!cancelled) {
          setEvents(data.events ?? []);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la bitácora.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, workOrderId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <History size={16} className="text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Bitácora</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {isLoading ? '…' : events.length}
        </span>
        <ChevronDown size={16} className={`ml-auto text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 size={16} className="mr-2 animate-spin" /> Cargando bitácora…
            </div>
          ) : error ? (
            <p className="py-4 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : events.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Todavía no hay movimientos en esta orden.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-slate-700">
              {events.map((event) => {
                const style = kindStyles[event.kind] ?? kindStyles.update;
                return (
                  <li key={event.id} className="relative">
                    <span
                      className={`absolute -left-[1.42rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${style.ring} ${style.bg}`}
                      aria-hidden
                    >
                      {style.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{event.title}</p>
                        <span className="text-[10px] text-slate-400">{formatDateTime(event.at)}</span>
                      </div>
                      {event.detail && (
                        <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600 dark:text-slate-300">{event.detail}</p>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                        {event.actor && <span>por {event.actor}</span>}
                        {event.attachment_url && (
                          <button
                            type="button"
                            onClick={() =>
                              onZoomImage && /\.(png|jpe?g|gif|webp)$/i.test(event.attachment_url!)
                                ? onZoomImage(mediaUrl(event.attachment_url))
                                : window.open(mediaUrl(event.attachment_url), '_blank', 'noopener')
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Paperclip size={11} /> {event.attachment_name || 'Adjunto'}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  );
};
