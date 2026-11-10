import { useEffect, useState } from 'react';
import { HardHat, Loader2 } from 'lucide-react';
import { getContractors, type Contractor } from '../../api/contractors';
import api from '../../api/axios';

interface Props {
  workOrderId: string;
  currentContractorId?: string | null;
  canWrite: boolean;
}

/** Selector de contratista para una orden de trabajo. */
export function WorkOrderContractorSection({ workOrderId, currentContractorId, canWrite }: Props) {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [contractorId, setContractorId] = useState<string>(currentContractorId ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setContractorId(currentContractorId ?? ''); }, [currentContractorId]);

  useEffect(() => {
    void getContractors()
      .then(setContractors)
      .catch(() => setError('No se pudieron cargar los contratistas.'))
      .finally(() => setLoading(false));
  }, []);

  const change = async (value: string) => {
    const previous = contractorId;
    setContractorId(value);
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/work-orders/${workOrderId}`, { contractor_id: value || null });
    } catch {
      setContractorId(previous);
      setError('No se pudo asignar el contratista.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <HardHat size={15} className="text-emerald-600" /> Contratista
        </h3>
        {saving && <Loader2 size={14} className="animate-spin text-emerald-600" />}
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : (
        <select
          value={contractorId}
          onChange={(event) => void change(event.target.value)}
          disabled={!canWrite || saving}
          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">Sin contratista</option>
          {contractors.filter((contractor) => contractor.is_active).map((contractor) => (
            <option key={contractor.id} value={contractor.id}>
              {contractor.name}{contractor.specialty ? ` · ${contractor.specialty}` : ''}
            </option>
          ))}
        </select>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
