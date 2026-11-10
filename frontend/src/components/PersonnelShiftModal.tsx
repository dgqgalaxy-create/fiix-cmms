import { useCallback, useEffect, useState } from 'react';
import { useAnimatedClose } from '../hooks/useAnimatedClose';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { X, Loader2, CalendarClock, Trash2, AlertTriangle, Check } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPatternHistory, assignPattern, removePattern, type TechnicianPattern } from '../api/roster';
import type { User } from '../api/users';

const shortLabel = (type: string) =>
  type === 'MIXTO' ? 'Mixto' : type === '4X4_FIJO' ? '4x4 fijo' : type === '4X4_ROTATORIO' ? '4x4 rotatorio' : type;

const fmtDay = (value: string) => format(new Date(`${value.slice(0, 10)}T12:00:00`), "d 'de' MMMM, yyyy", { locale: es });

/**
 * Turno de una persona con historial de patrones: aquí se programa un cambio
 * («desde el 1 de marzo, 4x4 rotatorio») sin perder los periodos anteriores.
 */
export const PersonnelShiftModal = ({
  user,
  isOpen,
  onClose,
  canManage,
  onSaved,
}: {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  canManage: boolean;
  onSaved: () => void;
}) => {
  const { closing, requestClose } = useAnimatedClose(onClose, true);
  useEscapeKey(requestClose, true && !closing);
  const [history, setHistory] = useState<TechnicianPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patternType, setPatternType] = useState('4X4_ROTATORIO');
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      setHistory(await getPatternHistory(user.id));
      setError(null);
    } catch {
      setError('No se pudo cargar el historial de turnos.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    void load();
    setError(null);
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
  }, [isOpen, user, load]);

  if (!isOpen || !user) return null;

  const current = history.find((item) => !item.end_date) ?? null;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await assignPattern({ user_id: user.id, pattern_type: patternType, start_date: startDate });
      await load();
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo programar el turno.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`¿Quitar el turno vigente de ${user.name}? El historial se conserva.`)) return;
    try {
      await removePattern(user.id);
      await load();
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo quitar el turno.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-900/50 backdrop-blur-sm" onClick={requestClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className={`flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-900 sm:rounded-l-2xl ${closing ? 'animate-slide-out-right' : 'animate-in slide-in-from-right duration-300'}`}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Turno y patrones</p>
          </div>
          <button onClick={requestClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Turno vigente</p>
            {isLoading ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
            ) : current ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CalendarClock size={13} /> {shortLabel(current.pattern_type)}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  desde {fmtDay(current.start_date)}
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sin turno asignado.</p>
            )}
          </div>

          {canManage && (
            <form onSubmit={handleSave} className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Programar turno</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Si eliges una fecha futura, el turno anterior se cierra el día anterior y este entra en vigor
                en la fecha indicada. Así puedes cambiar el patrón mes con mes o dejarlo fijo todo el año.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="shift-pattern">
                    Patrón
                  </label>
                  <select
                    id="shift-pattern"
                    value={patternType}
                    onChange={(event) => setPatternType(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="4X4_ROTATORIO">4x4 rotatorio (día / noche)</option>
                    <option value="4X4_FIJO">4x4 fijo (4 días, 4 de descanso)</option>
                    <option value="MIXTO">Mixto (domingo descanso)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="shift-start">
                    Vigente desde
                  </label>
                  <input
                    id="shift-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {current && (
                  <button
                    type="button"
                    onClick={() => void handleRemove()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 size={13} /> Quitar vigente
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
                </button>
              </div>
            </form>
          )}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Historial</p>
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando…</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hay turnos registrados.</p>
            ) : (
              <ol className="space-y-2">
                {history.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {shortLabel(item.pattern_type)}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {fmtDay(item.start_date)} → {item.end_date ? fmtDay(item.end_date) : 'vigente'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};