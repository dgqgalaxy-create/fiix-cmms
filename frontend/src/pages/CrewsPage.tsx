import { useEffect, useMemo, useState } from 'react';
import {
  Users, Plus, Pencil, Trash2, Loader2, X, Search, MapPin, CheckCircle2,
} from 'lucide-react';
import {
  getCrews, createCrew, updateCrew, deleteCrew, type Crew,
} from '../api/crews';
import { getUsers, type User } from '../api/users';
import { getZones, type Zone } from '../api/zones';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface Draft {
  id?: string;
  name: string;
  description: string;
  zone_id: string;
  members: string[];
}

const emptyDraft: Draft = { name: '', description: '', zone_id: '', members: [] };

/** Cuadrillas: grupos de trabajo reutilizables que se asignan a las órdenes. */
export default function CrewsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_USERS');

  const [crews, setCrews] = useState<Crew[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [saved, setSaved] = useState(false);

  useEscapeKey(() => {
    if (draft) setDraft(null);
  }, Boolean(draft));

  const load = async (background = false) => {
    try {
      if (!background) setLoading(true);
      const data = await getCrews();
      setCrews(data);
    } catch {
      setError('No se pudieron cargar las cuadrillas.');
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void getUsers().then(setUsers).catch(() => setUsers([]));
    void getZones().then(setZones).catch(() => setZones([]));
  }, []);

  useSocketRefresh('refresh_crews', () => { void load(true); });

  const activeUsers = useMemo(
    () => users.filter((user) => user.is_active).sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const term = memberSearch.trim().toLowerCase();
    if (!term) return activeUsers;
    return activeUsers.filter((user) => user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term));
  }, [activeUsers, memberSearch]);

  const openCreate = () => {
    setError(null);
    setMemberSearch('');
    setDraft({ ...emptyDraft });
  };

  const openEdit = (crew: Crew) => {
    setError(null);
    setMemberSearch('');
    setDraft({
      id: crew.id,
      name: crew.name,
      description: crew.description ?? '',
      zone_id: crew.zone?.id ?? '',
      members: crew.members.map((member) => member.user_id),
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) {
      setError('Escribe el nombre de la cuadrilla.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        zone_id: draft.zone_id || null,
        members: draft.members,
      };
      if (draft.id) {
        await updateCrew(draft.id, payload);
      } else {
        await createCrew(payload);
      }
      setDraft(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo guardar la cuadrilla.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (crew: Crew) => {
    if (!window.confirm(`¿Eliminar la cuadrilla «${crew.name}»? Sus ${crew.work_orders_count} orden(es) quedarán sin cuadrilla.`)) return;
    try {
      await deleteCrew(crew.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar la cuadrilla.');
    }
  };

  const toggleMember = (userId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      members: draft.members.includes(userId)
        ? draft.members.filter((id) => id !== userId)
        : [...draft.members, userId],
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
            <Users className="text-emerald-600 dark:text-emerald-400" size={28} />
            Cuadrillas
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-300">
            Agrupa al personal que trabaja junto y asígnalo a las órdenes de trabajo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={13} /> Guardado
            </span>
          )}
          {canManage && (
            <button type="button" onClick={openCreate} className="ui-btn-primary">
              <Plus size={15} /> Nueva cuadrilla
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {crews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <Users size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aún no hay cuadrillas</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Crea una para agrupar técnicos por zona o especialidad.
          </p>
        </div>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {crews.map((crew) => (
            <article key={crew.id} className="lift flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{crew.name}</h2>
                  {crew.zone && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <MapPin size={11} /> {crew.zone.name}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openEdit(crew)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => void remove(crew)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {crew.description && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{crew.description}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1">
                {crew.members.length === 0 && (
                  <span className="text-[11px] text-slate-400">Sin integrantes</span>
                )}
                {crew.members.map((member) => (
                  <span key={member.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {member.name}
                  </span>
                ))}
              </div>

              <p className="mt-auto pt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {crew.work_orders_count} orden(es) asignada(s)
              </p>
            </article>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDraft(null)}>
          <form
            onSubmit={save}
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {draft.id ? 'Editar cuadrilla' : 'Nueva cuadrilla'}
              </h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="crew-name">Nombre</label>
                <input
                  id="crew-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Ej. Cuadrilla eléctrica"
                  className="ui-input"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="crew-zone">Zona (opcional)</label>
                  <select
                    id="crew-zone"
                    value={draft.zone_id}
                    onChange={(event) => setDraft({ ...draft, zone_id: event.target.value })}
                    className="ui-input"
                  >
                    <option value="">Sin zona</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>{zone.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="crew-desc">Descripción</label>
                  <input
                    id="crew-desc"
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    placeholder="Opcional"
                    className="ui-input"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Integrantes ({draft.members.length})
                  </label>
                </div>
                <div className="relative mb-2">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Buscar persona…"
                    className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  {filteredUsers.map((user) => {
                    const checked = draft.members.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${checked ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleMember(user.id)} className="h-4 w-4 accent-emerald-600" />
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{user.name}</span>
                        <span className="shrink-0 text-[10px] uppercase text-slate-400">{user.role}</span>
                      </label>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <p className="px-2 py-3 text-center text-xs text-slate-400">Sin coincidencias.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
              <button type="button" onClick={() => setDraft(null)} className="ui-btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="ui-btn-primary">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {draft.id ? 'Guardar cambios' : 'Crear cuadrilla'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
