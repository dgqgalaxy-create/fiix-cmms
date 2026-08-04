import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
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
import { getUsers, type User } from '../api/users';
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
import { socket } from '../api/socket';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { formatDateTime } from '../utils/dateUtils';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';

type ComposeMode = null | 'direct' | 'group';

export default function MessagesPage() {
  const { user } = useAuth();
  const isTechMobileShell = useTechnicianMobileShell();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(searchParams.get('c'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
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
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

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

  const loadThread = useCallback(async (id: string) => {
    try {
      setLoadingThread(true);
      const data = await listMessages(id);
      setMessages(data);
      await markConversationRead(id);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
      );
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron cargar los mensajes');
    } finally {
      setLoadingThread(false);
    }
  }, []);

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
      return;
    }
    void loadThread(activeId);
  }, [activeId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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
      if (payload.conversation_id === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        void markConversationRead(payload.conversation_id);
      }
      void loadConversations();
    };

    socket.on('chat_message', onMsg);
    socket.on('chat_message_deleted', upsertDeleted);
    return () => {
      socket.off('chat_message', onMsg);
      socket.off('chat_message_deleted', upsertDeleted);
    };
  }, [activeId, loadConversations]);

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
    try {
      const msg = await sendChatMessage(activeId, { body: body.trim(), attachment: file });
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setBody('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await loadConversations();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo enviar');
    } finally {
      setSending(false);
    }
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
              <select
                value={pickUserId}
                onChange={(e) => setPickUserId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Selecciona usuario…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
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
              conversations.map((c) => (
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
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {c.title}
                    </span>
                    {c.type === 'GROUP' && (
                      <Users size={12} className="shrink-0 text-slate-400" />
                    )}
                    {c.unread_count > 0 && (
                      <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {c.unread_count > 99 ? '99+' : c.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {c.last_message?.body || 'Sin mensajes aún'}
                  </p>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Hilo */}
        <section
          className={`flex min-w-0 flex-1 flex-col ${
            mobileShowThread ? 'flex' : 'hidden md:flex'
          }`}
        >
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
                  <p className="truncate text-[11px] text-slate-400">
                    {(active?.participants || [])
                      .map((p) => p.user?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {loadingThread ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-slate-400" size={22} />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="pointer-events-none select-none py-10 text-center text-sm font-medium text-slate-400 dark:text-slate-500">
                    Sin mensajes
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.author_id === user?.id;
                    const deleted = Boolean(m.is_deleted);
                    const canDelete = canAuthorSoftDelete(m, user?.id);
                    void nowTick; // re-eval ventana 10 min
                    const att = deleted ? null : chatAttachmentUrl(m.attachment_url);
                    const img =
                      att &&
                      (m.attachment_url?.match(/\.(png|jpe?g|gif|webp)$/i) ||
                        m.attachment_name?.match(/\.(png|jpe?g|gif|webp)$/i));
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            deleted
                              ? 'bg-slate-50 text-slate-400 italic dark:bg-slate-800/50 dark:text-slate-500'
                              : mine
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {!mine && !deleted && (
                            <p className="mb-0.5 text-[10px] font-bold opacity-70">
                              {m.author?.name || 'Usuario'}
                            </p>
                          )}
                          {deleted ? (
                            <p className="text-xs not-italic font-medium">Mensaje eliminado</p>
                          ) : (
                            <>
                              {m.body && !m.body.startsWith('(archivo)') && (
                                <p className="whitespace-pre-wrap break-words">{m.body}</p>
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
                            <span>{formatDateTime(m.created_at)}</span>
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
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

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
