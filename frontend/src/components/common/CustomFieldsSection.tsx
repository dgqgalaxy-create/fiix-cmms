import { useEffect, useState } from 'react';
import { ListPlus, Loader2, Save, CheckCircle2 } from 'lucide-react';
import {
  getCustomFieldValues,
  saveCustomFieldValues,
  type CustomFieldEntity,
  type CustomFieldWithValue,
} from '../../api/customFields';

interface Props {
  entity: CustomFieldEntity;
  entityId: string;
  canWrite: boolean;
  /** Se dispara al abrir el panel para recargar valores. */
  isOpen?: boolean;
  /** Encabezado de la sección (por defecto «Campos adicionales»). */
  title?: string;
}

/**
 * Campos personalizados de un registro. No renderiza nada si el administrador
 * no ha definido campos para esa entidad.
 */
export function CustomFieldsSection({ entity, entityId, canWrite, isOpen = true, title = 'Campos adicionales' }: Props) {
  const [fields, setFields] = useState<CustomFieldWithValue[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !entityId) return;
    let cancelled = false;
    setLoading(true);
    getCustomFieldValues(entity, entityId)
      .then((rows) => {
        if (cancelled) return;
        setFields(rows);
        const next: Record<string, string> = {};
        for (const row of rows) next[row.key] = row.value ?? (row.field_type === 'BOOLEAN' ? 'false' : '');
        setValues(next);
      })
      .catch(() => { if (!cancelled) setError('No se pudieron cargar los campos.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entity, entityId, isOpen]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveCustomFieldValues(entity, entityId, values);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron guardar los campos.');
    } finally {
      setSaving(false);
    }
  };

  if (!loading && fields.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
          <ListPlus size={15} className="text-emerald-600" /> {title}
        </h3>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={12} /> Guardado
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 size={18} className="animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.id} className={field.field_type === 'TEXTAREA' ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300" htmlFor={`cf-${field.key}`}>
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>

                {field.field_type === 'TEXTAREA' ? (
                  <textarea
                    id={`cf-${field.key}`}
                    rows={2}
                    value={values[field.key] ?? ''}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    disabled={!canWrite}
                    className="ui-input"
                  />
                ) : field.field_type === 'SELECT' ? (
                  <select
                    id={`cf-${field.key}`}
                    value={values[field.key] ?? ''}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    disabled={!canWrite}
                    className="ui-input"
                  >
                    <option value="">—</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : field.field_type === 'BOOLEAN' ? (
                  <label className="flex items-center gap-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      id={`cf-${field.key}`}
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={values[field.key] === 'true'}
                      onChange={(event) => setValues({ ...values, [field.key]: event.target.checked ? 'true' : 'false' })}
                      disabled={!canWrite}
                    />
                    {values[field.key] === 'true' ? 'Sí' : 'No'}
                  </label>
                ) : (
                  <input
                    id={`cf-${field.key}`}
                    type={field.field_type === 'NUMBER' ? 'number' : field.field_type === 'DATE' ? 'date' : 'text'}
                    value={values[field.key] ?? ''}
                    onChange={(event) => setValues({ ...values, [field.key]: event.target.value })}
                    disabled={!canWrite}
                    className="ui-input"
                  />
                )}
              </div>
            ))}
          </div>

          {canWrite && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar campos
              </button>
            </div>
          )}
        </>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
