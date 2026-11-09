import { useEffect, useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { getCrews, assignCrewToWorkOrder, type Crew } from '../../api/crews';

interface Props {
  workOrderId: string;
  currentCrewId?: string | null;
  canWrite: boolean;
}

/** Selector de cuadrilla para una orden de trabajo. */
export function WorkOrderCrewSection({ workOrderId, currentCrewId, canWrite }: Props) {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [crewId, setCrewId] = useState<string>(currentCrewId ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCrewId(currentCrewId ?? '');
  }, [currentCrewId]);

  useEffect(() => {
    void getCrews()
      .then(setCrews)
      .catch(() => setError('No se pudieron cargar las cuadrillas.'))
      .finally(() => setLoading(false));
  }, []);

  const change = async (value: string) => {
    const previous = crewId;
    setCrewId(value);
    setSaving(true);
    setError(null);
    try {
      await assignCrewToWorkOrder(workOrderId, value || null);
    } catch {
      setCrewId(previous);
      setError('No se pudo asignar la cuadrilla.');
    } finally {
      setSaving(false);
    }
  };

  const selected = crews.find((crew) => crew.id === crewId);

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <Users size={15} className="text-emerald-600" /> Cuadrilla
        </h3>
        {saving && <Loader2 size={14} className="animate-spin text-emerald-600" />}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : (
        <>
          <select
            value={crewId}
            onChange={(event) => void change(event.target.value)}
            disabled={!canWrite || saving}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Sin cuadrilla</option>
            {crews.filter((crew) => crew.is_active).map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}{crew.members.length ? ` · ${crew.members.length} integrante(s)` : ''}
              </option>
            ))}
          </select>

          {selected && selected.members.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selected.members.map((member) => (
                <span key={member.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {member.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
