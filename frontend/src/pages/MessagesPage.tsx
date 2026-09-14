import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDown,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Users,
  X as XIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUsers, getOnlineUsers, type User } from '../api/users';
import {
  listConversations,
  createDirectConversation,
  createGroupConversation,
  listMessages,
  sendChatMessage,
  softDeleteChatMessage,
  canAuthorSoftDelete,
  markConversationRead,
  chatAttachmentUrl,
  type ChatConversation,
  type ChatMessage,
} from '../api/chat';
import { socket, ensureSocketConnected } from '../api/socket';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';
import { MessageTicks } from '../components/MessageTicks';

type ComposeMode = null | 'direct' | 'group';

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
];

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

const avatarColorOf = (name: string) => {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

/** Tipos de archivo aceptados al adjuntar en el chat (igual que el backend). */
const CHAT_ACCEPTED_MIME = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const isAcceptedChatFile = (f: File) =>
  CHAT_ACCEPTED_MIME.some((t) => (t.endsWith('/') ? f.type.startsWith(t) : f.type === t));

/** Encuentra URLs (http/https/www) y las convierte en enlaces clicables. */
const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+\.[^\s<>"']+[^\s<>"']*)/gi;

const linkifyBody = (text: string, linkClassName: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text)) !== null) {
    const raw = m[0];
    let url = raw;
    let trailing = '';
    // Quitar puntuación final que no forma parte del enlace (p. ej. «mira:» o «(fin).»)
    while (/[.,;:!?)\]}>'"»]/.test(url.charAt(url.length - 1))) {
      trailing = url.charAt(url.length - 1) + trailing;
      url = url.slice(0, -1);
    }
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const href = /^www\./i.test(url) ? `https://${url}` : url;
    nodes.push(
      <a
        key={`${m.index}-${url}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={href}
        className={`break-all underline ${linkClassName}`}
      >
        {url}
      </a>
    );
    if (trailing) nodes.push(trailing);
    last = m.index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

const sameCalendarDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Etiqueta de separador de día: Hoy / Ayer / 12 ago (con año si difiere). */
const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  if (sameCalendarDay(d, now)) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameCalendarDay(d, yesterday)) return 'Ayer';
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Hora compacta para la lista: hoy → 10:32, ayer → Ayer, luego dd/mm. */
const lastMsgTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  if (sameCalendarDay(d, now)) return fmtTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameCalendarDay(d, yesterday)) return 'Ayer';
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { day: '2-digit', month: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: '2-digit' };
  return d.toLocaleDateString('es-MX', opts);
};

/** Agrupa mensajes consecutivos del mismo autor con ≤ 10 min de diferencia. */
const GROUP_GAP_MS = 10 * 60 * 1000;

export default function MessagesPage() {
  const { user } = useAuth();
  const isTechMobileShell = useTechnicianMobileShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('c'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const MSG_LIMIT = 50;
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeMode>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [pickUserId, setPickUserId] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(searchParams.get('c')));
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [showJumpBottom, setShowJumpBottom] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  /** Tras cargar el hilo: ir al fondo o al primer no leído */
  const pendingScrollRef = useRef<'bottom' | { unreadId: string } | null>(null);
  /** Id del primer mensaje no leído (para el separador visual en esta apertura) */
  const [unreadDividerId, setUnreadDividerId] = useState<string | null>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  /** En chats 1:1, el otro participante (para la cabecera del hilo). */
  const activeOther = useMemo(() => {
    if (!active || active.type !== 'DIRECT') return undefined;
    const myId = user?.id || user?.userId;
    return active.participants.find((p) => p.user_id !== myId)?.user;
  }, [active, user?.id, user?.userId]);

  /** Subtítulo de la cabecera: rol y presencia en 1:1; miembros en grupos. */
  const activeSubtitle = useMemo(() => {
    if (!active) return '';
    if (active.type === 'GROUP') {
      return (active.participants || [])
        .map((p) => p.user?.name)
        .filter(Boolean)
        .join(', ');
    }
    const online = activeOther && onlineIds.has(activeOther.id) ? 'En línea' : null;
    return [activeOther?.role, online].filter(Boolean).join(' · ');
  }, [active, activeOther, onlineIds]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron cargar las conversaciones');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const findFirstUnreadId = (
    data: ChatMessage[],
    myId: string | undefined,
    unreadCount: number,
    lastReadAt?: string | null
  ): string | null => {
    if (!myId || unreadCount <= 0) return null;
    const fromOthers = data.filter((m) => m.author_id !== myId && !m.is_deleted);
    if (fromOthers.length === 0) return null;

    if (lastReadAt) {
      const t = new Date(lastReadAt).getTime();
      const first = fromOthers.find((m) => new Date(m.created_at).getTime() > t);
      if (first) return first.id;
    } else {
      // Nunca leído: el más antiguo de otros en el lote
      return fromOthers[0]?.id || null;
    }

    // Fallback por contador (últimos N de otros = no leídos)
    const start = Math.max(0, fromOthers.length - unreadCount);
    return fromOthers[start]?.id || null;
  };

  const loadThread = useCallback(
    async (id: string) => {
      try {
        setLoadingThread(true);
        setHasMoreOlder(false);
        const conv = conversationsRef.current.find((c) => c.id === id);
        const unreadCount = conv?.unread_count || 0;
        const myId = user?.id;
        const lastReadAt =
          conv?.participants?.find((p) => p.user_id === myId)?.last_read_at || null;

        const data = await listMessages(id, undefined, MSG_LIMIT);
        const firstUnreadId = findFirstUnreadId(data, myId, unreadCount, lastReadAt);

        setMessages(data);
        setHasMoreOlder(data.length >= MSG_LIMIT);
        setUnreadDividerId(firstUnreadId);
        pendingScrollRef.current = firstUnreadId
          ? { unreadId: firstUnreadId }
          : 'bottom';

        await markConversationRead(id);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
        );
      } catch (err: any) {
        setError(err?.response?.data?.error || 'No se pudieron cargar los mensajes');
      } finally {
        setLoadingThread(false);
      }
    },
    [user?.id]
  );

  const loadOlderMessages = async () => {
    if (!activeId || !messages.length || !hasMoreOlder || loadingOlder) return;
    const scrollEl = threadScrollRef.current;
    const prevHeight = scrollEl?.scrollHeight ?? 0;
    const prevTop = scrollEl?.scrollTop ?? 0;
    setLoadingOlder(true);
    setError(null);
    try {
      const older = await listMessages(activeId, messages[0].id, MSG_LIMIT);
      setHasMoreOlder(older.length >= MSG_LIMIT);
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const unique = older.filter((m) => !ids.has(m.id));
        return [...unique, ...prev];
      });
      requestAnimationFrame(() => {
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight + prevTop;
        }
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron cargar mensajes anteriores');
    } finally {
      setLoadingOlder(false);
    }
  };

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useSocketRefresh('refresh_chat', loadConversations);

  useEffect(() => {
    getUsers()
      .then((list) => setUsers(list.filter((u) => u.is_active && u.id !== user?.id)))
      .catch(() => undefined);
  }, [user?.id]);

  // Presencia para el punto verde de la lista de conversaciones (60 s).
  useEffect(() => {
    const load = () => {
      getOnlineUsers()
        .then((list) => setOnlineIds(new Set(list.map((u) => u.id))))
        .catch(() => undefined);
    };
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const q = searchParams.get('c');
    if (q && q !== activeId) {
      setActiveId(q);
      setMobileShowThread(true);
    }
  }, [searchParams, activeId]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      setUnreadDividerId(null);
      setHasMoreOlder(false);
      return;
    }
    void loadThread(activeId);
  }, [activeId, loadThread]);

  // Scroll al primer no leído (inicio del bloque) o al final si no hay pendientes
  useEffect(() => {
    if (loadingThread) return;
    const pending = pendingScrollRef.current;
    if (!pending) return;

    const run = () => {
      if (pending === 'bottom') {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      } else {
        const el = document.getElementById(`chat-msg-${pending.unreadId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      pendingScrollRef.current = null;
    };

    // Esperar a que el DOM pinte los mensajes
    const t = window.setTimeout(run, 50);
    return () => window.clearTimeout(t);
  }, [messages, loadingThread]);

  useEffect(() => {
    const upsertDeleted = (payload: { conversation_id: string; message: ChatMessage }) => {
      if (!payload?.conversation_id || !payload.message) return;
      if (payload.conversation_id === activeId) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === payload.message.id);
          if (idx === -1) return [...prev, payload.message];
          const next = [...prev];
          next[idx] = payload.message;
          return next;
        });
      }
      void loadConversations();
    };

    const onMsg = (payload: { conversation_id: string; message: ChatMessage }) => {
      if (!payload?.conversation_id || !payload.message) return;
      const myId = user?.id || user?.userId;
      if (payload.message.author_id && myId && payload.message.author_id !== myId) {
        socket.emit('chat_delivered', {
          conversation_id: payload.conversation_id,
          message_id: payload.message.id,
        });
      }
      if (payload.conversation_id === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        // Si el usuario está arriba leyendo historial, no lo arrastramos al fondo:
        // mostramos el botón «Nuevos ↓». Si está cerca del fondo, baja solo.
        const el = threadScrollRef.current;
        if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 140) {
          pendingScrollRef.current = 'bottom';
          setShowJumpBottom(false);
        } else {
          setShowJumpBottom(true);
        }
        void markConversationRead(payload.conversation_id);
      }
      void loadConversations();
    };

    const onReceipt = (payload: {
      conversation_id: string;
      message_id: string;
      receipt_status: ChatMessage['receipt_status'];
    }) => {
      if (!payload?.message_id || !payload.receipt_status) return;
      // Actualizar aunque no sea el hilo activo (al volver al chat se ve el estado)
      setMessages((prev) => {
        if (!prev.some((m) => m.id === payload.message_id)) return prev;
        return prev.map((m) =>
          m.id === payload.message_id ? { ...m, receipt_status: payload.receipt_status } : m
        );
      });
    };

    socket.on('chat_message', onMsg);
    socket.on('chat_message_deleted', upsertDeleted);
    socket.on('chat_receipt', onReceipt);
    return () => {
      socket.off('chat_message', onMsg);
      socket.off('chat_message_deleted', upsertDeleted);
      socket.off('chat_receipt', onReceipt);
    };
  }, [activeId, loadConversations, user?.id, user?.userId]);

  // Al volver a la app (móvil): reconectar socket y refrescar hilo
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      ensureSocketConnected();
      void loadConversations();
      if (activeId) void loadThread(activeId);
    };
    document.addEventListener('visibilitychange', onVisible);
    socket.on('connect', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      socket.off('connect', onVisible);
    };
  }, [activeId, loadConversations, loadThread]);

  const openConversation = (id: string) => {
    setActiveId(id);
    setMobileShowThread(true);
    setSearchParams({ c: id });
    setCompose(null);
  };

  const handleSoftDelete = async (message: ChatMessage) => {
    if (!activeId || !canAuthorSoftDelete(message, user?.id)) return;
    if (!window.confirm('¿Eliminar este mensaje? Quedará como «Mensaje eliminado».')) return;
    setDeletingId(message.id);
    setError(null);
    try {
      const updated = await softDeleteChatMessage(activeId, message.id);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      await loadConversations();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar el mensaje');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSend = async () => {
    if (!activeId || (!body.trim() && !file)) return;
    setSending(true);
    setError(null);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      conversation_id: activeId,
      author_id: user?.id || user?.userId || '',
      author: user?.name
        ? { id: user.id || user.userId || '', name: user.name, role: user.role || '' }
        : undefined,
      body: body.trim() || (file ? `(archivo) ${file.name}` : ''),
      attachment_url: null,
      attachment_name: file?.name || null,
      created_at: new Date().toISOString(),
      receipt_status: 'sending',
    };
    setMessages((prev) => [...prev, optimistic]);
    pendingScrollRef.current = 'bottom';
    const pendingBody = body.trim();
    const pendingFile = file;
    setBody('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
    try {
      const msg = await sendChatMessage(activeId, { body: pendingBody, attachment: pendingFile });
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === msg.id)) {
          return withoutTemp.map((m) =>
            m.id === msg.id ? { ...msg, receipt_status: msg.receipt_status || 'sent' } : m
          );
        }
        return [...withoutTemp, { ...msg, receipt_status: msg.receipt_status || 'sent' }];
      });
      await loadConversations();
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setBody(pendingBody);
      setFile(pendingFile);
      setError(err?.response?.data?.error || 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  };

  // Arrastrar y soltar archivos en el hilo: lo adjunta al compositor para enviarlo.
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault(); // necesario para habilitar el drop
  };

  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragActive(false);
    if (!activeId) return;
    const dropped = e.dataTransfer?.files?.[0];
    if (!dropped) return;
    if (!isAcceptedChatFile(dropped)) {
      setError('Tipo de archivo no permitido: usa imágenes, PDF, Word, Excel o TXT');
      return;
    }
    setError(null);
    setFile(dropped);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCreateDirect = async () => {
    if (!pickUserId) return;
    setCreating(true);
    setError(null);
    try {
      const c = await createDirectConversation(pickUserId);
      await loadConversations();
      openConversation(c.id);
      setPickUserId('');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo crear el chat');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim() || groupIds.length === 0) {
      setError('Indica un título y al menos un participante');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const c = await createGroupConversation(groupTitle.trim(), groupIds);
      await loadConversations();
      openConversation(c.id);
      setGroupTitle('');
      setGroupIds([]);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo crear el grupo');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className={`flex min-h-[320px] flex-col gap-3 ${
        isTechMobileShell
          ? 'h-[calc(100dvh-11.5rem)] md:h-[calc(100dvh-5.5rem)]'
          : 'h-[calc(100dvh-5.5rem)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare size={20} className="text-emerald-600" /> Mensajes
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Chat 1:1 y grupos con el equipo activo.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCompose(compose === 'direct' ? null : 'direct');
              setMobileShowThread(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Plus size={14} /> Chat
          </button>
          <button
            type="button"
            onClick={() => {
              setCompose(compose === 'group' ? null : 'group');
              setMobileShowThread(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Users size={14} /> Grupo
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {error}
        </div>
      )}

      {compose && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {compose === 'direct' ? (
            <>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Nuevo chat 1:1</h2>
              <SearchableSelect
                value={pickUserId}
                onChange={setPickUserId}
                options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
                allowEmpty
                emptyLabel="Selecciona usuario…"
                placeholder="Buscar…"
                inputClassName="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 pr-8 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!pickUserId || creating}
                  onClick={() => void handleCreateDirect()}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {creating ? 'Abriendo…' : 'Abrir chat'}
                </button>
                <button
                  type="button"
                  onClick={() => setCompose(null)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Nuevo grupo</h2>
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Nombre del grupo"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                {users.map((u) => {
                  const checked = groupIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 dark:border-slate-800"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setGroupIds((prev) =>
                            checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                          )
                        }
                      />
                      <span className="font-medium text-slate-800 dark:text-slate-100">{u.name}</span>
                      <span className="text-xs text-slate-400">{u.role}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void handleCreateGroup()}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {creating ? 'Creando…' : 'Crear grupo'}
                </button>
                <button
                  type="button"
                  onClick={() => setCompose(null)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {/* Lista */}
        <aside
          className={`w-full shrink-0 border-r border-slate-100 dark:border-slate-800 md:w-80 ${
            mobileShowThread ? 'hidden md:block' : 'block'
          }`}
        >
          <div className="h-full overflow-y-auto">
            {loadingList ? (
              <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">
                Aún no hay conversaciones. Usa «Chat» o «Grupo».
              </p>
            ) : (
              conversations.map((c) => {
                const myId = user?.id || user?.userId;
                const other =
                  c.type === 'DIRECT'
                    ? c.participants.find((p) => p.user_id !== myId)?.user
                    : undefined;
                const last = c.last_message;
                const preview = last
                  ? last.is_deleted
                    ? 'Mensaje eliminado'
                    : last.body || (last.attachment_url ? '📎 Archivo' : '')
                  : 'Sin mensajes aún';
                const online = other ? onlineIds.has(other.id) : false;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-3 py-2.5 text-left transition-colors dark:border-slate-800 ${
                      activeId === c.id
                        ? 'bg-emerald-50 dark:bg-emerald-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex w-full items-center gap-2.5">
                      {c.type === 'GROUP' ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          <Users size={16} />
                        </div>
                      ) : (
                        <div className="relative h-10 w-10 shrink-0">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColorOf(
                              other?.name || c.title,
                            )}`}
                          >
                            {initialsOf(other?.name || c.title)}
                          </div>
                          {online && (
                            <span
                              className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900"
                              title="En línea"
                            />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {c.title}
                          </span>
                          {last && (
                            <span className="ml-auto shrink-0 text-[10px] text-slate-400">
                              {lastMsgTime(last.created_at)}
                            </span>
                          )}
                          {c.unread_count > 0 && (
                            <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {c.unread_count > 99 ? '99+' : c.unread_count}
                            </span>
                          )}
                        </div>
                        <p
                          className={`truncate text-xs ${
                            c.unread_count > 0
                              ? 'font-semibold text-slate-700 dark:text-slate-200'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {last && last.author_id === myId && !last.is_deleted ? 'Tú: ' : ''}
                          {preview}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Hilo */}
        <section
          className={`relative flex min-w-0 flex-1 flex-col ${
            mobileShowThread ? 'flex' : 'hidden md:flex'
          }`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragActive && activeId && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50/85 dark:border-emerald-500/70 dark:bg-emerald-950/70">
              <div className="flex flex-col items-center gap-2 px-4 text-center text-emerald-700 dark:text-emerald-300">
                <Paperclip size={30} />
                <p className="text-sm font-bold">Suelta el archivo para adjuntarlo</p>
                <p className="text-xs opacity-80">Imágenes, PDF, Word, Excel o TXT</p>
              </div>
            </div>
          )}
          {!activeId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
              <MessageSquare size={36} className="opacity-40" />
              <p className="text-sm">Selecciona o crea una conversación</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
                  onClick={() => {
                    setMobileShowThread(false);
                    setSearchParams({});
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-black text-slate-900 dark:text-white">
                    {active?.title || 'Conversación'}
                  </h2>
                  {activeSubtitle && (
                    <p className="truncate text-[11px] text-slate-400">
                      {active?.type === 'DIRECT' ? (
                        <>
                          {activeOther?.role && <span>{activeOther.role}</span>}
                          {activeOther?.role && onlineIds.has(activeOther.id) && (
                            <span> · </span>
                          )}
                          {onlineIds.has(activeOther?.id || '') && (
                            <span className="font-semibold text-emerald-600">En línea</span>
                          )}
                        </>
                      ) : (
                        activeSubtitle
                      )}
                    </p>
                  )}
                </div>
              </header>

              <div
                ref={threadScrollRef}
                onScroll={() => {
                  const el = threadScrollRef.current;
                  if (!el) return;
                  // Llegó al fondo → oculta el botón «Nuevos ↓».
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
                    setShowJumpBottom(false);
                  }
                  // Cerca del tope → carga automática de mensajes anteriores.
                  if (el.scrollTop < 120 && hasMoreOlder && !loadingOlder) {
                    void loadOlderMessages();
                  }
                }}
                className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
              >
                {loadingThread ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-slate-400" size={22} />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="pointer-events-none select-none py-10 text-center text-sm font-medium text-slate-400 dark:text-slate-500">
                    Sin mensajes
                  </p>
                ) : (
                  <>
                  <div className="flex justify-center pb-1">
                    <button
                      type="button"
                      disabled={!hasMoreOlder || loadingOlder}
                      onClick={() => void loadOlderMessages()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {loadingOlder ? (
                        <Loader2 size={14} className="animate-spin text-emerald-600" />
                      ) : null}
                      Cargar mensajes anteriores
                    </button>
                  </div>
                  {messages.map((m, idx) => {
                    const mine = m.author_id === user?.id;
                    const deleted = Boolean(m.is_deleted);
                    const canDelete = canAuthorSoftDelete(m, user?.id);
                    void nowTick; // re-eval ventana 10 min
                    const att = deleted ? null : chatAttachmentUrl(m.attachment_url);
                    const img =
                      att &&
                      (m.attachment_url?.match(/\.(png|jpe?g|gif|webp)$/i) ||
                        m.attachment_name?.match(/\.(png|jpe?g|gif|webp)$/i));
                    const showUnreadDivider = unreadDividerId === m.id;
                    const prev = idx > 0 ? messages[idx - 1] : null;
                    const showDayDivider = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                    const grouped = Boolean(
                      prev &&
                        !deleted &&
                        !prev.is_deleted &&
                        prev.author_id === m.author_id &&
                        !showDayDivider &&
                        new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <
                          GROUP_GAP_MS,
                    );
                    return (
                      <div
                        key={m.id}
                        id={`chat-msg-${m.id}`}
                        className={`scroll-mt-2 ${grouped ? '-mt-1' : ''}`}
                      >
                        {showUnreadDivider && (
                          <div
                            className="mb-2 flex items-center gap-2 py-1"
                            role="separator"
                            aria-label="Mensajes nuevos"
                          >
                            <div className="h-px flex-1 bg-amber-400/70" />
                            <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Mensajes nuevos
                            </span>
                            <div className="h-px flex-1 bg-amber-400/70" />
                          </div>
                        )}
                        {showDayDivider && (
                          <div className="my-2 flex items-center justify-center">
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {dayLabel(m.created_at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                          {!mine && !deleted && (
                            grouped ? (
                              <div className="w-6 shrink-0" />
                            ) : (
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColorOf(
                                  m.author?.name || '?',
                                )}`}
                                title={m.author?.name}
                              >
                                {initialsOf(m.author?.name || '?')}
                              </div>
                            )
                          )}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            deleted
                              ? 'bg-slate-50 text-slate-400 italic dark:bg-slate-800/50 dark:text-slate-500'
                              : mine
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {!mine && !deleted && !grouped && active?.type === 'GROUP' && (
                            <p className="mb-0.5 text-[10px] font-bold opacity-70">
                              {m.author?.name || 'Usuario'}
                            </p>
                          )}
                          {deleted ? (
                            <p className="text-xs not-italic font-medium">Mensaje eliminado</p>
                          ) : (
                            <>
                              {m.body && !m.body.startsWith('(archivo)') && (
                                <p className="whitespace-pre-wrap break-words">
                                  {linkifyBody(
                                    m.body,
                                    mine
                                      ? 'text-white decoration-white/80'
                                      : 'text-emerald-700 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200'
                                  )}
                                </p>
                              )}
                              {att && img && (
                                <button
                                  type="button"
                                  onClick={() => setZoomSrc(att)}
                                  className="mt-1 block overflow-hidden rounded-lg"
                                >
                                  <img
                                    src={att}
                                    alt={m.attachment_name || 'Adjunto'}
                                    className="max-h-48 max-w-full object-cover"
                                  />
                                </button>
                              )}
                              {att && !img && (
                                <a
                                  href={att}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold underline ${
                                    mine
                                      ? 'text-emerald-50'
                                      : 'text-emerald-700 dark:text-emerald-300'
                                  }`}
                                >
                                  <Paperclip size={12} />
                                  {m.attachment_name || 'Archivo'}
                                </a>
                              )}
                            </>
                          )}
                          <div
                            className={`mt-1 flex items-center gap-2 text-[10px] ${
                              deleted
                                ? 'text-slate-400'
                                : mine
                                  ? 'text-emerald-100'
                                  : 'text-slate-400'
                            }`}
                          >
                            <span>{fmtTime(m.created_at)}</span>
                            {mine && !deleted && (
                              <MessageTicks
                                status={m.receipt_status || 'sent'}
                                onMineBubble
                              />
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                disabled={deletingId === m.id}
                                onClick={() => void handleSoftDelete(m)}
                                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-semibold text-emerald-50/90 hover:bg-emerald-700/50 disabled:opacity-50"
                                title="Eliminar (hasta 10 min)"
                              >
                                {deletingId === m.id ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Trash2 size={11} />
                                )}
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
                <div ref={bottomRef} />
              </div>

              {showJumpBottom && (
                <button
                  type="button"
                  onClick={() => {
                    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    setShowJumpBottom(false);
                  }}
                  className="absolute bottom-20 right-4 z-10 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-700"
                  title="Ir a los mensajes nuevos"
                >
                  <ArrowDown size={14} /> Nuevos
                </button>
              )}

              <footer className="border-t border-slate-100 p-2.5 dark:border-slate-800">
                {file && (
                  <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 text-xs dark:bg-slate-800">
                    <Paperclip size={12} />
                    <span className="truncate flex-1">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-1.5">
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
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    title="Adjuntar"
                  >
                    <ImageIcon size={18} />
                  </button>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={1}
                    placeholder="Escribe un mensaje…"
                    className="max-h-28 min-h-[2.5rem] flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={sending || (!body.trim() && !file)}
                    onClick={() => void handleSend()}
                    className="rounded-xl bg-emerald-600 p-2.5 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>

      {zoomSrc && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomSrc(null)}
        >
          <img
            src={zoomSrc}
            alt="Adjunto"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-2"
            onClick={() => setZoomSrc(null)}
          >
            <XIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
