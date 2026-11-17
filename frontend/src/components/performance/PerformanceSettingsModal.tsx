import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw, Save, Settings2, X, Eye } from 'lucide-react';
import type { PerformanceConfig, PerformanceReport, PerformanceTargets } from '../../api/performance';
import { previewTeamPerformance, resetPerformanceSettings, savePerformanceSettings } from '../../api/performance';
import { FieldHint } from '../common/FieldHint';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  config: PerformanceConfig | null;
  onSaved: (config: PerformanceConfig) => void;
  initialTab?: TabKey;
};

type TabKey = 'general' | 'targets' | 'flags' | 'shifts';

/** Grupos del roster (patrón vigente) para metas por turno. */
const SHIFT_GROUPS: Record<string, string> = {
  MIXTO: 'Turno mixto',
  '4X4_FIJO': '4x4 fijo',
  '4X4_ROTATORIO': '4x4 rotatorio',
};

/** Códigos diarios que expanden los patrones (para horas y fin de turno). */
const SHIFT_CODES: Record<string, string> = {
  D: 'Día',
  N: 'Noche',
  M: 'Mixto (lun-vie)',
  M_SAT: 'Mixto sábado',
  D_TE: 'Día tiempo extra',
  N_TE: 'Noche tiempo extra',
  TE: 'Tiempo extra',
  TXT: 'Turno extra',
  CURSO: 'Curso',
  PSG: 'Permiso',
  V: 'Vacaciones',
  I: 'Incapacidad',
  F: 'Falta',
  X: 'Descanso',
};

const NUM_FIELDS: Array<{ key: keyof PerformanceTargets; label: string; suffix: string; hint: string }> = [
  { key: 'ftf_pct', label: 'Resuelto a la primera', suffix: '%', hint: 'OT cerradas sin reincidencia del activo' },
  { key: 'sla_pct', label: 'Cumplimiento de fecha', suffix: '%', hint: 'Cerradas antes de la fecha comprometida' },
  { key: 'evidence_pct', label: 'Cierres con evidencia', suffix: '%', hint: 'Foto, firma, nota o refacción' },
  { key: 'utilization_pct', label: 'Utilización', suffix: '%', hint: 'Labor registrada ÷ horas de turno' },
  { key: 'attention_max_min', label: 'Atención máxima', suffix: 'min', hint: 'Asignación → inicio de la OT' },
  { key: 'backlog_max', label: 'Backlog viejo permitido', suffix: 'OT', hint: 'OT sin iniciar más viejas que el umbral' },
];

const WEIGHT_HINTS: Record<string, string> = {
  attention: 'Peso de la rapidez de atención: tiempo desde la asignación hasta el inicio de la OT.',
  utilization: 'Peso del tiempo realmente trabajado contra las horas programadas del turno.',
  ftf: 'Peso de la calidad: OT correctivas que no reincidieron en el mismo activo.',
  sla: 'Peso del cumplimiento de la fecha comprometida de la orden.',
  evidence: 'Peso de cerrar con evidencia: foto, firma, nota o refacción.',
  backlog: 'Peso de no acumular OT viejas sin iniciar.',
};

const numberValue = (value: string): number => {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function PerformanceSettingsModal({ isOpen, onClose, config, onSaved, initialTab = 'general' }: Props) {
  const { user, hasPermission } = useAuth();
  const canEdit = user?.role === 'ADMINISTRADOR' && hasPermission('MANAGE_PERMISSIONS');
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [draft, setDraft] = useState<PerformanceConfig | null>(config);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<PerformanceReport | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>('MIXTO');

  useEffect(() => {
    if (!isOpen) return;
    setDraft(config);
    setTab(initialTab);
    setPassword('');
    setError(null);
    setSuccess(null);
    setPreview(null);
    // Solo al abrir: si el padre actualiza la configuración tras guardar, no se pisa el draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

  // Si la configuración llega después de abrir, se toma como borrador inicial.
  useEffect(() => {
    if (isOpen && !draft && config) setDraft(config);
  }, [isOpen, config, draft]);

  useEscapeKey(() => {
    if (!saving) onClose();
  }, isOpen);

  const weightTotal = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.weights).reduce((sum, value) => sum + Number(value || 0), 0);
  }, [draft]);

  if (!isOpen || !draft) return null;

  const patch = (updater: (current: PerformanceConfig) => PerformanceConfig) => {
    setDraft((current) => (current ? updater(current) : current));
    setSuccess(null);
  };

  const patchTargets = (code: string | null, key: keyof PerformanceTargets, value: number) => {
    patch((current) => {
      if (!code) {
        return { ...current, targets: { ...current.targets, [key]: value } };
      }
      const existing = current.targets_by_code[code] ?? {};
      return {
        ...current,
        targets_by_code: {
          ...current.targets_by_code,
          [code]: { ...existing, [key]: value },
        },
      };
    });
  };

  const handleSave = async () => {
    if (!canEdit) {
      setError('Solo un administrador puede cambiar estos parámetros.');
      return;
    }
    if (!password.trim()) {
      setError('Escribe la contraseña de desarrollador para confirmar.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await savePerformanceSettings(draft, password);
      setPassword('');
      setSuccess('Parámetros guardados. El tablero se recalcula al cerrar.');
      onSaved(result.config);
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || 'No se pudieron guardar los parámetros.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!password.trim()) {
      setError('Escribe la contraseña de desarrollador para restaurar los valores.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await resetPerformanceSettings(password);
      setDraft(result.config);
      setPassword('');
      setSuccess('Valores sugeridos restaurados.');
      onSaved(result.config);
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || 'No se pudieron restaurar los valores.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      const report = await previewTeamPerformance(draft, { period: draft.period_days, compare: draft.compare });
      setPreview(report);
    } catch (err: any) {
      const data = err?.response?.data;
      setError(data?.message || data?.error || 'No se pudo previsualizar.');
    } finally {
      setPreviewing(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <Settings2 size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Parámetros de desempeño</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Metas, pesos, banderas y horarios. Los técnicos se toman de los usuarios activos: no hay lista fija.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-4 dark:border-slate-800">
          {([
            ['general', 'General'],
            ['targets', 'Metas'],
            ['flags', 'Banderas'],
            ['shifts', 'Horarios'],
          ] as Array<[TabKey, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-xs font-bold transition-colors ${
                tab === key
                  ? 'border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'general' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Relativa compara cada métrica contra el resto del equipo (percentiles) y se adapta sola al número de técnicos. Fija compara contra las metas numéricas de la pestaña Metas.">Modo de evaluación</FieldHint></label>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                    {([['relative', 'Relativa'], ['fixed', 'Fija']] as Array<[PerformanceConfig['mode'], string]>).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => patch((c) => ({ ...c, mode: key }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                          draft.mode === key ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Relativa: compara contra el equipo (percentiles). Fija: contra las metas de la pestaña Metas.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Grupo contra el que se compara en modo relativo: por turno (mismo patrón: Mixto, 4x4…) o contra todo el equipo. El tablero permite cambiarlo sin editar aquí.">Comparación por omisión</FieldHint></label>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                    {([['shift', 'Por turno'], ['all', 'Todo el equipo']] as Array<[PerformanceConfig['compare'], string]>).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => patch((c) => ({ ...c, compare: key }))}
                        className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                          draft.compare === key ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    El tablero también permite cambiarlo sin tocar la configuración.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Número mínimo de OT cerradas en el periodo para calificar a alguien. Con menos, se muestra «muestra insuficiente» y no se calcula índice.">Muestra mínima (OT)</FieldHint></label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={draft.min_sample}
                    onChange={(e) => patch((c) => ({ ...c, min_sample: numberValue(e.target.value) }))}
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Con menos, se marca «muestra insuficiente».</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Ventana de análisis con la que abre el tablero (7 a 365 días). En el tablero también puedes cambiar entre 7, 30 y 90 días.">Periodo por omisión (días)</FieldHint></label>
                  <input
                    type="number"
                    min={7}
                    max={365}
                    value={draft.period_days}
                    onChange={(e) => patch((c) => ({ ...c, period_days: numberValue(e.target.value) }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Si el mismo activo vuelve a tener una correctiva dentro de estos días después de cerrar, la orden cuenta como retrabajo y baja el «resuelto a la primera».">Días de reincidencia</FieldHint></label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={draft.rework_days}
                    onChange={(e) => patch((c) => ({ ...c, rework_days: numberValue(e.target.value) }))}
                    className={inputClass}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Ventana para considerar retrabajo del mismo activo.</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Días de antigüedad para considerar una OT asignada y sin iniciar como backlog viejo. Alimenta la métrica y la bandera «sin iniciar».">Backlog viejo (días)</FieldHint></label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={draft.backlog_days}
                    onChange={(e) => patch((c) => ({ ...c, backlog_days: numberValue(e.target.value) }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Índice mínimo (0 a 100) para pintar verde. Solo aplica en modo Fijo; en modo Relativo el semáforo se calcula por percentiles del grupo.">Semáforo verde desde</FieldHint></label>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={draft.thresholds.green}
                    onChange={(e) => patch((c) => ({ ...c, thresholds: { ...c.thresholds, green: numberValue(e.target.value) } }))}
                    className={inputClass}
                    disabled={draft.mode === 'relative'}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Índice mínimo para ámbar; por debajo se pinta rojo. Solo aplica en modo Fijo.">Semáforo ámbar desde</FieldHint></label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={draft.thresholds.amber}
                    onChange={(e) => patch((c) => ({ ...c, thresholds: { ...c.thresholds, amber: numberValue(e.target.value) } }))}
                    className={inputClass}
                    disabled={draft.mode === 'relative'}
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500"><FieldHint text="Cuánto aporta cada dimensión al índice 0-100. Si no suman 100 se normalizan; pon 0 para excluir una dimensión.">Pesos del índice</FieldHint></h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ['attention', 'Atención'],
                    ['utilization', 'Utilización'],
                    ['ftf', 'Resuelto 1.ª'],
                    ['sla', 'SLA'],
                    ['evidence', 'Evidencia'],
                    ['backlog', 'Backlog'],
                  ] as Array<[keyof PerformanceConfig['weights'], string]>).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-24 text-xs font-semibold text-slate-600 dark:text-slate-300"><FieldHint text={WEIGHT_HINTS[key]}>{label}</FieldHint></span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.weights[key]}
                        onChange={(e) => patch((c) => ({ ...c, weights: { ...c.weights, [key]: numberValue(e.target.value) } }))}
                        className={`${inputClass} w-20`}
                      />
                      <span className="text-[11px] text-slate-400">%</span>
                    </div>
                  ))}
                </div>
                <p className={`mt-2 text-[11px] font-semibold ${weightTotal === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  Suma actual: {weightTotal}% {weightTotal === 100 ? '' : '(se normaliza automáticamente)'}
                </p>
              </div>
            </div>
          )}

          {tab === 'targets' && (
            <div className="space-y-5">
              <div>
                <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500"><FieldHint text="Valores de referencia para el modo Fijo. Cada turno puede tener metas propias en la sección de abajo.">Metas globales</FieldHint></h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {NUM_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text={field.hint}>{field.label}</FieldHint></label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={draft.targets[field.key]}
                          onChange={(e) => patchTargets(null, field.key, numberValue(e.target.value))}
                          className={inputClass}
                        />
                        <span className="text-[11px] font-semibold text-slate-400">{field.suffix}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{field.hint}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500"><FieldHint text="En modo Fijo, cada patrón (Mixto, 4x4 fijo, 4x4 rotatorio) o código diario puede tener sus propias metas; lo que no definas usa las globales.">Metas por turno</FieldHint></h3>
                <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Solo para el modo Fijo: sobrescriben las globales para el turno elegido (por ejemplo, 4x4 con jornadas largas).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedCode}
                    onChange={(e) => setSelectedCode(e.target.value)}
                    className={`${inputClass} max-w-[220px]`}
                  >
                    {[...Object.entries(SHIFT_GROUPS), ...Object.entries(SHIFT_CODES)].map(([code, label]) => (
                      <option key={code} value={code}>
                        {label} ({code})
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500">
                    {draft.targets_by_code[selectedCode] ? 'Con metas específicas' : 'Usando metas globales'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      patch((c) => {
                        const next = { ...c.targets_by_code };
                        delete next[selectedCode];
                        return { ...c, targets_by_code: next };
                      })
                    }
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-700"
                  >
                    Quitar
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {NUM_FIELDS.map((field) => (
                    <div key={`code-${field.key}`}>
                      <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text={field.hint}>{field.label}</FieldHint></label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={draft.targets_by_code[selectedCode]?.[field.key] ?? draft.targets[field.key]}
                          onChange={(e) => patchTargets(selectedCode, field.key, numberValue(e.target.value))}
                          className={inputClass}
                        />
                        <span className="text-[11px] font-semibold text-slate-400">{field.suffix}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(draft.targets_by_code).length > 0 && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Turnos con metas propias: {Object.keys(draft.targets_by_code).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'flags' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Una OT cerrada en menos de estos minutos, sin evidencia y sin refacción, se marca como cierre exprés (posible «cerrar por cerrar»).">Cierre exprés (min)</FieldHint></label>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={draft.flags.express_close_min}
                  onChange={(e) => patch((c) => ({ ...c, flags: { ...c.flags, express_close_min: numberValue(e.target.value) } }))}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">Cierre más corto, sin evidencia ni refacción.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="OT asignadas a la persona que siguen sin iniciar después de estas horas. Alimenta la bandera «sin iniciar» y el backlog.">Aceptar sin iniciar (h)</FieldHint></label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={draft.flags.accept_without_start_hours}
                  onChange={(e) => patch((c) => ({ ...c, flags: { ...c.flags, accept_without_start_hours: numberValue(e.target.value) } }))}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">OT asignadas que siguen sin iniciar.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Número de cambios de técnico a partir del cual la OT se marca como rebotada entre personas.">Ping-pong (reasignaciones)</FieldHint></label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.flags.ping_pong_min}
                  onChange={(e) => patch((c) => ({ ...c, flags: { ...c.flags, ping_pong_min: numberValue(e.target.value) } }))}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">Cambios de técnico antes de marcar rebote.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Los cierres ocurridos en estos minutos antes del fin de turno se marcan como posible trabajo de relleno.">Cierre de fin de turno (min)</FieldHint></label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={draft.flags.end_of_shift_min}
                  onChange={(e) => patch((c) => ({ ...c, flags: { ...c.flags, end_of_shift_min: numberValue(e.target.value) } }))}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">Ventana antes del fin de turno.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Porcentaje mínimo de cierres con evidencia (foto, firma, nota o refacción). Por debajo se activa la bandera «evidencia baja».">Evidencia mínima (%)</FieldHint></label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.flags.evidence_min_pct}
                  onChange={(e) => patch((c) => ({ ...c, flags: { ...c.flags, evidence_min_pct: numberValue(e.target.value) } }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300"><FieldHint text="Diferencia en puntos porcentuales de OT preventivas sobre el promedio del equipo para marcar «selección de trabajo» (elegir lo fácil).">Margen de selección de trabajo (puntos)</FieldHint></label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.flags.cherry_pick_margin}
                  onChange={(e) => patch((c) => ({ ...c, flags: { ...c.flags, cherry_pick_margin: numberValue(e.target.value) } }))}
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-500">Ventaja en % de preventivas sobre el equipo.</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300" title="Compara el contenido de las fotos (hash) y marca cuando la misma imagen se usa en varias OT. Lee los archivos del periodo.">
                <input
                  type="checkbox"
                  checked={draft.flags.duplicate_evidence_enabled}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      flags: { ...c.flags, duplicate_evidence_enabled: e.target.checked },
                    }))
                  }
                  className="rounded border-slate-300 text-emerald-600"
                />
                Detectar evidencia duplicada (lee las fotos del periodo)
              </label>
            </div>
          )}

          {tab === 'shifts' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Horas de jornada y fin de turno por código del roster. Se usan para la utilización y la bandera de fin de turno.
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Turno</th>
                      <th className="px-3 py-2"><FieldHint text="Horas de jornada que se suman como programadas para ese código. Usa 0 en descansos y ausencias.">Horas</FieldHint></th>
                      <th className="px-3 py-2"><FieldHint text="Hora en que termina el turno; se usa para la bandera de cierre de fin de turno.">Fin de turno</FieldHint></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(SHIFT_CODES).map((code) => (
                      <tr key={code} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-1.5 font-mono font-bold text-slate-700 dark:text-slate-200">{code}</td>
                        <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{SHIFT_CODES[code]}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            max={24}
                            value={draft.hours_by_code[code] ?? 0}
                            onChange={(e) =>
                              patch((c) => ({
                                ...c,
                                hours_by_code: { ...c.hours_by_code, [code]: numberValue(e.target.value) },
                              }))
                            }
                            className={`${inputClass} w-20`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="time"
                            value={draft.shift_end_by_code[code] ?? ''}
                            onChange={(e) =>
                              patch((c) => ({
                                ...c,
                                shift_end_by_code: { ...c.shift_end_by_code, [code]: e.target.value },
                              }))
                            }
                            className={`${inputClass} w-32`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <p className="mb-2 text-xs font-black text-emerald-800 dark:text-emerald-300">
                Vista previa ({preview.summary.total_completed} OT · índice promedio {preview.summary.avg_index ?? '—'})
              </p>
              <div className="flex flex-wrap gap-2">
                {preview.rows.slice(0, 8).map((row) => (
                  <span
                    key={row.user_id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        row.semaphore === 'green'
                          ? 'bg-emerald-500'
                          : row.semaphore === 'amber'
                            ? 'bg-amber-500'
                            : row.semaphore === 'red'
                              ? 'bg-rose-500'
                              : 'bg-slate-300'
                      }`}
                    />
                    {row.name.split(' ')[0]} {row.index ?? '—'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              {success}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña de desarrollador"
              className={`${inputClass} max-w-xs`}
              disabled={!canEdit || saving}
            />
            {!canEdit && <span className="text-[11px] font-semibold text-rose-600">Solo administrador</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {previewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Vista previa
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!canEdit || saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <RotateCcw size={14} /> Restaurar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canEdit || saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
