import { useEffect, useMemo, useState } from 'react';
import { HardHat, Plus, Pencil, Trash2, Loader2, X, Search, CheckCircle2 } from 'lucide-react';
import { getContractors, createContractor, updateContractor, deleteContractor, type Contractor } from '../api/contractors';
import { useAuth } from '../context/AuthContext';

interface Draft {
  id?: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  specialty: string;
  hourly_rate: string;
  visit_rate: string;
  contract_start: string;
  contract_end: string;
  notes: string;
}

const emptyDraft: Draft = {
  name: '', contact_name: '', phone: '', email: '', specialty: '',
  hourly_rate: '', visit_rate: '', contract_start: '', contract_end: '', notes: '',
};

const money = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

/** Contratistas: proveedores de servicios de mantenimiento. */
export default function ContractorsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_SETTINGS');

  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = async () => {
    try {
      setContractors(await getContractors());
    } catch {
      setError('No se pudieron cargar los contratistas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return contractors;
    return contractors.filter((contractor) =>
      contractor.name.toLowerCase().includes(term) ||
      (contractor.specialty ?? '').toLowerCase().includes(term) ||
      (contractor.contact_name ?? '').toLowerCase().includes(term)
    );
  }, [contractors, search]);

  const openCreate = () => { setError(null); setDraft({ ...emptyDraft }); };

  const openEdit = (contractor: Contractor) => {
    setError(null);
    setDraft({
      id: contractor.id,
      name: contractor.name,
      contact_name: contractor.contact_name ?? '',
      phone: contractor.phone ?? '',
      email: contractor.email ?? '',
      specialty: contractor.specialty ?? '',
      hourly_rate: contractor.hourly_rate != null ? String(contractor.hourly_rate) : '',
      visit_rate: contractor.visit_rate != null ? String(contractor.visit_rate) : '',
      contract_start: contractor.contract_start ? contractor.contract_start.slice(0, 10) : '',
      contract_end: contractor.contract_end ? contractor.contract_end.slice(0, 10) : '',
      notes: contractor.notes ?? '',
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.name.trim()) { setError('Escribe el nombre del contratista.'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        contact_name: draft.contact_name.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        specialty: draft.specialty.trim() || null,
        hourly_rate: draft.hourly_rate === '' ? null : Number(draft.hourly_rate),
        visit_rate: draft.visit_rate === '' ? null : Number(draft.visit_rate),
        contract_start: draft.contract_start || null,
        contract_end: draft.contract_end || null,
        notes: draft.notes.trim() || null,
      };
      if (draft.id) await updateContractor(draft.id, payload);
      else await createContractor(payload);
      setDraft(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo guardar el contratista.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (contractor: Contractor) => {
    if (!window.confirm(`¿Eliminar a «${contractor.name}»? Sus órdenes quedarán sin contratista.`)) return;
    try {
      await deleteContractor(contractor.id);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar.');
    }
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
            <HardHat className="text-emerald-600 dark:text-emerald-400" size={28} />
            Contratistas
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-300">
            Proveedores de servicios de mantenimiento: especialidad, tarifas y contratos.
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
              <Plus size={15} /> Nuevo contratista
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="relative mb-3 max-w-md">
        <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o especialidad…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <HardHat size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aún no hay contratistas</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Registra a los proveedores que hacen trabajos externos (eléctrico, mecánico, calibración…).
          </p>
        </div>
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((contractor) => (
            <article key={contractor.id} className="lift flex flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{contractor.name}</h2>
                  {contractor.specialty && (
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{contractor.specialty}</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openEdit(contractor)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => void remove(contractor)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                {contractor.contact_name && <p>Contacto: {contractor.contact_name}</p>}
                {contractor.phone && <p>Tel: {contractor.phone}</p>}
                {contractor.email && <p className="truncate">{contractor.email}</p>}
                {contractor.hourly_rate != null && <p>Hora: {money(contractor.hourly_rate)}</p>}
                {contractor.visit_rate != null && <p>Visita: {money(contractor.visit_rate)}</p>}
                {contractor.contract_end && (
                  <p className={new Date(contractor.contract_end) < new Date() ? 'font-semibold text-rose-600' : ''}>
                    Contrato hasta {new Date(contractor.contract_end).toLocaleDateString('es-MX')}
                  </p>
                )}
              </div>

              <p className="mt-auto pt-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {contractor.work_orders_count ?? 0} orden(es) asignada(s)
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
            className="animate-in fade-in zoom-in-95 duration-200 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-4 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {draft.id ? 'Editar contratista' : 'Nuevo contratista'}
              </h2>
              <button type="button" onClick={() => setDraft(null)} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-name">Nombre</label>
                <input id="ct-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-contact">Contacto</label>
                <input id="ct-contact" value={draft.contact_name} onChange={(e) => setDraft({ ...draft, contact_name: e.target.value })} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-specialty">Especialidad</label>
                <input id="ct-specialty" value={draft.specialty} onChange={(e) => setDraft({ ...draft, specialty: e.target.value })} placeholder="Eléctrica, mecánica…" className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-phone">Teléfono</label>
                <input id="ct-phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-email">Correo</label>
                <input id="ct-email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-hour">Tarifa por hora (MXN)</label>
                <input id="ct-hour" type="number" min="0" step="0.01" value={draft.hourly_rate} onChange={(e) => setDraft({ ...draft, hourly_rate: e.target.value })} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-visit">Tarifa por visita (MXN)</label>
                <input id="ct-visit" type="number" min="0" step="0.01" value={draft.visit_rate} onChange={(e) => setDraft({ ...draft, visit_rate: e.target.value })} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-start">Inicio de contrato</label>
                <input id="ct-start" type="date" value={draft.contract_start} onChange={(e) => setDraft({ ...draft, contract_start: e.target.value })} className="ui-input" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-end">Fin de contrato</label>
                <input id="ct-end" type="date" value={draft.contract_end} onChange={(e) => setDraft({ ...draft, contract_end: e.target.value })} className="ui-input" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="ct-notes">Notas</label>
                <textarea id="ct-notes" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="ui-input" />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
              <button type="button" onClick={() => setDraft(null)} className="ui-btn-secondary">Cancelar</button>
              <button type="submit" disabled={saving} className="ui-btn-primary">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {draft.id ? 'Guardar cambios' : 'Crear contratista'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
