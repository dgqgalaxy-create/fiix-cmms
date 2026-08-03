import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  StickyNote,
  Plus,
  Check,
  Trash2,
  RefreshCw,
  ClipboardList,
  User as UserIcon,
  Wrench,
  Database,
  Pencil,
  AlarmClock,
  RotateCcw,
  X as XIcon,
  Megaphone,
} from 'lucide-react';
import {
  listPersonalNotes,
  createPersonalNote,
  updatePersonalNote,
  deletePersonalNote,
  snoozePersonalNote,
  listOperationalTasks,
  createOperationalTask,
  updateOperationalTask,
  deleteOperationalTask,
  snoozeOperationalTask,
  searchNotesLinks,
  getNotesSummary,
  type PersonalNote,
  type OperationalTask,
  type TaskScope,
  type TaskPriority,
  type SnoozeMode,
} from '../api/notes';
import { getUsers, type User } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { formatDateTime } from '../utils/dateUtils';
import { AnnouncementsPanel } from '../components/AnnouncementsPanel';

type Tab = 'notes' | 'tasks' | 'avisos';

function fromLocalInputValue(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toLocalInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dueTone(iso?: string | null): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!iso) return 'none';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'none';
  const now = Date.now();
  if (t < now) return 'overdue';
  if (t - now < 24 * 60 * 60 * 1000) return 'soon';
  return 'ok';
}

export default function NotesPage() {
  const { user } = useAuth();
  const userId = user?.userId;
  const canManageTasks =
    user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab');
    if (t === 'tasks') return 'tasks';
    if (t === 'avisos') return 'avisos';
    return 'notes';
  });
  const [unreadAvisos, setUnreadAvisos] = useState(0);
  const [includeDone, setIncludeDone] = useState(false);
  const [taskScope, setTaskScope] = useState<TaskScope>('mine');
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteRemind, setNoteRemind] = useState('');
  const [editingNote, setEditingNote] = useState<PersonalNote | null>(null);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskBody, setTaskBody] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('NORMAL');
  const [taskWoId, setTaskWoId] = useState<string | null>(null);
  const [taskWoLabel, setTaskWoLabel] = useState('');
  const [taskAssetId, setTaskAssetId] = useState<string | null>(null);
  const [taskAssetLabel, setTaskAssetLabel] = useState('');
  const [linkQuery, setLinkQuery] = useState('');
  const [linkHits, setLinkHits] = useState<{
    assets: { id: string; name: string; internal_code: string }[];
    work_orders: { id: string; folio: number; title: string }[];
  }>({ assets: [], work_orders: [] });
  const [editingTask, setEditingTask] = useState<OperationalTask | null>(null);
  const [completeTask, setCompleteTask] = useState<OperationalTask | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  const refreshUnreadAvisos = useCallback(async () => {
    try {
      const s = await getNotesSummary();
      setUnreadAvisos(s.unread_announcements || 0);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(
    async (background = false) => {
      try {
        if (!background) setLoading(true);
        setError(null);
        const [n, t] = await Promise.all([
          listPersonalNotes(includeDone),
          listOperationalTasks(includeDone, taskScope),
        ]);
        setNotes(n);
        setTasks(t);
        await refreshUnreadAvisos();
      } catch (err: any) {
        console.error(err);
        setError(err?.response?.data?.error || 'No se pudo cargar notas/pendientes');
      } finally {
        if (!background) setLoading(false);
      }
    },
    [includeDone, taskScope, refreshUnreadAvisos]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    getUsers()
      .then((list) => setUsers(list.filter((u) => u.is_active !== false)))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (userId && !taskAssignee) setTaskAssignee(userId);
  }, [userId, taskAssignee]);

  // Prefill from OT detail (?tab=tasks&wo=&folio=) — solo Admin/Gestionador
  useEffect(() => {
    if (!canManageTasks) return;
    const wo = searchParams.get('wo');
    const folio = searchParams.get('folio');
    const title = searchParams.get('title');
    if (wo) {
      setTab('tasks');
      setTaskWoId(wo);
      setTaskWoLabel(folio ? `OT-${folio}${title ? ` · ${title}` : ''}` : wo);
      if (title && !taskTitle) setTaskTitle(`Seguimiento: ${title}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canManageTasks) return;
    if (searchParams.get('tab') === 'tasks' || searchParams.get('wo')) {
      setTab('tasks');
    }
  }, [canManageTasks, searchParams]);

  useSocketRefresh('refresh_notes', () => void load(true));

  useEffect(() => {
    if (!linkQuery.trim() || linkQuery.trim().length < 2) {
      setLinkHits({ assets: [], work_orders: [] });
      return;
    }
    const t = window.setTimeout(() => {
      void searchNotesLinks(linkQuery.trim())
        .then(setLinkHits)
        .catch(() => setLinkHits({ assets: [], work_orders: [] }));
    }, 300);
    return () => window.clearTimeout(t);
  }, [linkQuery]);

  const openNotesCount = useMemo(() => notes.filter((n) => !n.is_done).length, [notes]);
  const openTasksCount = useMemo(() => tasks.filter((t) => t.status === 'OPEN').length, [tasks]);

  const resetTaskForm = () => {
    setTaskTitle('');
    setTaskBody('');
    setTaskDue('');
    setTaskPriority('NORMAL');
    setTaskWoId(null);
    setTaskWoLabel('');
    setTaskAssetId(null);
    setTaskAssetLabel('');
    setLinkQuery('');
    setEditingTask(null);
    if (userId) setTaskAssignee(userId);
    if (searchParams.has('wo')) {
      const next = new URLSearchParams(searchParams);
      next.delete('wo');
      next.delete('folio');
      next.delete('title');
      setSearchParams(next, { replace: true });
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      setError('Escribe un título para la nota');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: noteTitle.trim(),
        body: noteBody.trim() || null,
        remind_at: fromLocalInputValue(noteRemind),
      };
      if (editingNote) {
        await updatePersonalNote(editingNote.id, payload);
      } else {
        await createPersonalNote({
          title: payload.title,
          body: payload.body || undefined,
          remind_at: payload.remind_at,
        });
      }
      setNoteTitle('');
      setNoteBody('');
      setNoteRemind('');
      setEditingNote(null);
      await load(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo guardar la nota');
    } finally {
      setSaving(false);
    }
  };

  const startEditNote = (note: PersonalNote) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteBody(note.body || '');
    setNoteRemind(toLocalInputValue(note.remind_at));
    setTab('notes');
  };

  const handleSaveTask = async () => {
    if (!canManageTasks) {
      setError('Solo Administradores y Gestionadores pueden crear o editar pendientes');
      return;
    }
    if (!taskTitle.trim()) {
      setError('Escribe un título para el pendiente');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingTask) {
        await updateOperationalTask(editingTask.id, {
          title: taskTitle.trim(),
          body: taskBody.trim() || null,
          assignee_id: taskAssignee || userId,
          due_at: fromLocalInputValue(taskDue),
          priority: taskPriority,
          work_order_id: taskWoId,
          asset_id: taskAssetId,
        });
      } else {
        await createOperationalTask({
          title: taskTitle.trim(),
          body: taskBody.trim() || undefined,
          assignee_id: taskAssignee || userId,
          due_at: fromLocalInputValue(taskDue),
          priority: taskPriority,
          work_order_id: taskWoId || undefined,
          asset_id: taskAssetId || undefined,
        });
      }
      resetTaskForm();
      await load(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo guardar el pendiente');
    } finally {
      setSaving(false);
    }
  };

  const startEditTask = (task: OperationalTask) => {
    if (!canManageTasks || task.created_by_id !== userId) {
      setError('Solo el Administrador o Gestionador que creó el pendiente puede editarlo');
      return;
    }
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskBody(task.body || '');
    setTaskAssignee(task.assignee_id);
    setTaskDue(toLocalInputValue(task.due_at));
    setTaskPriority(task.priority === 'ALTA' ? 'ALTA' : 'NORMAL');
    setTaskWoId(task.work_order_id || null);
    setTaskWoLabel(
      task.work_order ? `OT-${task.work_order.folio} · ${task.work_order.title}` : ''
    );
    setTaskAssetId(task.asset_id || null);
    setTaskAssetLabel(
      task.asset ? `${task.asset.internal_code} · ${task.asset.name}` : ''
    );
    setTab('tasks');
  };

  const confirmComplete = async () => {
    if (!completeTask) return;
    setSaving(true);
    try {
      await updateOperationalTask(completeTask.id, {
        status: 'DONE',
        completion_note: completionNote.trim() || null,
      });
      setCompleteTask(null);
      setCompletionNote('');
      await load(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo completar');
    } finally {
      setSaving(false);
    }
  };

  const cardToneClass = (tone: ReturnType<typeof dueTone>, done: boolean) => {
    if (done) return 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900/40';
    if (tone === 'overdue') return 'border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/30';
    if (tone === 'soon') return 'border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30';
    return 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
  };

  return (
    <div className="space-y-3 sm:space-y-5 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <StickyNote className="text-amber-500 shrink-0" size={22} />
            <span className="truncate">Notas y pendientes</span>
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Notas privadas · Pendientes · Avisos globales del equipo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeDone}
              onChange={(e) => setIncludeDone(e.target.checked)}
              className="rounded border-slate-300"
            />
            Completados
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('notes')}
          className={`shrink-0 px-3 py-2 text-xs sm:text-sm font-bold border-b-2 -mb-px ${
            tab === 'notes'
              ? 'border-amber-500 text-amber-700 dark:text-amber-300'
              : 'border-transparent text-slate-500'
          }`}
        >
          Mis notas ({openNotesCount})
        </button>
        <button
          type="button"
          onClick={() => setTab('tasks')}
          className={`shrink-0 px-3 py-2 text-xs sm:text-sm font-bold border-b-2 -mb-px ${
            tab === 'tasks'
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300'
              : 'border-transparent text-slate-500'
          }`}
        >
          Pendientes ({openTasksCount})
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('avisos');
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('tab', 'avisos');
              return next;
            });
          }}
          className={`shrink-0 px-3 py-2 text-xs sm:text-sm font-bold border-b-2 -mb-px inline-flex items-center gap-1 ${
            tab === 'avisos'
              ? 'border-sky-500 text-sky-700 dark:text-sky-300'
              : 'border-transparent text-slate-500'
          }`}
        >
          <Megaphone size={14} />
          Avisos
          {unreadAvisos > 0 && (
            <span className="ml-0.5 rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-black text-white tabular-nums">
              {unreadAvisos > 99 ? '99+' : unreadAvisos}
            </span>
          )}
        </button>
      </div>

      {tab === 'avisos' ? null : tab === 'notes' ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Solo tú ves estas notas. Nadie más en el equipo puede leerlas.
        </p>
      ) : (
        <p className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          Solo Admin y Gestionador crean y editan pendientes. Los técnicos asignados solo los ven y pueden completarlos.
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {error}
        </div>
      )}

      {tab === 'notes' && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <article className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                {editingNote ? <Pencil size={15} /> : <Plus size={15} />}
                {editingNote ? 'Editar nota' : 'Nueva nota'}
              </h2>
              {editingNote && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNote(null);
                    setNoteTitle('');
                    setNoteBody('');
                    setNoteRemind('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancelar
                </button>
              )}
            </div>
            <input
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Título"
              className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Detalle (opcional)"
              rows={2}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <label className="mt-2 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Recordatorio
              <input
                type="datetime-local"
                value={noteRemind}
                onChange={(e) => setNoteRemind(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSaveNote()}
              disabled={saving}
              className="mt-2.5 w-full rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : editingNote ? 'Guardar cambios' : 'Guardar nota'}
            </button>
          </article>

          <div className="space-y-1.5 sm:space-y-2">
            {loading && notes.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Cargando…</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">Sin notas todavía.</p>
            ) : (
              notes.map((note) => {
                const tone = dueTone(note.remind_at);
                return (
                  <article
                    key={note.id}
                    className={`rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5 shadow-sm ${cardToneClass(tone, note.is_done)}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-bold text-slate-900 dark:text-slate-100 ${
                            note.is_done ? 'line-through' : ''
                          }`}
                        >
                          {note.title}
                        </p>
                        {note.body && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-3">
                            {note.body}
                          </p>
                        )}
                        {note.remind_at && (
                          <p
                            className={`mt-1 text-[11px] font-medium ${
                              tone === 'overdue'
                                ? 'text-rose-700 dark:text-rose-300'
                                : tone === 'soon'
                                  ? 'text-amber-800 dark:text-amber-300'
                                  : 'text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {tone === 'overdue' ? 'Vencido · ' : tone === 'soon' ? 'Pronto · ' : ''}
                            {formatDateTime(note.remind_at)}
                            {note.reminded_at ? ' · avisado' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
                        {!note.is_done && (
                          <>
                            <button
                              type="button"
                              title="Editar"
                              onClick={() => startEditNote(note)}
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              title="+1 hora"
                              onClick={() =>
                                void snoozePersonalNote(note.id, '1h').then(() => load(true))
                              }
                              className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            >
                              <AlarmClock size={15} />
                            </button>
                            <button
                              type="button"
                              title="Mañana 9:00"
                              onClick={() =>
                                void snoozePersonalNote(note.id, 'tomorrow').then(() => load(true))
                              }
                              className="rounded-lg px-1.5 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-50 dark:text-amber-300"
                            >
                              +1d
                            </button>
                            <button
                              type="button"
                              title="Hecha"
                              onClick={() =>
                                void updatePersonalNote(note.id, { is_done: true }).then(() =>
                                  load(true)
                                )
                              }
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                              <Check size={15} />
                            </button>
                          </>
                        )}
                        {note.is_done && (
                          <button
                            type="button"
                            title="Reabrir"
                            onClick={() =>
                              void updatePersonalNote(note.id, { is_done: false }).then(() =>
                                load(true)
                              )
                            }
                            className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Eliminar"
                          onClick={() => {
                            if (!window.confirm('¿Eliminar esta nota?')) return;
                            void deletePersonalNote(note.id).then(() => load(true));
                          }}
                          className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['mine', 'Todos los míos'],
                ['assigned', 'Asignados a mí'],
                ['created', 'Creados por mí'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTaskScope(value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  taskScope === value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {canManageTasks ? (
            <article className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  {editingTask ? <Pencil size={15} /> : <ClipboardList size={15} />}
                  {editingTask ? 'Editar pendiente' : 'Nuevo pendiente'}
                </h2>
                {editingTask && (
                  <button type="button" onClick={resetTaskForm} className="text-xs text-slate-500">
                    Cancelar
                  </button>
                )}
              </div>
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Título"
                className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <textarea
                value={taskBody}
                onChange={(e) => setTaskBody(e.target.value)}
                placeholder="Detalle (opcional)"
                rows={2}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Asignar a
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Prioridad
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Vence
                <input
                  type="datetime-local"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              <label className="mt-2 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Buscar OT o activo
                <input
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                  placeholder="Folio, título, código MTTO…"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>
              {(linkHits.work_orders.length > 0 || linkHits.assets.length > 0) && (
                <div className="mt-1 max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                  {linkHits.work_orders.map((wo) => (
                    <button
                      key={wo.id}
                      type="button"
                      onClick={() => {
                        setTaskWoId(wo.id);
                        setTaskWoLabel(`OT-${wo.folio} · ${wo.title}`);
                        setLinkQuery('');
                        setLinkHits({ assets: [], work_orders: [] });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Wrench size={12} /> OT-{wo.folio} · {wo.title}
                    </button>
                  ))}
                  {linkHits.assets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setTaskAssetId(a.id);
                        setTaskAssetLabel(`${a.internal_code} · ${a.name}`);
                        setLinkQuery('');
                        setLinkHits({ assets: [], work_orders: [] });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Database size={12} /> {a.internal_code} · {a.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {taskWoLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                    {taskWoLabel}
                    <button type="button" onClick={() => { setTaskWoId(null); setTaskWoLabel(''); }}>
                      <XIcon size={12} />
                    </button>
                  </span>
                )}
                {taskAssetLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                    {taskAssetLabel}
                    <button
                      type="button"
                      onClick={() => {
                        setTaskAssetId(null);
                        setTaskAssetLabel('');
                      }}
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleSaveTask()}
                disabled={saving}
                className="mt-2.5 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Guardando…' : editingTask ? 'Guardar cambios' : 'Crear pendiente'}
              </button>
            </article>
            ) : (
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 lg:col-span-1">
                Como técnico solo ves los pendientes que te asignan y puedes completarlos. No puedes crearlos ni editarlos.
              </article>
            )}

            <div className={`space-y-1.5 sm:space-y-2 ${canManageTasks ? '' : 'lg:col-span-1'}`}>
              {loading && tasks.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Cargando…</p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">Sin pendientes.</p>
              ) : (
                tasks.map((task) => {
                  const tone = dueTone(task.due_at);
                  const done = task.status !== 'OPEN';
                  const isCreator = task.created_by_id === userId;
                  const isAssignee = task.assignee_id === userId;
                  const canEditTask = canManageTasks && isCreator;
                  return (
                    <article
                      key={task.id}
                      className={`rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5 shadow-sm ${cardToneClass(tone, done)}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {task.priority === 'ALTA' && (
                              <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                                Alta
                              </span>
                            )}
                            {!canEditTask && isAssignee && (
                              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                Solo lectura
                              </span>
                            )}
                            <p
                              className={`text-sm font-bold text-slate-900 dark:text-slate-100 ${
                                done ? 'line-through' : ''
                              }`}
                            >
                              {task.title}
                            </p>
                          </div>
                          {task.body && (
                            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-2">
                              {task.body}
                            </p>
                          )}
                          {task.completion_note && (
                            <p className="mt-0.5 text-[11px] italic text-slate-500">
                              Cierre: {task.completion_note}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <UserIcon size={11} /> {task.assignee?.name || '—'}
                            </span>
                            {task.due_at && (
                              <span
                                className={`font-medium ${
                                  tone === 'overdue'
                                    ? 'text-rose-700 dark:text-rose-300'
                                    : tone === 'soon'
                                      ? 'text-amber-800 dark:text-amber-300'
                                      : 'text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {tone === 'overdue' ? 'Vencido · ' : tone === 'soon' ? 'Pronto · ' : ''}
                                {formatDateTime(task.due_at)}
                              </span>
                            )}
                            {task.work_order && (
                              <Link
                                to={`/dashboard?wo=${task.work_order.id}`}
                                className="inline-flex items-center gap-1 text-sky-600 hover:underline"
                              >
                                <Wrench size={11} /> OT-{task.work_order.folio}
                              </Link>
                            )}
                            {task.asset && (
                              <Link
                                to={`/assets?q=${encodeURIComponent(task.asset.internal_code)}`}
                                className="inline-flex items-center gap-1 text-sky-600 hover:underline"
                              >
                                <Database size={11} /> {task.asset.internal_code}
                              </Link>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
                          {task.status === 'OPEN' && (
                            <>
                              {canEditTask && (
                                <>
                                  <button
                                    type="button"
                                    title="Editar"
                                    onClick={() => startEditTask(task)}
                                    className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    title="+1 hora"
                                    onClick={() =>
                                      void snoozeOperationalTask(task.id, '1h' as SnoozeMode).then(() =>
                                        load(true)
                                      )
                                    }
                                    className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-50"
                                  >
                                    <AlarmClock size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Mañana 9:00"
                                    onClick={() =>
                                      void snoozeOperationalTask(task.id, 'tomorrow').then(() =>
                                        load(true)
                                      )
                                    }
                                    className="rounded-lg px-1.5 py-1 text-[10px] font-bold text-amber-800"
                                  >
                                    +1d
                                  </button>
                                </>
                              )}
                              {(canEditTask || isAssignee) && (
                                <button
                                  type="button"
                                  title="Completar"
                                  onClick={() => {
                                    setCompleteTask(task);
                                    setCompletionNote('');
                                  }}
                                  className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                                >
                                  <Check size={15} />
                                </button>
                              )}
                            </>
                          )}
                          {task.status === 'DONE' && canEditTask && (
                            <button
                              type="button"
                              title="Reabrir"
                              onClick={() =>
                                void updateOperationalTask(task.id, { status: 'OPEN' }).then(() =>
                                  load(true)
                                )
                              }
                              className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                          {(canEditTask || (canManageTasks && user?.role === 'ADMINISTRADOR')) && (
                            <button
                              type="button"
                              title="Eliminar"
                              onClick={() => {
                                if (!window.confirm('¿Eliminar este pendiente?')) return;
                                void deleteOperationalTask(task.id).then(() => load(true));
                              }}
                              className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'avisos' && (
        <AnnouncementsPanel isAdmin={isAdmin} onChanged={() => void refreshUnreadAvisos()} />
      )}

      {completeTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Completar pendiente</h3>
            <p className="mt-1 text-xs text-slate-500">{completeTask.title}</p>
            <textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Comentario de cierre (opcional)"
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="mt-3 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCompleteTask(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmComplete()}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Completar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
