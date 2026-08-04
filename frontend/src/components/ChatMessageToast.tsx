import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageSquare, X } from 'lucide-react';
import { socket } from '../api/socket';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../api/chat';
import { showIncomingChatSystemNotification, vibrateChatAlert, playChatNotifySound } from '../utils/chatNotify';

type ToastItem = {
  key: string;
  conversationId: string;
  title: string;
  body: string;
  leaving: boolean;
};

const SHOW_MS = 5000;
const EXIT_MS = 320;
/** Evita banner duplicado si el socket entrega el mismo mensaje dos veces. */
const DEDUPE_MS = 15_000;
/** Deduplicación a nivel módulo (sobrevive remounts / listeners dobles). */
const recentToastIds = new Map<string, number>();

function claimToastSlot(msgId: string): boolean {
  const now = Date.now();
  const last = recentToastIds.get(msgId);
  if (last != null && now - last < DEDUPE_MS) return false;
  recentToastIds.set(msgId, now);
  for (const [id, ts] of recentToastIds) {
    if (now - ts > DEDUPE_MS) recentToastIds.delete(id);
  }
  return true;
}

/**
 * Banner superior derecha para mensajes de chat entrantes:
 * entra con zoom; a los 5 s sale hacia la derecha.
 */
export function ChatMessageToast() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const locationRef = useRef(location);
  locationRef.current = location;
  const myIdRef = useRef<string | undefined>(undefined);
  myIdRef.current = user?.id || user?.userId;

  const dismiss = (key: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.key === key ? { ...t, leaving: true } : t))
    );
    const exitTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.key !== key));
      timersRef.current.delete(key);
    }, EXIT_MS);
    timersRef.current.set(key, exitTimer);
  };

  useEffect(() => {
    if (!myIdRef.current) return;

    const onMsg = (payload: { conversation_id: string; message: ChatMessage }) => {
      if (!payload?.conversation_id || !payload.message) return;
      const myId = myIdRef.current;
      if (!myId || payload.message.author_id === myId) return;
      if (payload.message.is_deleted) return;

      const msgId = payload.message.id;
      if (!msgId) return;

      // ACK de entrega (también si estás en el hilo; MessagesPage puede ACK de nuevo sin daño)
      socket.emit('chat_delivered', {
        conversation_id: payload.conversation_id,
        message_id: msgId,
      });

      const path = locationRef.current.pathname;
      const search = locationRef.current.search;
      // No molestar si ya estás viendo ese hilo
      if (path.startsWith('/messages') && search.includes(`c=${payload.conversation_id}`)) {
        return;
      }

      if (!claimToastSlot(msgId)) return;

      const author = payload.message.author?.name || 'Nuevo mensaje';
      const raw = (payload.message.body || '').trim();
      const body =
        raw && !raw.startsWith('(archivo)')
          ? raw.slice(0, 120)
          : payload.message.attachment_url
            ? 'Envió un archivo'
            : 'Nuevo mensaje';

      const key = msgId;
      const link = `/messages?c=${payload.conversation_id}`;

      // WhatsApp-like: sonido + vibrar; si la app está oculta, también notificación del sistema
      playChatNotifySound();
      vibrateChatAlert();
      void showIncomingChatSystemNotification({
        title: author,
        body,
        url: link,
        tag: `chat-${payload.conversation_id}`,
      });

      // Banner in-app solo si la pantalla está visible
      if (document.visibilityState === 'visible') {
        setToasts((prev) => {
          if (prev.some((t) => t.key === key)) return prev;
          return [
            ...prev.slice(-2),
            {
              key,
              conversationId: payload.conversation_id,
              title: author,
              body,
              leaving: false,
            },
          ];
        });
        const hideTimer = setTimeout(() => dismiss(key), SHOW_MS);
        timersRef.current.set(key, hideTimer);
      }
    };

    socket.on('chat_message', onMsg);
    return () => {
      socket.off('chat_message', onMsg);
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
    // Solo re-suscribir cuando hay sesión; myId va por ref para no duplicar listeners
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(user?.id || user?.userId)]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-3 top-16 z-[95] flex w-[min(100%-1.5rem,22rem)] flex-col gap-2 md:right-6 md:top-6 print:hidden"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.key}
          role="status"
          className={`pointer-events-auto w-full rounded-2xl border border-emerald-200/80 bg-white p-3 shadow-lg shadow-slate-900/10 ring-1 ring-black/5 transition-all duration-300 ease-out dark:border-emerald-800/60 dark:bg-slate-900 dark:ring-white/10 ${
            t.leaving
              ? 'translate-x-[120%] scale-95 opacity-0'
              : 'translate-x-0 scale-100 opacity-100 animate-[chat-toast-in_0.35s_ease-out]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              onClick={() => {
                dismiss(t.key);
                navigate(`/messages?c=${t.conversationId}`);
              }}
              className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <MessageSquare size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Mensaje
                </span>
                <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">
                  {t.title}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                  {t.body}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dismiss(t.key)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
