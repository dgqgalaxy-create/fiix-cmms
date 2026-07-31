import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  Save,
  Check,
  X as XIcon,
  Minus,
  PenTool,
  CheckCircle,
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { getChecklistById, updateChecklistRow, submitChecklist, reviewChecklist, startChecklist, getRowLineStatus } from '../api/checklists';
import type { DailyChecklist, ChecklistRow } from '../api/checklists';
import { useAuth } from '../context/AuthContext';
import { parseDateOnly } from '../utils/dateUtils';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import {
  validateChecklistForSubmit,
  missingCellKeySet,
  missingObservationRowIds,
  cellKey,
  rowHasFailAnomaly,
  type ChecklistMissingItem,
} from '../utils/checklistValidation';

export default function ChecklistFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const userId = user?.userId;

  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [incompleteMissing, setIncompleteMissing] = useState<ChecklistMissingItem[]>([]);
  const [showIncompleteFeedback, setShowIncompleteFeedback] = useState(false);
  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);

  const fetchChecklist = async (checklistId: string, background = false) => {
    try {
      if (!background) setIsLoading(true);
      const data = await getChecklistById(checklistId);
      setChecklist(data);
    } catch (error) {
      console.error('Error fetching checklist', error);
      if (!background) {
        alert('Error cargando el checklist.');
        navigate('/checklists');
      }
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchChecklist(id);
    }
  }, [id]);

  useSocketRefresh('refresh_checklists', () => {
    if (id && checklist?.status === 'DRAFT') {
      // No pisar mientras el usuario escribe; solo sync si está en revisión
      return;
    }
    if (id) void fetchChecklist(id, true);
  });

  const applyIncompleteFeedback = (rows: ChecklistRow[], columnCount: number) => {
    const validation = validateChecklistForSubmit(rows, columnCount);
    if (validation.ok) {
      setIncompleteMissing([]);
      setShowIncompleteFeedback(false);
      return;
    }
    setIncompleteMissing(validation.missing);
    setShowIncompleteFeedback(true);
  };

  const isClaimedByMe =
    !!checklist &&
    checklist.status === 'DRAFT' &&
    !!checklist.technician_id &&
    checklist.technician_id === userId;
  const isUnclaimedDraft =
    !!checklist && checklist.status === 'DRAFT' && !checklist.technician_id;
  const isClaimedByOther =
    !!checklist &&
    checklist.status === 'DRAFT' &&
    !!checklist.technician_id &&
    checklist.technician_id !== userId;

  const handleStartChecklist = async () => {
    if (!id) return;
    try {
      setIsStarting(true);
      const data = await startChecklist(id);
      setChecklist(data);
    } catch (error: any) {
      console.error('Error iniciando checklist', error);
      alert(error?.response?.data?.error || 'No se pudo iniciar el checklist.');
      if (id) await fetchChecklist(id);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStatusChange = async (rowId: string, line: number, status: string | null) => {
    if (!checklist || checklist.status !== 'DRAFT' || checklist.technician_id !== userId) return;
    const key = String(line);

    // Update local state for immediate feedback (null = celda vacía otra vez)
    const updatedRows = checklist.rows?.map((row) => {
      if (row.id === rowId) {
        return {
          ...row,
          line_statuses: {
            ...(row.line_statuses || {}),
            [key]: status,
          },
        };
      }
      return row;
    });
    const nextChecklist = { ...checklist, rows: updatedRows };
    setChecklist(nextChecklist);

    if (showIncompleteFeedback) {
      applyIncompleteFeedback(updatedRows || [], checklist.column_count || 5);
    }

    // Save to server (o cola offline)
    try {
      const result = await updateChecklistRow(rowId, { line, status });
      if ((result as { offline?: boolean })?.offline && !navigator.onLine) {
        // Silencioso en celdas; el banner global muestra la cola.
      }
    } catch (error) {
      console.error('Error updating row', error);
      // Opcional: Revertir si falla
    }
  };

  const handleObservationChange = async (rowId: string, obs: string) => {
    if (!checklist || checklist.status !== 'DRAFT' || checklist.technician_id !== userId) return;

    const updatedRows = checklist.rows?.map((row) => {
      if (row.id === rowId) {
        return { ...row, observations: obs };
      }
      return row;
    });
    setChecklist({ ...checklist, rows: updatedRows });
    if (showIncompleteFeedback) {
      applyIncompleteFeedback(updatedRows || [], checklist.column_count || 5);
    }
  };

  const handleObservationBlur = async (rowId: string, obs: string) => {
    if (!checklist || checklist.status !== 'DRAFT' || checklist.technician_id !== userId) return;
    try {
      await updateChecklistRow(rowId, { observations: obs });
      if (showIncompleteFeedback) {
        applyIncompleteFeedback(checklist.rows || [], checklist.column_count || 5);
      }
    } catch (error) {
      console.error('Error saving observation', error);
    }
  };

  const handleSubmit = async () => {
    if (!id || !checklist) return;

    const validation = validateChecklistForSubmit(
      checklist.rows || [],
      checklist.column_count || 5
    );
    if (!validation.ok) {
      setIncompleteMissing(validation.missing);
      setShowIncompleteFeedback(true);
      setIsIncompleteModalOpen(true);
      return;
    }

    setIncompleteMissing([]);
    setShowIncompleteFeedback(false);

    if (!window.confirm('¿Estás seguro de enviar este checklist? Ya no podrás editarlo. Las observaciones vacías (sin fallas) se guardarán como N/A; si hay una cruz, la observación ya debe estar escrita.')) {
      return;
    }

    try {
      setIsSaving(true);
      const result = await submitChecklist(id);
      if ((result as { offline?: boolean })?.offline) {
        alert(
          'Sin conexión: el envío del checklist se guardó en el dispositivo y se completará al recuperar señal.'
        );
        // Marcar localmente como enviado (optimistic) no aplica: el backend validará al sync.
        return;
      }
      await fetchChecklist(id); // Reload to get updated status and signatures
    } catch (error: any) {
      console.error('Error enviando checklist', error);
      if (error?.isOfflineHandled) {
        alert(
          'Sin conexión: el envío del checklist se guardó en el dispositivo y se completará al recuperar señal.'
        );
        return;
      }
      alert(error?.response?.data?.error || 'Error al enviar el checklist.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReview = async () => {
    if (!id || !window.confirm('¿Aprobar este checklist?')) return;

    try {
      setIsSaving(true);
      await reviewChecklist(id);
      await fetchChecklist(id);
    } catch (error) {
      console.error('Error aprobando checklist', error);
      alert('Error al aprobar el checklist.');
    } finally {
      setIsSaving(false);
    }
  };

  const highlightedCells = useMemo(
    () => (showIncompleteFeedback ? missingCellKeySet(incompleteMissing) : new Set<string>()),
    [showIncompleteFeedback, incompleteMissing]
  );
  const highlightedObsRows = useMemo(
    () => (showIncompleteFeedback ? missingObservationRowIds(incompleteMissing) : new Set<string>()),
    [showIncompleteFeedback, incompleteMissing]
  );

  const renderStatusButton = (row: ChecklistRow, line: number) => {
    const currentValue = getRowLineStatus(row, line);
    const isEditable = checklist?.status === 'DRAFT' && checklist.technician_id === userId;
    const fieldType = row.field_type || 'CHECKBOX';
    const isIncomplete = highlightedCells.has(cellKey(row.id, line));
    const incompleteRing = isIncomplete
      ? 'ring-2 ring-rose-500 border-rose-400 dark:border-rose-500'
      : '';

    if (fieldType === 'NUMBER' || fieldType === 'TEXT') {
      return (
        <input
          type={fieldType === 'NUMBER' ? 'number' : 'text'}
          disabled={!isEditable}
          value={currentValue}
          onChange={(e) => handleStatusChange(row.id, line, e.target.value)}
          placeholder="-"
          aria-invalid={isIncomplete || undefined}
          className={`w-16 h-10 px-2 text-center rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 ${incompleteRing}`}
        />
      );
    }

    const getColors = (val: string) => {
      if (val === 'OK') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      if (val === 'FAIL') return 'bg-rose-100 text-rose-700 border-rose-300';
      if (val === 'NA') return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
      return 'bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600';
    };

    // Ciclo: vacío → OK → FAIL → NA → vacío (null). Vacío debe fallar validación al enviar.
    const nextStatus = (current: string | null) => {
      if (current === 'OK') return 'FAIL';
      if (current === 'FAIL') return 'NA';
      if (current === 'NA') return null;
      return 'OK';
    };

    return (
      <button
        type="button"
        disabled={!isEditable}
        onClick={() => handleStatusChange(row.id, line, nextStatus(currentValue || null))}
        aria-invalid={isIncomplete || undefined}
        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all ${getColors(currentValue)} ${incompleteRing} ${!isEditable && 'opacity-80 cursor-not-allowed'}`}
      >
        {currentValue === 'OK' && <Check size={18} strokeWidth={3} />}
        {currentValue === 'FAIL' && <XIcon size={18} strokeWidth={3} />}
        {currentValue === 'NA' && <Minus size={18} strokeWidth={3} />}
      </button>
    );
  };

  if (isLoading || !checklist) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Cargando formato...</div>;
  }

  const isEditable = isClaimedByMe;
  const isPendingReview = checklist.status === 'COMPLETED';
  const canReview = isPendingReview && hasPermission('APPROVE_CHECKLIST');
  const columnCount = Math.max(1, checklist.column_count || 5);
  const lineNumbers = Array.from({ length: columnCount }, (_, i) => i + 1);
  const missingCellCount = incompleteMissing.reduce((n, m) => n + m.missingLines.length, 0);
  const missingObsCount = incompleteMissing.filter((m) => m.missingObservation).length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 print:p-0 print:m-0 print:w-full print:max-w-none">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:flex-row print:mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/checklists')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors print:hidden"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 print:text-xl">Check List Diario de Mantenimiento</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 print:text-sm">
              {format(parseDateOnly(checklist.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-medium shadow-sm"
          >
            <Printer size={20} />
            <span className="hidden md:inline">Imprimir / PDF</span>
          </button>

          {isUnclaimedDraft && (
            <button
              onClick={handleStartChecklist}
              disabled={isStarting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-sm"
            >
              <PenTool size={20} />
              {isStarting ? 'Iniciando...' : 'Iniciar checklist'}
            </button>
          )}

          {isEditable && (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-sm"
            >
              <Save size={20} />
              {isSaving ? 'Guardando...' : 'Firmar y Enviar'}
            </button>
          )}

          {canReview && (
            <button
              onClick={handleReview}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-sm"
            >
              <PenTool size={20} />
              {isSaving ? 'Aprobando...' : 'Aprobar Checklist'}
            </button>
          )}
        </div>
      </div>

      {isUnclaimedDraft && (
        <div
          role="status"
          className="print:hidden flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Checklist sin asignar</p>
            <p className="mt-0.5 text-emerald-800/90 dark:text-emerald-300/90">
              Puedes revisarlo en solo lectura. Pulsa «Iniciar checklist» para reclamarlo y poder editarlo o enviarlo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStartChecklist}
            disabled={isStarting}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isStarting ? 'Iniciando...' : 'Iniciar checklist'}
          </button>
        </div>
      )}

      {isClaimedByOther && (
        <div
          role="status"
          className="print:hidden flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={20} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Solo lectura</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
              Asignado a {checklist.technician?.name || 'otro técnico'}. Solo esa persona puede editar o enviar este checklist.
            </p>
          </div>
        </div>
      )}

      {/* Banner sticky tras intento de envío incompleto */}
      {isEditable && showIncompleteFeedback && incompleteMissing.length > 0 && (
        <div
          role="alert"
          className="sticky top-2 z-20 print:hidden flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={20} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">
              Checklist incompleto
              {missingCellCount > 0 && (
                <> — faltan {missingCellCount} {missingCellCount === 1 ? 'celda' : 'celdas'}</>
              )}
              {missingObsCount > 0 && (
                <>
                  {missingCellCount > 0 ? ' y ' : ' — '}
                  {missingObsCount} {missingObsCount === 1 ? 'observación' : 'observaciones'} por falla
                </>
              )}
            </p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
              Completa las celdas en rojo. Si hay una cruz (falla), escribe la observación de esa fila.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsIncompleteModalOpen(true)}
            className="shrink-0 rounded-lg border border-amber-400/70 bg-white/70 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-white dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/70"
          >
            Ver detalle
          </button>
        </div>
      )}

      {/* Instrucciones */}
      <div className="bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 p-4 rounded-xl mb-6 flex gap-3 text-sm print:hidden border border-sky-100 dark:border-sky-900/50">
        <CheckCircle className="shrink-0 mt-0.5" size={18} />
        <div>
          <strong>Instrucciones:</strong> Toca los recuadros para alternar entre los estados:
          <span className="inline-flex items-center mx-2 text-emerald-700"><Check size={14} className="mr-1"/> Bien</span>
          <span className="inline-flex items-center mx-2 text-rose-700"><XIcon size={14} className="mr-1"/> Anomalía</span>
          <span className="inline-flex items-center mx-2 text-slate-600"><Minus size={14} className="mr-1"/> N/A</span>
          <span className="block mt-1 text-sky-700 dark:text-sky-400">
            Antes de enviar completa todos los checks y lecturas. Si marcas una <strong>cruz (falla)</strong>, la observación de esa fila es <strong>obligatoria</strong>. Con palomita o N/A, la observación vacía se guarda como N/A.
          </span>
        </div>
      </div>

      {/* Matriz de Actividades */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse print:text-[11px]">
            <thead>
              <tr className="bg-slate-900 text-white text-sm font-semibold print:bg-slate-200 print:text-black">
                <th className="px-4 py-4 w-12 text-center print:py-2 print:px-2 border print:border-slate-800">#</th>
                <th className="px-4 py-4 min-w-[300px] print:min-w-0 print:w-auto print:py-2 print:px-2 border print:border-slate-800">ACTIVIDAD</th>
                {lineNumbers.map((line) => (
                  <th key={line} className="px-2 py-4 text-center w-16 print:py-2 print:px-1 border print:border-slate-800">
                    L{line}
                  </th>
                ))}
                <th className="px-4 py-4 min-w-[250px] print:min-w-0 print:w-auto print:py-2 print:px-2 border print:border-slate-800">OBSERVACIONES (obligatorio si hay cruz)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-800">
              {checklist.rows?.map((row, index) => {
                const needsObs = rowHasFailAnomaly(row, columnCount);
                const obsMissing = highlightedObsRows.has(row.id);
                return (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group print:break-inside-avoid">
                  <td className="px-4 py-3 text-center text-slate-400 dark:text-slate-500 font-medium print:py-1 print:px-2 border print:border-slate-800 print:text-black">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 leading-snug print:py-1 print:px-2 border print:border-slate-800">
                    {row.activity_name}
                  </td>
                  {lineNumbers.map((line) => (
                    <td key={line} className="px-2 py-3 text-center print:py-1 print:px-1 border print:border-slate-800">
                      {renderStatusButton(row, line)}
                    </td>
                  ))}
                  <td className={`px-4 py-3 print:py-1 print:px-2 border print:border-slate-800 ${obsMissing ? 'bg-rose-50/80 dark:bg-rose-950/30' : needsObs ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                    <input
                      type="text"
                      className={`w-full text-sm p-2 border rounded-lg transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-slate-100 print:p-0 print:bg-transparent print:text-black print:border-0 ${
                        obsMissing
                          ? 'border-rose-400 ring-2 ring-rose-500 bg-white dark:bg-slate-900'
                          : needsObs
                            ? 'border-amber-300 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500'
                            : 'border-0 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-emerald-500'
                      }`}
                      placeholder={needsObs ? 'Describe la falla (obligatorio)…' : 'Sin observaciones…'}
                      value={row.observations || ''}
                      onChange={(e) => handleObservationChange(row.id, e.target.value)}
                      onBlur={(e) => handleObservationBlur(row.id, e.target.value)}
                      disabled={!isEditable}
                      required={needsObs}
                      aria-required={needsObs || undefined}
                      aria-invalid={obsMissing || undefined}
                    />
                    {needsObs && isEditable && (
                      <p className={`mt-1 text-[11px] font-medium ${obsMissing ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        Obligatorio: hay cruz (falla) en esta fila
                      </p>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Firmas */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 print:mt-12 print:break-inside-avoid">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center print:border-none print:p-2">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider print:text-black">Nombre y Firma del Técnico</div>
          {checklist.technician ? (
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 border-b-2 border-slate-800 dark:border-slate-200 pb-2 px-8 inline-block print:text-lg">
              {checklist.technician.name}
            </div>
          ) : (
            <div className="text-slate-300 italic border-b-2 border-slate-200 pb-2 px-8 print:text-black print:border-black">Pendiente de firma</div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center print:border-none print:p-2">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider print:text-black">Nombre y Firma Líder Mantenimiento</div>
          {checklist.leader ? (
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 border-b-2 border-slate-800 dark:border-slate-200 pb-2 px-8 inline-block print:text-lg">
              {checklist.leader.name}
            </div>
          ) : (
            <div className="text-slate-300 italic border-b-2 border-slate-200 pb-2 px-8 print:text-black print:border-black">Pendiente de firma</div>
          )}
        </div>
      </div>

      {/* Modal: checklist incompleto */}
      {isIncompleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="incomplete-checklist-title"
        >
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setIsIncompleteModalOpen(false)}
          />
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="incomplete-checklist-title"
                  className="text-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  Checklist incompleto
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Completa checks/lecturas y, si marcaste una cruz (falla), escribe la observación de esa fila. Sin fallas, la observación vacía se guarda como N/A.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsIncompleteModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Cerrar"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              {incompleteMissing.length === 0 ? (
                <p className="text-sm text-slate-500">No hay campos pendientes.</p>
              ) : (
                <ul className="space-y-2.5">
                  {incompleteMissing.map((item) => {
                    const shortName =
                      item.activity_name.length > 60
                        ? `${item.activity_name.slice(0, 57)}…`
                        : item.activity_name;
                    const cells = item.missingLines.map((l) => `L${l}`).join(', ');
                    const kind =
                      item.field_type === 'NUMBER'
                        ? 'número'
                        : item.field_type === 'TEXT'
                          ? 'texto'
                          : 'check';
                    const parts: string[] = [];
                    if (item.missingLines.length > 0) {
                      parts.push(`faltan ${cells} (${kind})`);
                    }
                    if (item.missingObservation) {
                      const fails = (item.failLines || []).map((l) => `L${l}`).join(', ');
                      parts.push(`observación obligatoria por falla${fails ? ` (${fails})` : ''}`);
                    }
                    return (
                      <li
                        key={`${item.rowId}-${item.missingLines.join('-')}-${item.missingObservation ? 'obs' : ''}`}
                        className="flex gap-2 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2.5 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                        <span>
                          <strong>Fila {item.rowIndex}</strong> «{shortName}»: {parts.join('; ')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsIncompleteModalOpen(false)}
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
