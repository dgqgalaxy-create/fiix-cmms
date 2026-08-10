import { useState, useEffect, useMemo, useCallback } from 'react';
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
  ArrowRightLeft,
  Loader2,
  Users,
  Ban,
} from 'lucide-react';
import {
  getChecklistById,
  updateChecklistRow,
  submitChecklist,
  reviewChecklist,
  startChecklist,
  transferChecklist,
  acceptChecklistTransfer,
  rejectChecklistTransfer,
  cancelChecklistTransfer,
  assignChecklistTechnician,
  requestChecklistContinuation,
  approveChecklistContinuation,
  rejectChecklistContinuation,
  cancelChecklistContinuation,
  getRowLineStatus,
} from '../api/checklists';
import type { DailyChecklist, ChecklistRow } from '../api/checklists';
import { getOnlineUsers, getUsers } from '../api/users';
import type { User } from '../api/users';
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

const PRINT_BLOCKED_MSG =
  'Solo se puede imprimir cuando el checklist ya está enviado/firmado (o revisado).';

const isChecklistPrintable = (status: DailyChecklist['status'] | undefined) =>
  status === 'COMPLETED' || status === 'REVIEWED';

export default function ChecklistFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, user, canWriteOps } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const userId = user?.userId;

  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [incompleteMissing, setIncompleteMissing] = useState<ChecklistMissingItem[]>([]);
  const [showIncompleteFeedback, setShowIncompleteFeedback] = useState(false);
  const [isIncompleteModalOpen, setIsIncompleteModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferCandidates, setTransferCandidates] = useState<User[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [selectedTransferUserId, setSelectedTransferUserId] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferActionBusy, setTransferActionBusy] = useState(false);
  const [assignCandidates, setAssignCandidates] = useState<User[]>([]);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [continuationBusy, setContinuationBusy] = useState(false);

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
    if (!id) return;
    // En borrador propio: solo sincronizar meta (traspaso / responsable) sin pisar celdas.
    if (checklist?.status === 'DRAFT' && checklist.technician_id === userId) {
      void getChecklistById(id)
        .then((data) => {
          setChecklist((prev) =>
            prev
              ? {
                  ...prev,
                  pending_transfer: data.pending_transfer,
                  pending_continuation: data.pending_continuation,
                  technician_id: data.technician_id,
                  technician: data.technician,
                  status: data.status,
                  leader_id: data.leader_id,
                  leader: data.leader,
                  reopened_from_non_compliance: data.reopened_from_non_compliance,
                }
              : data
          );
        })
        .catch(() => undefined);
      return;
    }
    void fetchChecklist(id, true);
  });

  // Bloquear Ctrl+P en borrador; en finalizado forzar Letter portrait (igual que el botón).
  useEffect(() => {
    const status = checklist?.status;
    const STYLE_ID = 'checklist-print-page-style';

    const onBeforePrint = () => {
      if (!isChecklistPrintable(status)) {
        document.body.classList.add('checklist-print-blocked');
        window.alert(PRINT_BLOCKED_MSG);
        return;
      }
      document.getElementById(STYLE_ID)?.remove();
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = '@page { size: letter portrait; margin: 4mm; }';
      document.head.appendChild(style);
      document.body.classList.add('checklist-printing');
    };
    const onAfterPrint = () => {
      document.body.classList.remove('checklist-print-blocked');
      document.body.classList.remove('checklist-printing');
      document.getElementById(STYLE_ID)?.remove();
    };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
      document.body.classList.remove('checklist-print-blocked');
      document.body.classList.remove('checklist-printing');
      document.getElementById(STYLE_ID)?.remove();
    };
  }, [checklist?.status]);

  const handlePrint = useCallback(() => {
    if (!isChecklistPrintable(checklist?.status)) {
      window.alert(PRINT_BLOCKED_MSG);
      return;
    }
    window.print();
  }, [checklist?.status]);

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

  const pendingTransfer =
    checklist?.pending_transfer?.status === 'PENDING' ? checklist.pending_transfer : null;
  const isTransferDestination =
    !!pendingTransfer && pendingTransfer.to_user_id === userId;
  const isTransferOwner =
    !!pendingTransfer && pendingTransfer.from_user_id === userId;

  const pendingContinuation =
    checklist?.pending_continuation?.status === 'PENDING' ? checklist.pending_continuation : null;
  const isNonCompliance = checklist?.status === 'NON_COMPLIANCE';
  const canAssignTechnician =
    !!isNonCompliance && isAdmin && !checklist?.technician_id;
  const canRequestContinuation =
    !!isNonCompliance &&
    !!checklist?.technician_id &&
    checklist.technician_id === userId &&
    !pendingContinuation;
  const canCancelContinuation =
    !!pendingContinuation && pendingContinuation.requested_by_id === userId;
  const canResolveContinuation = !!pendingContinuation && isAdmin;

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

  useEffect(() => {
    if (!canAssignTechnician) {
      setAssignCandidates([]);
      setSelectedAssignUserId(null);
      return;
    }
    let cancelled = false;
    setAssignLoading(true);
    getUsers()
      .then((users) => {
        if (cancelled) return;
        setAssignCandidates(
          users.filter(
            (u) =>
              u.is_active !== false &&
              (u.role === 'TECNICO' || u.role === 'GESTIONADOR')
          )
        );
      })
      .catch(() => {
        if (!cancelled) setAssignCandidates([]);
      })
      .finally(() => {
        if (!cancelled) setAssignLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAssignTechnician, checklist?.id]);

  const openTransferModal = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('El traspaso requiere conexión a internet.');
      return;
    }
    setIsTransferModalOpen(true);
    setSelectedTransferUserId(null);
    setTransferError(null);
    setTransferLoading(true);
    try {
      const online = await getOnlineUsers();
      setTransferCandidates(
        online.filter(
          (u) =>
            u.id !== userId &&
            u.is_active !== false &&
            (u.role === 'TECNICO' || u.role === 'GESTIONADOR')
        )
      );
    } catch {
      setTransferError('No se pudo cargar el personal en línea');
      setTransferCandidates([]);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!id || !selectedTransferUserId) {
      setTransferError('Selecciona a quién traspasar');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setTransferError('Sin conexión: el traspaso solo funciona en línea.');
      return;
    }
    setTransferSaving(true);
    setTransferError(null);
    try {
      const transfer = await transferChecklist(id, selectedTransferUserId);
      setChecklist((prev) => (prev ? { ...prev, pending_transfer: transfer } : prev));
      setIsTransferModalOpen(false);
    } catch (error: any) {
      setTransferError(error?.response?.data?.error || 'No se pudo iniciar el traspaso.');
    } finally {
      setTransferSaving(false);
    }
  };

  const handleAcceptTransfer = async () => {
    if (!pendingTransfer || !id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Aceptar el traspaso requiere conexión.');
      return;
    }
    try {
      setTransferActionBusy(true);
      const data = await acceptChecklistTransfer(pendingTransfer.id);
      setChecklist(data);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo aceptar el traspaso.');
      await fetchChecklist(id);
    } finally {
      setTransferActionBusy(false);
    }
  };

  const handleRejectTransfer = async () => {
    if (!pendingTransfer || !id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Rechazar el traspaso requiere conexión.');
      return;
    }
    if (!window.confirm('¿Rechazar la responsabilidad de este checklist?')) return;
    try {
      setTransferActionBusy(true);
      const data = await rejectChecklistTransfer(pendingTransfer.id);
      setChecklist(data);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo rechazar el traspaso.');
      await fetchChecklist(id);
    } finally {
      setTransferActionBusy(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!pendingTransfer || !id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Cancelar el traspaso requiere conexión.');
      return;
    }
    if (!window.confirm('¿Cancelar el traspaso pendiente?')) return;
    try {
      setTransferActionBusy(true);
      const data = await cancelChecklistTransfer(pendingTransfer.id);
      setChecklist(data);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo cancelar el traspaso.');
      await fetchChecklist(id);
    } finally {
      setTransferActionBusy(false);
    }
  };

  const handleAssignTechnician = async () => {
    if (!id || !selectedAssignUserId) {
      alert('Selecciona un técnico para asignar');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Asignar técnico requiere conexión.');
      return;
    }
    try {
      setAssignSaving(true);
      const data = await assignChecklistTechnician(id, selectedAssignUserId);
      setChecklist(data);
      setSelectedAssignUserId(null);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo asignar el técnico.');
      await fetchChecklist(id);
    } finally {
      setAssignSaving(false);
    }
  };

  const handleRequestContinuation = async () => {
    if (!id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Solicitar continuación requiere conexión.');
      return;
    }
    if (!window.confirm('¿Solicitar al administrador continuar este checklist en incumplimiento?')) {
      return;
    }
    try {
      setContinuationBusy(true);
      const request = await requestChecklistContinuation(id);
      setChecklist((prev) => (prev ? { ...prev, pending_continuation: request } : prev));
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo enviar la solicitud.');
      await fetchChecklist(id);
    } finally {
      setContinuationBusy(false);
    }
  };

  const handleApproveContinuation = async () => {
    if (!pendingContinuation || !id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Aprobar requiere conexión.');
      return;
    }
    try {
      setContinuationBusy(true);
      const data = await approveChecklistContinuation(pendingContinuation.id);
      setChecklist(data);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo aprobar la continuación.');
      await fetchChecklist(id);
    } finally {
      setContinuationBusy(false);
    }
  };

  const handleRejectContinuation = async () => {
    if (!pendingContinuation || !id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Rechazar requiere conexión.');
      return;
    }
    if (!window.confirm('¿Rechazar la solicitud de continuación?')) return;
    try {
      setContinuationBusy(true);
      const data = await rejectChecklistContinuation(pendingContinuation.id);
      setChecklist(data);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo rechazar la solicitud.');
      await fetchChecklist(id);
    } finally {
      setContinuationBusy(false);
    }
  };

  const handleCancelContinuation = async () => {
    if (!pendingContinuation || !id) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert('Cancelar requiere conexión.');
      return;
    }
    if (!window.confirm('¿Cancelar tu solicitud de continuación?')) return;
    try {
      setContinuationBusy(true);
      const data = await cancelChecklistContinuation(pendingContinuation.id);
      setChecklist(data);
    } catch (error: any) {
      alert(error?.response?.data?.error || 'No se pudo cancelar la solicitud.');
      await fetchChecklist(id);
    } finally {
      setContinuationBusy(false);
    }
  };

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

    try {
      const result = await updateChecklistRow(rowId, { line, status });
      if ((result as { offline?: boolean })?.offline && !navigator.onLine) {
        // Silencioso en celdas; el banner global muestra la cola.
      }
    } catch (error) {
      console.error('Error updating row', error);
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
        return;
      }
      await fetchChecklist(id);
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
    const isCellEditable = checklist?.status === 'DRAFT' && checklist.technician_id === userId;
    const fieldType = row.field_type || 'CHECKBOX';
    const isIncomplete = highlightedCells.has(cellKey(row.id, line));
    const incompleteRing = isIncomplete
      ? 'ring-2 ring-rose-500 border-rose-400 dark:border-rose-500'
      : '';

    if (fieldType === 'NUMBER' || fieldType === 'TEXT') {
      return (
        <input
          type={fieldType === 'NUMBER' ? 'number' : 'text'}
          disabled={!isCellEditable}
          value={currentValue}
          onChange={(e) => handleStatusChange(row.id, line, e.target.value)}
          placeholder="-"
          aria-invalid={isIncomplete || undefined}
          className={`w-16 h-10 px-2 text-center rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-500 print:w-auto print:h-auto print:min-h-0 print:p-0 print:text-[7px] print:border-0 print:bg-transparent print:text-black ${incompleteRing}`}
        />
      );
    }

    const getColors = (val: string) => {
      if (val === 'OK') return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      if (val === 'FAIL') return 'bg-rose-100 text-rose-700 border-rose-300';
      if (val === 'NA') return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600';
      return 'bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600';
    };

    const nextStatus = (current: string | null) => {
      if (current === 'OK') return 'FAIL';
      if (current === 'FAIL') return 'NA';
      if (current === 'NA') return null;
      return 'OK';
    };

    return (
      <button
        type="button"
        disabled={!isCellEditable}
        onClick={() => handleStatusChange(row.id, line, nextStatus(currentValue || null))}
        aria-invalid={isIncomplete || undefined}
        className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-all print:w-4 print:h-4 print:min-h-0 print:p-0 print:rounded-sm print:shadow-none [&_svg]:print:w-2.5 [&_svg]:print:h-2.5 ${getColors(currentValue)} ${incompleteRing} ${!isCellEditable && 'opacity-80 cursor-not-allowed'}`}
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

  const isEditable = isClaimedByMe && canWriteOps;
  const isPendingReview = checklist.status === 'COMPLETED';
  const canReview = isPendingReview && hasPermission('APPROVE_CHECKLIST') && canWriteOps;
  const canPrint = isChecklistPrintable(checklist.status);
  const canTransfer = isClaimedByMe && !pendingTransfer && canWriteOps;
  const columnCount = Math.max(1, checklist.column_count || 5);
  const lineNumbers = Array.from({ length: columnCount }, (_, i) => i + 1);
  const missingCellCount = incompleteMissing.reduce((n, m) => n + m.missingLines.length, 0);
  const missingObsCount = incompleteMissing.filter((m) => m.missingObservation).length;

  return (
    <div className="checklist-print-sheet space-y-6 animate-in fade-in zoom-in-95 duration-300 print:space-y-1 print:p-0 print:m-0 print:w-full print:max-w-none">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:flex-row print:mb-1 print:gap-2">
        <div className="flex items-center gap-4 print:gap-2">
          <button
            onClick={() => navigate('/checklists')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors print:hidden"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 print:text-[11px] print:leading-tight">Check List Diario de Mantenimiento</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 print:mt-0 print:text-[8px] print:leading-tight">
              {format(parseDateOnly(checklist.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!canPrint}
            title={canPrint ? 'Imprimir / PDF (una hoja Carta)' : PRINT_BLOCKED_MSG}
            className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl transition-all font-medium shadow-sm ${
              canPrint
                ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-70'
            }`}
          >
            <Printer size={20} />
            <span className="hidden md:inline">Imprimir / PDF</span>
          </button>

          {isUnclaimedDraft && canWriteOps && (
            <button
              onClick={handleStartChecklist}
              disabled={isStarting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-sm"
            >
              <PenTool size={20} />
              {isStarting ? 'Iniciando...' : 'Iniciar checklist'}
            </button>
          )}

          {canTransfer && (
            <button
              type="button"
              onClick={openTransferModal}
              className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-medium shadow-sm"
            >
              <ArrowRightLeft size={20} />
              <span className="hidden sm:inline">Traspasar</span>
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

          {canRequestContinuation && (
            <button
              type="button"
              onClick={handleRequestContinuation}
              disabled={continuationBusy}
              className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2.5 rounded-xl hover:bg-rose-700 transition-all font-medium shadow-sm disabled:opacity-60"
            >
              <Ban size={20} />
              {continuationBusy ? 'Enviando...' : 'Solicitar continuar'}
            </button>
          )}
        </div>
      </div>

      {isNonCompliance && (
        <div
          role="status"
          className="print:hidden flex flex-col gap-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950 shadow-sm dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <div className="flex items-start gap-3">
            <Ban className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" size={20} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">Incumplimiento — checklist cerrado</p>
              <p className="mt-0.5 text-rose-800/90 dark:text-rose-300/90">
                No se envió a tiempo. Quedó bloqueado. Solo el técnico asignado puede solicitar continuar;
                un administrador debe aprobarlo.
                {!checklist.technician_id
                  ? ' Aún no hay técnico asignado: un administrador puede asignarlo abajo (el estado sigue en incumplimiento).'
                  : ` Técnico: ${checklist.technician?.name || 'asignado'}.`}
              </p>
            </div>
          </div>

          {canAssignTechnician && (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center pl-0 sm:pl-8">
              <select
                value={selectedAssignUserId || ''}
                onChange={(e) => setSelectedAssignUserId(e.target.value || null)}
                disabled={assignLoading || assignSaving}
                className="flex-1 rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-rose-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">
                  {assignLoading ? 'Cargando personal…' : 'Seleccionar técnico…'}
                </option>
                {assignCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAssignTechnician}
                disabled={!selectedAssignUserId || assignSaving}
                className="shrink-0 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {assignSaving ? 'Asignando…' : 'Asignar técnico'}
              </button>
            </div>
          )}

          {canRequestContinuation && (
            <div className="pl-0 sm:pl-8">
              <button
                type="button"
                onClick={handleRequestContinuation}
                disabled={continuationBusy}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {continuationBusy ? 'Enviando…' : 'Solicitar continuar'}
              </button>
            </div>
          )}

          {pendingContinuation && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pl-0 sm:pl-8 rounded-lg border border-orange-300/80 bg-orange-50/80 p-3 dark:border-orange-700/50 dark:bg-orange-950/30">
              <div className="min-w-0 flex-1 text-sm text-orange-950 dark:text-orange-100">
                <p className="font-semibold">Solicitud pendiente</p>
                <p className="mt-0.5 text-orange-800/90 dark:text-orange-300/90">
                  {pendingContinuation.requested_by?.name || 'El técnico'} pidió continuar.
                  {canResolveContinuation
                    ? ' Aprueba o rechaza como administrador.'
                    : ' Esperando al administrador.'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {canCancelContinuation && (
                  <button
                    type="button"
                    onClick={handleCancelContinuation}
                    disabled={continuationBusy}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Cancelar solicitud
                  </button>
                )}
                {canResolveContinuation && (
                  <>
                    <button
                      type="button"
                      onClick={handleRejectContinuation}
                      disabled={continuationBusy}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={handleApproveContinuation}
                      disabled={continuationBusy}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {continuationBusy ? 'Procesando…' : 'Aprobar'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {checklist.reopened_from_non_compliance && checklist.status === 'DRAFT' && (
        <div
          role="status"
          className="print:hidden flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={20} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Reabierto tras incumplimiento</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
              Un administrador aprobó continuar. Completa y envía el checklist con normalidad.
            </p>
          </div>
        </div>
      )}

      {isUnclaimedDraft && (
        <div
          role="status"
          className="print:hidden flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Checklist sin asignar</p>
            <p className="mt-0.5 text-emerald-800/90 dark:text-emerald-300/90">
              {canWriteOps
                ? 'Puedes revisarlo en solo lectura. Pulsa «Iniciar checklist» para reclamarlo y poder editarlo o enviarlo.'
                : 'Como Observador solo puedes consultarlo (sin iniciar ni editar).'}
            </p>
          </div>
          {canWriteOps && (
          <button
            type="button"
            onClick={handleStartChecklist}
            disabled={isStarting}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isStarting ? 'Iniciando...' : 'Iniciar checklist'}
          </button>
          )}
        </div>
      )}

      {isTransferDestination && pendingTransfer && (
        <div
          role="status"
          className="print:hidden flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sky-950 shadow-sm dark:border-sky-700/60 dark:bg-sky-950/40 dark:text-sky-100"
        >
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Te ofrecen la responsabilidad</p>
            <p className="mt-0.5 text-sky-800/90 dark:text-sky-300/90">
              {pendingTransfer.from_user?.name || 'Un técnico'} quiere traspasarte este checklist.
              Mientras no aceptes, solo puedes verlo en lectura.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleRejectTransfer}
              disabled={transferActionBusy}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              Rechazar
            </button>
            <button
              type="button"
              onClick={handleAcceptTransfer}
              disabled={transferActionBusy}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {transferActionBusy ? 'Procesando...' : 'Aceptar'}
            </button>
          </div>
        </div>
      )}

      {isTransferOwner && pendingTransfer && (
        <div
          role="status"
          className="print:hidden flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-violet-300 bg-violet-50 p-4 text-violet-950 shadow-sm dark:border-violet-700/60 dark:bg-violet-950/40 dark:text-violet-100"
        >
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Traspaso pendiente</p>
            <p className="mt-0.5 text-violet-800/90 dark:text-violet-300/90">
              Esperando respuesta de {pendingTransfer.to_user?.name || 'el destinatario'}.
              Puedes seguir editando hasta que acepte, rechace o canceles el traspaso.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancelTransfer}
            disabled={transferActionBusy}
            className="shrink-0 rounded-xl border border-violet-400/70 bg-white/80 px-4 py-2.5 text-sm font-bold text-violet-900 hover:bg-white disabled:opacity-60 dark:border-violet-600 dark:bg-violet-900/40 dark:text-violet-100"
          >
            Cancelar traspaso
          </button>
        </div>
      )}

      {isClaimedByOther && !isTransferDestination && (
        <div
          role="status"
          className="print:hidden flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" size={20} />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">Solo lectura</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
              Asignado a {checklist.technician?.name || 'otro técnico'}. Solo esa persona puede editar o enviar este checklist.
              {pendingTransfer
                ? ` Hay un traspaso pendiente hacia ${pendingTransfer.to_user?.name || 'otro usuario'}.`
                : ''}
            </p>
          </div>
        </div>
      )}

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

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none print:rounded-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left border-collapse print:text-[7px] print:leading-tight">
            <thead>
              <tr className="bg-slate-900 text-white text-sm font-semibold print:bg-slate-200 print:text-black print:text-[7px]">
                <th className="px-4 py-4 w-12 text-center print:py-0.5 print:px-0.5 print:w-4 border print:border-slate-800">#</th>
                <th className="px-4 py-4 min-w-[300px] print:min-w-0 print:w-auto print:py-0.5 print:px-1 border print:border-slate-800">ACTIVIDAD</th>
                {lineNumbers.map((line) => (
                  <th key={line} className="px-2 py-4 text-center w-16 print:w-5 print:py-0.5 print:px-0 border print:border-slate-800">
                    L{line}
                  </th>
                ))}
                <th className="px-4 py-4 min-w-[250px] print:min-w-0 print:w-[22%] print:py-0.5 print:px-1 border print:border-slate-800">
                  <span className="print:hidden">OBSERVACIONES (obligatorio si hay cruz)</span>
                  <span className="hidden print:inline">OBS.</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-800">
              {checklist.rows?.map((row, index) => {
                const needsObs = rowHasFailAnomaly(row, columnCount);
                const obsMissing = highlightedObsRows.has(row.id);
                return (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-4 py-3 text-center text-slate-400 dark:text-slate-500 font-medium print:py-0 print:px-0.5 border print:border-slate-800 print:text-black">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 leading-snug print:py-0 print:px-1 print:text-[7px] print:leading-tight border print:border-slate-800">
                    {row.activity_name}
                  </td>
                  {lineNumbers.map((line) => (
                    <td key={line} className="px-2 py-3 text-center print:py-0 print:px-0 border print:border-slate-800">
                      {renderStatusButton(row, line)}
                    </td>
                  ))}
                  <td className={`px-4 py-3 print:py-0 print:px-1 border print:border-slate-800 ${obsMissing ? 'bg-rose-50/80 dark:bg-rose-950/30' : needsObs ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                    <input
                      type="text"
                      className={`w-full text-sm p-2 border rounded-lg transition-colors placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-slate-100 print:p-0 print:text-[7px] print:leading-tight print:bg-transparent print:text-black print:border-0 ${
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
                      <p className={`mt-1 text-[11px] font-medium print:hidden ${obsMissing ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
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

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 print:mt-2 print:gap-2 print:grid-cols-2">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center print:border print:border-slate-800 print:rounded-none print:p-1">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider print:mb-0.5 print:text-[7px] print:tracking-normal print:text-black">Nombre y Firma del Técnico</div>
          {checklist.technician ? (
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 border-b-2 border-slate-800 dark:border-slate-200 pb-2 px-8 inline-block print:text-[9px] print:pb-0.5 print:px-2">
              {checklist.technician.name}
            </div>
          ) : (
            <div className="text-slate-300 italic border-b-2 border-slate-200 pb-2 px-8 print:text-[8px] print:pb-0.5 print:px-2 print:text-black print:border-black">Pendiente de firma</div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center print:border print:border-slate-800 print:rounded-none print:p-1">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider print:mb-0.5 print:text-[7px] print:tracking-normal print:text-black">Nombre y Firma Líder Mantenimiento</div>
          {checklist.leader ? (
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100 border-b-2 border-slate-800 dark:border-slate-200 pb-2 px-8 inline-block print:text-[9px] print:pb-0.5 print:px-2">
              {checklist.leader.name}
            </div>
          ) : (
            <div className="text-slate-300 italic border-b-2 border-slate-200 pb-2 px-8 print:text-[8px] print:pb-0.5 print:px-2 print:text-black print:border-black">Pendiente de firma</div>
          )}
        </div>
      </div>

      {isTransferModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="transfer-checklist-title"
        >
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !transferSaving && setIsTransferModalOpen(false)}
          />
          <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Users size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="transfer-checklist-title"
                  className="text-xl font-bold text-slate-900 dark:text-slate-100"
                >
                  Traspasar responsabilidad
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Elige un técnico o gestionador en línea. Deberá aceptar para asumir el checklist.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !transferSaving && setIsTransferModalOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Cerrar"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              {transferLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 className="animate-spin" size={18} />
                  Cargando personal en línea…
                </div>
              ) : transferCandidates.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  No hay técnicos ni gestionadores en línea ahora mismo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {transferCandidates.map((u) => {
                    const selected = selectedTransferUserId === u.id;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTransferUserId(u.id)}
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                            selected
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-100'
                              : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="font-medium">{u.name}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{u.role}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {transferError && (
                <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{transferError}</p>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                disabled={transferSaving}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={transferSaving || !selectedTransferUserId || transferLoading}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {transferSaving ? 'Enviando...' : 'Traspasar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
