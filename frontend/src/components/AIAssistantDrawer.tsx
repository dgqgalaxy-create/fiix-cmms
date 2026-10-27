import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  AlertCircle,
  Bot,
  Database,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  getAIStatus,
  sendAIMessage,
  type AIChatMessage,
  type AIStatus,
  type AIToolUsage
} from '../api/ai';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';

interface ChatBubble extends AIChatMessage {
  id: string;
  toolsUsed?: AIToolUsage[];
}

const WELCOME_MESSAGE: ChatBubble = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hola, soy **GTZ AI**. Puedo consultar órdenes de trabajo, inventario, activos, turnos y guías del sistema en tiempo real.\n\n¿Qué necesitas revisar hoy?'
};

const QUICK_PROMPTS = [
  'Órdenes pendientes hoy',
  'Repuestos con stock bajo',
  '¿Quién está en turno hoy?',
  '¿Cómo cierro una OT?'
];

const TOOL_LABELS: Record<string, string> = {
  get_work_orders: 'Órdenes',
  get_work_order_detail: 'Detalle de OT',
  search_inventory: 'Inventario',
  get_assets: 'Activos',
  get_maintenance_summary: 'Resumen de planta',
  get_roster_today: 'Turnos',
  get_app_guide: 'Guía'
};

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-3 text-base font-black first:mt-0">{children}</h3>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-3 text-sm font-black first:mt-0">{children}</h3>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-1.5 mt-2 text-sm font-bold first:mt-0">{children}</h4>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-4 border-emerald-300 bg-emerald-50/60 px-3 py-2 text-slate-600 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-slate-300">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200 dark:border-slate-700" />,
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
      {children}
    </pre>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <code
      className={
        className
          ? 'font-mono text-inherit'
          : 'rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.82em] text-rose-600 dark:bg-slate-800 dark:text-rose-300'
      }
    >
      {children}
    </code>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-slate-100 dark:bg-slate-800">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border-b border-slate-200 px-2.5 py-1.5 font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-slate-100 px-2.5 py-1.5 align-top last:border-b-0 dark:border-slate-800">
      {children}
    </td>
  )
};

export const AIAssistantDrawer = () => {
  const isTechMobileShell = useTechnicianMobileShell();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isUnavailable = Boolean(status && (!status.enabled || !status.hasKey));

  const loadStatus = async () => {
    try {
      const nextStatus = await getAIStatus();
      setStatus(nextStatus);
      setStatusError(false);
    } catch {
      setStatusError(true);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, error]);

  const handleSend = async (override?: string) => {
    const content = (override ?? input).trim();
    if (!content || isLoading) return;

    if (!navigator.onLine) {
      setError('No hay conexión a Internet. El asistente necesita conexión para consultar la base de datos.');
      return;
    }

    if (isUnavailable) {
      setError(
        status?.enabled === false
          ? 'El asistente está desactivado por el administrador.'
          : 'Falta configurar la API Key del asistente en el servidor.'
      );
      return;
    }

    const userMessage: ChatBubble = {
      id: `user-${Date.now()}`,
      role: 'user',
      content
    };

    const history: AIChatMessage[] = [...messages, userMessage]
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({ role: message.role, content: message.content }));

    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const result = await sendAIMessage(history);
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          toolsUsed: result.toolsUsed
        }
      ]);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        (err?.code === 'ECONNABORTED'
          ? 'El asistente tardó demasiado en responder. Intenta de nuevo.'
          : 'No se pudo conectar con el asistente. Revisa tu conexión e inténtalo de nuevo.');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handleClear = () => {
    if (isLoading) return;
    setMessages([WELCOME_MESSAGE]);
    setInput('');
    setError(null);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`fixed ${isTechMobileShell ? 'bottom-24' : 'bottom-5'} right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/25 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/40 md:bottom-6 md:right-6 print:hidden`}
          aria-label="Abrir asistente GTZ AI"
          title="Abrir asistente GTZ AI"
        >
          <Sparkles size={18} />
          <span className="hidden sm:inline">Asistente IA</span>
          <span className="sm:hidden">IA</span>
        </button>
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] md:bg-slate-950/20 print:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-md print:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Asistente GTZ AI"
          >
            <header className="flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 px-4 py-4 text-white">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <Bot size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-100/90">
                    GTZ AI
                  </p>
                  <h2 className="truncate text-base font-black">Asistente de mantenimiento</h2>
                  <p className="mt-0.5 truncate text-[11px] text-emerald-50/80">
                    {status
                      ? `${status.provider} · ${status.model}`
                      : statusError
                        ? 'Estado no disponible'
                        : 'Nivel 2 · datos en vivo'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isLoading}
                  className="rounded-lg p-2 text-emerald-50/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                  title="Nueva conversación"
                  aria-label="Nueva conversación"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-emerald-50/80 transition hover:bg-white/10 hover:text-white"
                  title="Cerrar asistente"
                  aria-label="Cerrar asistente"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            {(isUnavailable || statusError) && (
              <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {status?.enabled === false
                    ? 'El asistente está desactivado por el administrador.'
                    : status?.hasKey === false
                      ? 'Falta configurar AI_API_KEY en el servidor. Pide al administrador que complete la configuración.'
                      : 'No se pudo verificar el estado del asistente. Puedes intentar enviar una consulta.'}
                </span>
              </div>
            )}

            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4 dark:bg-slate-950">
              {messages.map((message) => {
                const toolNames = Array.from(
                  new Set((message.toolsUsed || []).map((tool) => tool.name))
                );
                const isUser = message.role === 'user';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={
                        isUser
                          ? 'max-w-[88%] rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2.5 text-sm text-white shadow-sm'
                          : 'max-w-[95%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                      }
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      ) : (
                        <div className="max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {message.content}
                          </ReactMarkdown>
                          {toolNames.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                              <Database size={12} className="text-emerald-600 dark:text-emerald-400" />
                              <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                Consultado
                              </span>
                              {toolNames.map((name) => (
                                <span
                                  key={name}
                                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                                >
                                  {TOOL_LABELS[name] || name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex max-w-[92%] items-center gap-2.5 rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <Loader2 size={16} className="animate-spin text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-100">
                        Consultando GTZ CMMS…
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Órdenes, inventario, activos o turnos
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {messages.length <= 1 && !isLoading && (
                <div className="space-y-2 pt-1">
                  <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Sugerencias
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void handleSend(prompt)}
                        disabled={isUnavailable}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={endOfMessagesRef} />
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSend();
              }}
              className="border-t border-slate-200 bg-white px-3 pb-3 pt-2 dark:border-slate-700 dark:bg-slate-900"
            >
              {error && (
                <div className="mb-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  maxLength={4000}
                  disabled={isLoading || isUnavailable}
                  placeholder={
                    isUnavailable
                      ? 'Asistente no disponible'
                      : 'Pregunta sobre órdenes, repuestos, activos o turnos…'
                  }
                  className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading || isUnavailable}
                  className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                  aria-label="Enviar mensaje"
                  title="Enviar mensaje"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
                <span>Solo lectura · No modifica datos</span>
                <span className="tabular-nums">{input.length}/4000</span>
              </div>
            </form>
          </aside>
        </>
      )}
    </>
  );
};
