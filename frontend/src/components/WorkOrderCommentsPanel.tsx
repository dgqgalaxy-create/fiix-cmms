import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Paperclip, Send, X as XIcon } from 'lucide-react';
import {
  listWorkOrderComments,
  createWorkOrderComment,
  commentAttachmentUrl,
  type WorkOrderComment,
} from '../api/woComments';
import { socket } from '../api/socket';
import { formatDateTime } from '../utils/dateUtils';

interface Props {
  workOrderId: string;
  isOpen: boolean;
  canWrite: boolean;
  onZoomImage?: (src: string) => void;
}

export function WorkOrderCommentsPanel({ workOrderId, isOpen, canWrite, onZoomImage }: Props) {
  const [comments, setComments] = useState<WorkOrderComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listWorkOrderComments(workOrderId);
      setComments(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron cargar los comentarios');
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    void load();
  }, [isOpen, workOrderId, load]);

  useEffect(() => {
    if (!isOpen || !workOrderId) return;
    const onComment = (comment: WorkOrderComment) => {
      if (comment.work_order_id !== workOrderId) return;
      setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]));
    };
    socket.on('wo_comment', onComment);
    return () => {
      socket.off('wo_comment', onComment);
    };
  }, [isOpen, workOrderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSend = async () => {
    if (!canWrite || (!body.trim() && !file)) return;
    setSending(true);
    setError(null);
    try {
      const created = await createWorkOrderComment(workOrderId, {
        body: body.trim() || undefined,
        attachment: file,
      });
      setComments((prev) => (prev.some((c) => c.id === created.id) ? prev : [...prev, created]));
      setBody('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <MessageSquare size={15} className="text-sky-600" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Comentarios</h3>
        <span className="text-[11px] text-slate-400 tabular-nums">({comments.length})</span>
      </div>

      <div className="max-h-56 overflow-y-auto px-3 py-2 space-y-2">
        {loading ? (
          <p className="text-xs text-slate-400 flex items-center gap-1 py-4 justify-center">
            <Loader2 size={14} className="animate-spin" /> Cargando…
          </p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Sin comentarios aún. Sé el primero.</p>
        ) : (
          comments.map((c) => {
            const src = commentAttachmentUrl(c.attachment_url);
            const isImage = !!src && /\.(png|jpe?g|gif|webp)$/i.test(src);
            return (
              <div key={c.id} className="rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{c.author?.name || 'Usuario'}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatDateTime(c.created_at)}</span>
                </div>
                {c.body && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{c.body}</p>}
                {src && (
                  isImage ? (
                    <button
                      type="button"
                      className="mt-1.5 block"
                      onClick={() => onZoomImage?.(src)}
                    >
                      <img src={src} alt="" className="h-20 w-20 rounded-md object-cover border border-slate-200" />
                    </button>
                  ) : (
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
                    >
                      <Paperclip size={12} /> {c.attachment_name || 'Archivo'}
                    </a>
                  )
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-3 pb-1 text-[11px] text-amber-700 dark:text-amber-300">{error}</p>
      )}

      {canWrite && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-2 space-y-1.5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Escribe un comentario…"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs dark:text-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300"
            >
              <Paperclip size={12} /> {file ? 'Cambiar' : 'Adjuntar'}
            </button>
            {file && (
              <span className="text-[10px] text-slate-500 truncate flex-1 flex items-center gap-1">
                {file.name}
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                  <XIcon size={12} />
                </button>
              </span>
            )}
            <button
              type="button"
              disabled={sending || (!body.trim() && !file)}
              onClick={() => void handleSend()}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
