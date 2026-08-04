import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Save, Trash2, Ban, Clock, Package, GitBranch, ChevronDown, CheckCircle2, Users, PauseCircle, PlayCircle, ChevronLeft, ChevronRight, ZoomIn, StickyNote } from 'lucide-react';
import type { WorkOrder } from '../api/workOrders';
import { getWorkOrderById } from '../api/workOrders';
import { useAuth } from '../context/AuthContext';
import { getUsers } from '../api/users';
import type { User } from '../api/users';
import { getItems } from '../api/inventory';
import type { Item } from '../api/inventory';
import { SignatureField } from './SignatureField';
import api, { BACKEND_URL } from '../api/axios';
import type { SignatureFieldRef } from './SignatureField';
import { Download } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { generateWorkOrderPDF } from '../utils/pdfGenerator';
import { SlaBadge } from './SlaBadge';
import { formatWorkOrderFolio } from '../utils/folio';
import { useWorkOrderPresence } from '../hooks/useWorkOrderPresence';
import { socket } from '../api/socket';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currency';
import { resolvePartsUnitCost } from '../utils/resolvePartsUnitCost';
import { InfoTip } from './common/InfoTip';
import { qtyStep, isInvalidQty } from '../utils/qtyMode';
import { WorkOrderCommentsPanel } from './WorkOrderCommentsPanel';

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En Proceso',
  EN_ESPERA: 'En Espera',
  FINALIZADO: 'Finalizado',
  ANULADO: 'Anulado',
};

const statusLabel = (status: string) => STATUS_LABELS[status] || status.replace(/_/g, ' ');

interface Props {
  workOrder: WorkOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: any) => Promise<any>;
  onDelete?: (id: string) => Promise<void>;
  onJoin?: (id: string) => Promise<void>;
  /** Lista filtrada/ordenada del Dashboard (para ← →). */
  workOrderList?: WorkOrder[];
  onNavigateWorkOrder?: (wo: WorkOrder) => void;
  /** Al abrir, hacer scroll a la sección indicada. */
  initialFocus?: 'assign';
}

const EvidenceThumb = ({
  src,
  alt,
  label,
  onZoom,
}: {
  src: string;
  alt: string;
  label: string;
  onZoom: () => void;
}) => (
  <button
    type="button"
    onClick={onZoom}
    className="group relative block w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
    title="Ampliar"
  >
    <div className="aspect-[4/3] w-full">
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
    <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white text-left">
      {label}
    </span>
    <span className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-80 group-hover:opacity-100">
      <ZoomIn size={14} />
    </span>
  </button>
);

export const WorkOrderDetailModal = ({
  workOrder,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onJoin,
  workOrderList,
  onNavigateWorkOrder,
  initialFocus,
}: Props) => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { canEdit, remoteEditorName } = useWorkOrderPresence(workOrder?.id, isOpen);
  const isTechMobileShell = useTechnicianMobileShell();
  const evidenceRef = useRef<HTMLDivElement>(null);
  const holdReasonRef = useRef<HTMLInputElement>(null);
  const finalizeSectionRef = useRef<HTMLDivElement>(null);
  const assignSectionRef = useRef<HTMLDivElement>(null);
  const pendingAutoSaveRef = useRef(false);
  const skipConfirmRef = useRef(false);
  const awaitPhotoThenSaveRef = useRef(false);

  const [liveWorkOrder, setLiveWorkOrder] = useState<WorkOrder | null>(workOrder);
  const [status, setStatus] = useState<string>('');
  const [holdReason, setHoldReason] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [signatureCleanArea, setSignatureCleanArea] = useState<string>('');
  const [signatureDelivery, setSignatureDelivery] = useState<string>('');

  const sigCleanAreaRef = useRef<SignatureFieldRef>(null);
  const sigDeliveryRef = useRef<SignatureFieldRef>(null);

  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [error, setError] = useState('');

  const [sigCleanAreaEmpty, setSigCleanAreaEmpty] = useState(true);
  const [sigDeliveryEmpty, setSigDeliveryEmpty] = useState(true);

  const [technicians, setTechnicians] = useState<User[]>([]);
  const [assignedTechniciansIds, setAssignedTechniciansIds] = useState<string[]>([]);

  const [inventoryItems, setInventoryItems] = useState<Item[]>([]);
  const [usedItems, setUsedItems] = useState<{item_id: string, name: string, amount: number, uom: string, max_stock: number, qty_mode?: string}[]>([]);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<string>('');
  const [itemSearchText, setItemSearchText] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState<string>('');

  const [rcaTree, setRcaTree] = useState<any[]>([]);
  const [failureProblemId, setFailureProblemId] = useState<string>('');
  const [failureCauseId, setFailureCauseId] = useState<string>('');
  const [failureRemedyId, setFailureRemedyId] = useState<string>('');
  const [consumedParts, setConsumedParts] = useState<NonNullable<WorkOrder['inventory_transactions']>>([]);
  const [partsCostTotal, setPartsCostTotal] = useState(0);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const navIndex = useMemo(() => {
    if (!workOrder || !workOrderList?.length) return -1;
    return workOrderList.findIndex((w) => w.id === workOrder.id);
  }, [workOrder, workOrderList]);

  const canNavigate =
    Boolean(onNavigateWorkOrder) &&
    Boolean(workOrderList) &&
    (workOrderList?.length ?? 0) > 1 &&
    navIndex >= 0;

  const hasPrev = canNavigate && navIndex > 0;
  const hasNext = canNavigate && navIndex < (workOrderList?.length ?? 0) - 1;

  const goPrev = useCallback(() => {
    if (!hasPrev || !workOrderList || !onNavigateWorkOrder) return;
    onNavigateWorkOrder(workOrderList[navIndex - 1]);
  }, [hasPrev, workOrderList, navIndex, onNavigateWorkOrder]);

  const goNext = useCallback(() => {
    if (!hasNext || !workOrderList || !onNavigateWorkOrder) return;
    onNavigateWorkOrder(workOrderList[navIndex + 1]);
  }, [hasNext, workOrderList, navIndex, onNavigateWorkOrder]);

  useEffect(() => {
    if (!isOpen || !canNavigate) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      if (e.key === 'ArrowLeft') goPrev();
      else goNext();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, canNavigate, goPrev, goNext]);

  useEffect(() => {
    if (!isOpen) {
      pendingAutoSaveRef.current = false;
      skipConfirmRef.current = false;
      awaitPhotoThenSaveRef.current = false;
      setZoomSrc(null);
    }
  }, [isOpen, workOrder?.id]);

  // Scroll a «Técnicos Asignados» cuando se abre desde acción rápida «Sin asignar».
  useEffect(() => {
    if (!isOpen || initialFocus !== 'assign') return;
    const timer = window.setTimeout(() => {
      assignSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isOpen, workOrder?.id, initialFocus]);

  // Al cambiar de OT (← →), limpia borradores locales de fotos/repuestos.
  useEffect(() => {
    setBeforeImage(null);
    setAfterImage(null);
    setUsedItems([]);
    setItemSearchText('');
    setSelectedItemToAdd('');
    setAmountToAdd('');
    setError('');
  }, [workOrder?.id]);

  useEffect(() => {
    if (workOrder) setLiveWorkOrder(workOrder);
  }, [workOrder]);

  // Al abrir, siempre traer la OT fresca (p. ej. tras importar fotos CSV/zip).
  useEffect(() => {
    if (!isOpen || !workOrder?.id) return;

    const refreshDetail = async () => {
      try {
        const full = await getWorkOrderById(workOrder.id);
        setLiveWorkOrder(full);
      } catch {
        // ignore
      }
    };

    void refreshDetail();

    const onUpdated = (payload: { id?: string }) => {
      if (payload?.id === workOrder.id) void refreshDetail();
    };

    const onRefresh = () => {
      // Solo forzar sync si no somos el editor (evita pisar cambios locales)
      if (!canEdit) void refreshDetail();
    };

    socket.on('work_order_updated', onUpdated);
    socket.on('refresh_work_orders', onRefresh);
    return () => {
      socket.off('work_order_updated', onUpdated);
      socket.off('refresh_work_orders', onRefresh);
    };
  }, [isOpen, workOrder?.id, canEdit]);

  useEffect(() => {
    const wo = liveWorkOrder || workOrder;
    if (wo) {
      setStatus(wo.status);
      setHoldReason(wo.hold_reason || '');
      setResolutionNotes(wo.resolution_notes || '');
      setSignatureCleanArea(wo.signature_clean_area || '');
      setSignatureDelivery(wo.signature_delivery || '');
      setAssignedTechniciansIds(wo.assigned_technicians?.map(t => t.id) || []);
      if (!canEdit) {
        setBeforeImage(null);
        setAfterImage(null);
        setUsedItems([]);
      }
      setError('');
      setSigCleanAreaEmpty(!wo.signature_clean_area);
      setSigDeliveryEmpty(!wo.signature_delivery);

      setFailureProblemId((wo as any).failure_problem_id || '');
      setFailureCauseId((wo as any).failure_cause_id || '');
      setFailureRemedyId((wo as any).failure_remedy_id || '');
      setConsumedParts(wo.inventory_transactions || []);
      setPartsCostTotal(wo.parts_cost_total || 0);

      if (wo.status === 'FINALIZADO') {
        getWorkOrderById(wo.id)
          .then((full) => {
            setLiveWorkOrder(full);
            setConsumedParts(full.inventory_transactions || []);
            setPartsCostTotal(full.parts_cost_total || 0);
          })
          .catch(() => {});
      }
    }
  }, [liveWorkOrder, workOrder, canEdit]);

  useEffect(() => {
    if (isOpen && user?.role !== 'TECNICO') {
      getUsers()
        .then((users) =>
          setTechnicians(
            users.filter(
              (u) => u.is_active && (u.role === 'TECNICO' || u.role === 'GESTIONADOR')
            )
          )
        )
        .catch(console.error);
    }
    if (isOpen) {
      getItems().then(setInventoryItems).catch(console.error);
      api.get('/rca/tree').then(res => setRcaTree(res.data)).catch(console.error);
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !workOrder || isSubmitting || !canEdit) return;
    if (status !== 'EN_PROCESO') return;
    if (status === workOrder.status) return;
    const hasPhoto = !!(workOrder.before_image_url || beforeImage);
    if (!hasPhoto) return;

    const shouldAuto =
      pendingAutoSaveRef.current ||
      (awaitPhotoThenSaveRef.current && workOrder.status === 'PENDIENTE');
    if (!shouldAuto) return;

    pendingAutoSaveRef.current = false;
    awaitPhotoThenSaveRef.current = false;
    skipConfirmRef.current = true;
    const timer = window.setTimeout(() => {
      const form = document.getElementById('update-wo-form') as HTMLFormElement | null;
      form?.requestSubmit();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isOpen, workOrder, status, beforeImage, isSubmitting, canEdit]);

  if (!isOpen || !workOrder) return null;

  const displayWO = liveWorkOrder || workOrder;
  const isClosed = displayWO.status === 'FINALIZADO' || displayWO.status === 'ANULADO';
  const isReadOnly = isClosed || !canEdit;
  const myUserId = (user as any)?.userId || (user as any)?.id || '';
  const assigneeList = displayWO.assigned_technicians || workOrder.assigned_technicians || [];
  const isAssignedToMe = !!myUserId && assigneeList.some((t) => t.id === myUserId);
  /** En proceso/espera sin estar asignado: no pausar/finalizar/reanudar; primero Colaborar. */
  const needsJoinToOperate =
    !isClosed &&
    !isAssignedToMe &&
    (displayWO.status === 'EN_PROCESO' || displayWO.status === 'EN_ESPERA');
  /** Solo en En proceso / En espera (no en Pendiente: ahí solo «Aceptar orden»). */
  const canShowJoin =
    !!onJoin &&
    !isClosed &&
    !isAssignedToMe &&
    (displayWO.status === 'EN_PROCESO' || displayWO.status === 'EN_ESPERA');
  /** En móvil técnico las acciones van en botones grandes: no duplicar con el desplegable. */
  const showStatusSelect = !isClosed && !needsJoinToOperate && !isTechMobileShell;
  const isCorrective =
    displayWO.maintenance_type === 'CORRECTIVO' || workOrder.maintenance_type === 'CORRECTIVO';
  const showRcaSection = status === 'FINALIZADO' && isCorrective;

  const scrollToFinalizeSection = () => {
    window.setTimeout(() => {
      finalizeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const canDownloadPDF = workOrder.status === 'FINALIZADO' && (
    user?.role === 'ADMINISTRADOR' ||
    user?.role === 'GESTIONADOR' ||
    (user?.role === 'TECNICO' && workOrder.assigned_technicians?.some(t => t.id === (user as any).userId || t.id === (user as any).id))
  );

  const pdfRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    try {
      setIsSubmitting(true);
      await generateWorkOrderPDF(workOrder);
    } catch (err: any) {
      console.error("Error generating PDF:", err);
      setError(`Ocurrió un error al generar el PDF: ${err.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDuration = () => {
    let diffMs = 0;

    if (workOrder.accumulated_time_ms) {
      diffMs += workOrder.accumulated_time_ms;
    }

    if (workOrder.status === 'EN_PROCESO' && workOrder.last_resumed_at) {
       diffMs += new Date().getTime() - new Date(workOrder.last_resumed_at).getTime();
    }

    if (diffMs === 0 && workOrder.started_at && workOrder.completed_at) {
      diffMs = new Date(workOrder.completed_at).getTime() - new Date(workOrder.started_at).getTime();
    }

    if (diffMs <= 0) return '0 min';
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours > 0) return `${hours}h ${remainingMins}m`;
    return `${minutes}m`;
  };

  const getPausedTime = () => {
    if (!workOrder.started_at || !workOrder.completed_at || !workOrder.accumulated_time_ms) return null;
    const grossMs = new Date(workOrder.completed_at).getTime() - new Date(workOrder.started_at).getTime();
    const pausedMs = grossMs - workOrder.accumulated_time_ms;

    if (pausedMs <= 60000) return null;

    const minutes = Math.floor(pausedMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (hours > 0) return `${hours}h ${remainingMins}m`;
    return `${minutes}m`;
  };

  let finalStatus = status;
  if (user?.role === 'TECNICO' && workOrder.status === 'PENDIENTE' && status === 'PENDIENTE') {
    finalStatus = 'EN_PROCESO';
  }

  const isDirty = status !== workOrder.status ||
    holdReason !== (workOrder.hold_reason || '') ||
    resolutionNotes !== (workOrder.resolution_notes || '') ||
    beforeImage !== null ||
    afterImage !== null ||
    usedItems.length > 0 ||
    failureProblemId !== ((workOrder as any).failure_problem_id || '') ||
    failureCauseId !== ((workOrder as any).failure_cause_id || '') ||
    failureRemedyId !== ((workOrder as any).failure_remedy_id || '') ||
    !sigCleanAreaEmpty !== !!workOrder.signature_clean_area ||
    !sigDeliveryEmpty !== !!workOrder.signature_delivery ||
    (user?.role !== 'TECNICO' && JSON.stringify([...assignedTechniciansIds].sort()) !== JSON.stringify([...(workOrder.assigned_technicians?.map(t => t.id) || [])].sort()));

  let canSave = isDirty && canEdit;
  if (canSave && needsJoinToOperate && status !== workOrder.status) {
    canSave = false;
  }
  if (canSave) {
    if (finalStatus === 'EN_PROCESO') {
      if (!beforeImage && !workOrder.before_image_url) canSave = false;
    } else if (finalStatus === 'FINALIZADO') {
      if (!resolutionNotes?.trim()) canSave = false;
      if (!afterImage && !workOrder.after_image_url) canSave = false;
      if (sigCleanAreaEmpty || sigDeliveryEmpty) canSave = false;
    } else if (finalStatus === 'EN_ESPERA') {
      if (!holdReason?.trim()) canSave = false;
    }
  }

  const quickActionNextStep = (() => {
    if (status === workOrder.status) return null;
    if (status === 'EN_PROCESO') {
      if (beforeImage || workOrder.before_image_url) {
        return workOrder.status === 'PENDIENTE' || workOrder.status === 'EN_ESPERA'
          ? 'Guardando automáticamente…'
          : 'Siguiente paso: pulsa Guardar para confirmar.';
      }
      return 'Siguiente paso: sube la foto Antes (se guardará solo).';
    }
    if (status === 'EN_ESPERA') {
      if (holdReason?.trim()) return 'Siguiente paso: pulsa Guardar para pausar la orden.';
      return 'Siguiente paso: escribe el motivo de espera y pulsa Guardar.';
    }
    if (status === 'FINALIZADO') {
      return 'Siguiente paso: completa notas, foto Después y firmas; luego pulsa Guardar.';
    }
    return `Estado listo: ${statusLabel(status)}. Completa lo requerido y pulsa Guardar.`;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const skipConfirm = skipConfirmRef.current;
    skipConfirmRef.current = false;
    if (
      !skipConfirm &&
      !window.confirm('¿Estás seguro de que deseas guardar los cambios realizados en esta orden?')
    ) {
      return;
    }

    try {
      // Validar foto antes de iniciar
      if (finalStatus === 'EN_PROCESO' && !beforeImage && !workOrder.before_image_url) {
        setError('Debes subir una foto de evidencia (Antes) para poder iniciar el trabajo.');
        return;
      }

      let cleanAreaBase64 = signatureCleanArea;
      let deliveryBase64 = signatureDelivery;

      if (finalStatus === 'FINALIZADO') {
        if (!resolutionNotes?.trim()) {
          setError('Debes ingresar las notas de resolución detallando el trabajo realizado.');
          return;
        }

        if (!afterImage && !workOrder.after_image_url) {
          setError('Debes subir una foto de evidencia (Después) para poder finalizar el trabajo.');
          return;
        }

        if (sigCleanAreaRef.current && !sigCleanAreaRef.current.isEmpty()) {
          cleanAreaBase64 = sigCleanAreaRef.current.getData() || signatureCleanArea;
        }
        if (sigDeliveryRef.current && !sigDeliveryRef.current.isEmpty()) {
          deliveryBase64 = sigDeliveryRef.current.getData() || signatureDelivery;
        }

        if (!cleanAreaBase64?.trim() || !deliveryBase64?.trim()) {
          setError('Debes ingresar las firmas de liberación de área y entrega de trabajo para finalizar.');
          return;
        }
      }

      if (finalStatus === 'EN_ESPERA' && !holdReason?.trim()) {
        setError('El motivo de espera es obligatorio al pausar la orden.');
        return;
      }

      setIsSubmitting(true);
      setError('');

      const updateData: any = {
        status: finalStatus,
        resolution_notes: resolutionNotes
      };

      if (user?.role !== 'TECNICO') {
        updateData.assigned_technicians_ids = assignedTechniciansIds;
      }

      if (finalStatus === 'EN_ESPERA') {
        updateData.hold_reason = holdReason;
      }

      if (finalStatus === 'FINALIZADO') {
        updateData.signature_clean_area = cleanAreaBase64;
        updateData.signature_delivery = deliveryBase64;
        if (usedItems.length > 0) {
          updateData.used_items = usedItems.map(item => ({ item_id: item.item_id, amount: item.amount }));
        }
        if (failureProblemId) updateData.failure_problem_id = failureProblemId;
        if (failureCauseId) updateData.failure_cause_id = failureCauseId;
        if (failureRemedyId) updateData.failure_remedy_id = failureRemedyId;
      }

      if (beforeImage) updateData.before_image = beforeImage;
      if (afterImage) updateData.after_image = afterImage;

      const result = await onUpdate(workOrder.id, updateData);
      if (result?.offline) {
        alert(
          result.offline_images_queued
            ? 'Sin conexión: se guardaron el estado, las notas y las fotos en este dispositivo. Se subirán automáticamente cuando recuperes la señal.'
            : result.offline_images_skipped
              ? 'Sin conexión: se guardaron el estado y las notas, pero las fotos no se subieron. Cuando recuperes la señal, vuelve a guardar para adjuntarlas.'
              : 'Sin conexión: el cambio se guardó en este dispositivo y se sincronizará automáticamente cuando recuperes la señal.'
        );
      }
      onClose();
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      if (err.response?.status === 409) {
        try {
          const full = await getWorkOrderById(workOrder.id);
          setLiveWorkOrder(full);
        } catch { /* ignore */ }
      }
      setError(err.response?.data?.error || err.message || 'Error inesperado al procesar la orden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (workOrder.status === 'FINALIZADO') {
      setError('No se puede anular una orden finalizada.');
      return;
    }

    const reason = window.prompt('Ingresa el motivo por el cual deseas anular esta orden:');
    if (reason === null) return; // User clicked cancel
    if (!reason.trim()) {
      setError('Debes ingresar un motivo válido para anular la orden.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdate(workOrder.id, { status: 'ANULADO', resolution_notes: reason.trim() });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al anular la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!onJoin) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onJoin(workOrder.id);
      // El padre refresca la OT abierta; no cerramos para que pueda operar de inmediato.
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al unirse a la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>

        <div className="relative bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <span className="bg-slate-200 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg text-sm font-bold border border-slate-300 font-mono">
                  {formatWorkOrderFolio(workOrder.folio)}
                </span>
                <InfoTip text="Folio inmutable (FOL-####). Se asigna al crear la orden y no se puede editar." label="Ayuda: Folio" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 break-words min-w-0">{workOrder.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center mt-1.5">
              <p className="text-sm text-slate-500 dark:text-slate-400">Orden Creada el {formatDate(workOrder.created_at)}</p>
              {workOrder.status === 'FINALIZADO' && getDuration() && (
                <div className="flex items-center gap-1 text-sm text-emerald-800 dark:text-emerald-300 bg-blue-50 px-2 py-0.5 rounded-md font-medium border border-blue-100">
                  <Clock size={14} />
                  <span>Ejecución: {getDuration()}</span>
                </div>
              )}
              {workOrder.status === 'ANULADO' && (
                 <span className="text-sm text-red-600 bg-red-50 px-2 py-0.5 rounded-md font-medium border border-red-100">
                   ANULADA
                 </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canNavigate && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!hasPrev}
                  title="Anterior (←)"
                  aria-label="Orden anterior"
                  className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500 px-0.5 min-w-[3.5rem] text-center">
                  {navIndex + 1}/{workOrderList!.length}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!hasNext}
                  title="Siguiente (→)"
                  aria-label="Orden siguiente"
                  className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
            {workOrder && (user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR') && (
              <button
                type="button"
                title="Crear pendiente ligado a esta OT"
                aria-label="Crear pendiente"
                onClick={() => {
                  const folio = formatWorkOrderFolio(workOrder.folio);
                  const params = new URLSearchParams({
                    tab: 'tasks',
                    wo: workOrder.id,
                    folio,
                    title: `Seguimiento OT ${folio}`,
                  });
                  onClose();
                  navigate(`/notes?${params.toString()}`);
                }}
                className="p-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-full transition-colors"
              >
                <StickyNote size={20} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto">
          {remoteEditorName && (
            <div className="mb-4 p-3 sm:p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-xl text-sm font-medium border border-amber-200 dark:border-amber-800 flex items-start gap-2">
              <Users size={18} className="shrink-0 mt-0.5" />
              <div>
                <strong>En edición por {remoteEditorName}.</strong>
                <span className="block text-amber-800/90 dark:text-amber-300/90 font-normal mt-0.5">
                  Puedes ver la orden en solo lectura. Cuando libere el detalle, podrás editarla.
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Activo Asociado</span>
                <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{workOrder.asset?.name || 'Desconocido'}</div>
              </div>
              <div className="sm:border-l sm:pl-3 md:border-l-0 md:pl-0 lg:border-l lg:pl-3 border-slate-200 dark:border-slate-700/60">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Zona</span>
                <div className="font-medium text-slate-800 dark:text-slate-100 break-words">{workOrder.zone?.name || 'Sin Zona'}</div>
              </div>
            </div>

            {workOrder.status === 'FINALIZADO' && workOrder.started_at && workOrder.completed_at ? (
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/50">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block mb-2 flex items-center gap-1">
                  <Clock size={14} /> Registro de Tiempos
                </span>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs">Inicio:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{formatDateTime(workOrder.started_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs">Fin:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{formatDateTime(workOrder.completed_at)}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-500 dark:text-slate-400 block text-xs">Tiempo Neto Trabajado:</span>
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">{getDuration()}</span>
                  </div>
                  {getPausedTime() && (
                    <div className="col-span-2">
                      <span className="text-slate-500 dark:text-slate-400 block text-xs">Tiempo en Pausa (Espera):</span>
                      <span className="font-medium text-amber-600">{getPausedTime()}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Estado Actual</span>
                <div className="font-medium text-slate-800 dark:text-slate-100">{statusLabel(workOrder.status)}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Prioridad</span>
              <div className={`text-sm font-bold ${
                workOrder.priority === 'URGENTE' ? 'text-red-600' :
                workOrder.priority === 'BAJO' ? 'text-slate-500 dark:text-slate-400' : 'text-blue-600'
              }`}>{workOrder.priority}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">SLA</span>
              <div className="mt-0.5">
                <SlaBadge sla={workOrder.sla} />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tipo</span>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{workOrder.maintenance_type}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Solicitante</span>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 break-words">{workOrder.requester_name || '-'}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Grupo</span>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{workOrder.production_group}</div>
            </div>
          </div>

          {workOrder.machine_stopped && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 font-medium text-sm">
              <Ban size={16} /> ¡Esta falla reporta paro de máquina!
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800 mb-4">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Descripción del Problema</span>
            <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {workOrder.description || <span className="italic text-slate-400">Sin descripción...</span>}
            </div>

            {(displayWO.request_image_url && displayWO.request_image_url !== displayWO.before_image_url) ||
            displayWO.before_image_url ||
            displayWO.after_image_url ? (
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Evidencias fotográficas
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayWO.request_image_url &&
                    displayWO.request_image_url !== displayWO.before_image_url && (
                      <EvidenceThumb
                        src={`${BACKEND_URL}${displayWO.request_image_url}`}
                        alt="Falla reportada"
                        label="Al reportar"
                        onZoom={() => setZoomSrc(`${BACKEND_URL}${displayWO.request_image_url}`)}
                      />
                    )}
                  {displayWO.before_image_url && (
                    <EvidenceThumb
                      src={`${BACKEND_URL}${displayWO.before_image_url}`}
                      alt="Antes"
                      label="Antes de reparar"
                      onZoom={() => setZoomSrc(`${BACKEND_URL}${displayWO.before_image_url}`)}
                    />
                  )}
                  {displayWO.after_image_url && (
                    <EvidenceThumb
                      src={`${BACKEND_URL}${displayWO.after_image_url}`}
                      alt="Después"
                      label="Después"
                      onZoom={() => setZoomSrc(`${BACKEND_URL}${displayWO.after_image_url}`)}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {displayWO.after_image_url && displayWO.signature_clean_area && displayWO.signature_delivery && (
            <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/20 p-3 sm:p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
               <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-2">Firmas de cierre</span>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <span className="text-xs font-semibold text-emerald-700 block mb-1">Firma Liberación de Área:</span>
                     {typeof displayWO.signature_clean_area === 'string' && displayWO.signature_clean_area.startsWith('data:image') ? (
                       <img src={displayWO.signature_clean_area} alt="Firma" className="h-16 object-contain bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 p-1 block" />
                     ) : (
                       <span className="text-sm font-medium text-emerald-900 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-100 block">{displayWO.signature_clean_area}</span>
                     )}
                   </div>
                   <div>
                     <span className="text-xs font-semibold text-emerald-700 block mb-1">Firma Entrega de Trabajo:</span>
                     {typeof displayWO.signature_delivery === 'string' && displayWO.signature_delivery.startsWith('data:image') ? (
                       <img src={displayWO.signature_delivery} alt="Firma" className="h-16 object-contain bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 p-1 block" />
                     ) : (
                       <span className="text-sm font-medium text-emerald-900 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-100 block">{displayWO.signature_delivery}</span>
                     )}
                   </div>
               </div>
            </div>
          )}

          <form id="update-wo-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                {isClosed ? 'Información de Cierre' : isReadOnly ? 'Solo lectura' : 'Actualización (Técnico / Admin)'}
                {!isClosed && !isReadOnly && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-black">Área Editable</span>}
                {isReadOnly && !isClosed && <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-black">Bloqueada</span>}
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className={`p-4 rounded-2xl border relative overflow-hidden ${
                  isClosed
                    ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                    : needsJoinToOperate
                      ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900/50'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50'
                }`}>
                  {/* Decorative background element */}
                  {!isClosed && !needsJoinToOperate && <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 dark:bg-emerald-950/500/10 rounded-full blur-xl pointer-events-none"></div>}

                  {needsJoinToOperate ? (
                    <div className="space-y-3 relative">
                      <div className="text-sm font-bold text-sky-900 dark:text-sky-200 flex items-center gap-2">
                        <Users size={16} />
                        Colaborar en esta orden
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                        Esta orden está <span className="font-semibold">{statusLabel(displayWO.status)}</span> y no estás asignado.
                        Únete para poder pausar, reanudar o finalizar.
                      </p>
                      {/* En shell móvil el CTA vive en «Acción rápida» (abajo); aquí solo en escritorio. */}
                      {!isTechMobileShell && (
                        canShowJoin ? (
                          <button
                            type="button"
                            onClick={handleJoin}
                            disabled={isSubmitting || isReadOnly}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                          >
                            <Users size={18} />
                            {isSubmitting ? 'Uniéndote…' : 'Unirme / Colaborar'}
                          </button>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            No puedes unirte desde aquí. Pide a un administrador que te asigne.
                          </p>
                        )
                      )}
                    </div>
                  ) : (
                    <>
                  <div className={`flex items-center gap-2 text-sm font-bold mb-2 ${
                    isClosed ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-900 dark:text-emerald-200'
                  }`}>
                    Estado de la Orden
                    {showStatusSelect && !isReadOnly && (
                      <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider animate-pulse flex items-center gap-1 font-bold">
                        👉 Haz clic para cambiar
                      </span>
                    )}
                  </div>

                  {isClosed ? (
                    <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                      workOrder.status === 'FINALIZADO'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {workOrder.status === 'FINALIZADO'
                        ? <CheckCircle2 size={17} />
                        : <Ban size={17} />}
                      {statusLabel(workOrder.status)}
                    </div>
                  ) : showStatusSelect ? (
                    <div className="relative">
                      <select
                        className="w-full px-4 py-3.5 border rounded-xl outline-none transition-all appearance-none font-bold text-base shadow-sm bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                        value={status}
                        onChange={(e) => {
                          const next = e.target.value;
                          setStatus(next);
                          if (next === 'FINALIZADO') scrollToFinalizeSection();
                        }}
                        disabled={isReadOnly}
                      >
                        <option value={workOrder.status}>{statusLabel(workOrder.status)}</option>

                        {workOrder.status === 'PENDIENTE' && (
                          <option value="EN_PROCESO">Aceptar orden</option>
                        )}

                        {workOrder.status === 'EN_PROCESO' && isAssignedToMe && (
                          <>
                            <option value="EN_ESPERA">Pausar</option>
                            <option value="FINALIZADO">Finalizar</option>
                          </>
                        )}

                        {workOrder.status === 'EN_ESPERA' && isAssignedToMe && (
                          <option value="EN_PROCESO">Reanudar</option>
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600 dark:text-emerald-400">
                        <ChevronDown size={20} />
                      </div>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                      {statusLabel(status || workOrder.status)}
                    </div>
                  )}
                    </>
                  )}
                </div>

                {user?.role !== 'TECNICO' && !isReadOnly ? (
                  <div ref={assignSectionRef} className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Personal asignado</label>
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                      {technicians.length === 0 ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400 italic">No hay personal disponible</div>
                      ) : (
                        technicians.map((tech) => (
                          <label key={tech.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-lg transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-emerald-800 dark:text-emerald-300 rounded border-slate-300 focus:ring-emerald-600"
                              checked={assignedTechniciansIds.includes(tech.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignedTechniciansIds([...assignedTechniciansIds, tech.id]);
                                } else {
                                  setAssignedTechniciansIds(assignedTechniciansIds.filter(id => id !== tech.id));
                                }
                              }}
                            />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{tech.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {canShowJoin && !needsJoinToOperate && (
                      <button
                        type="button"
                        onClick={handleJoin}
                        disabled={isSubmitting}
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-100 text-sky-900 hover:bg-sky-200 border border-sky-200 rounded-xl font-semibold transition-colors text-sm"
                      >
                        <Users size={16} />
                        Unirme / Colaborar en esta orden
                      </button>
                    )}
                  </div>
                ) : (
                  <div ref={assignSectionRef} className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                      {workOrder.status === 'FINALIZADO' ? 'Personal que intervino' : 'Personal asignado'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {workOrder.assigned_technicians && workOrder.assigned_technicians.length > 0 ? (
                        workOrder.assigned_technicians.map(t => (
                          <span key={t.id} className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {t.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400 italic">Nadie asignado</span>
                      )}
                    </div>
                    {canShowJoin && !needsJoinToOperate && (
                      <button
                        type="button"
                        onClick={handleJoin}
                        disabled={isSubmitting || isReadOnly}
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-100 text-sky-900 hover:bg-sky-200 border border-sky-200 rounded-xl font-semibold transition-colors text-sm disabled:opacity-60"
                      >
                        <Users size={16} />
                        Unirme / Colaborar en esta orden
                      </button>
                    )}
                  </div>
                )}

                {status === 'EN_ESPERA' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 lg:col-span-2">
                    <label className="block text-sm font-medium text-red-600 mb-1">Motivo de Espera *</label>
                    <input
                      ref={holdReasonRef}
                      type="text"
                      required
                      placeholder="Ej: Faltan refacciones..."
                      className={`w-full px-4 py-3 bg-red-50/50 border border-red-200 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500 outline-none transition-all ${isClosed || workOrder.status === 'EN_ESPERA' ? 'opacity-70 cursor-not-allowed' : ''}`}
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      disabled={isReadOnly || workOrder.status === 'EN_ESPERA'}
                    />
                  </div>
                )}

                {(status === 'FINALIZADO' || status === 'ANULADO') && (
                  <div ref={finalizeSectionRef} className="animate-in fade-in slide-in-from-top-2 duration-300 lg:col-span-2">
                    <label className={`block text-sm font-medium mb-1 ${status === 'ANULADO' ? 'text-red-700' : 'text-emerald-700'}`}>
                      {status === 'ANULADO' ? 'Motivo de Anulación' : 'Notas de Resolución'} *
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder={status === 'ANULADO' ? "Razón por la que se anuló..." : "Describe el trabajo realizado, piezas cambiadas, etc..."}
                      className={`w-full px-4 py-3 border rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 outline-none transition-all resize-none ${
                        status === 'ANULADO' ? 'bg-red-50/50 border-red-200 focus:ring-red-500' : 'bg-emerald-50/50 border-emerald-200 focus:ring-emerald-500'
                      } ${isClosed ? 'opacity-70 cursor-not-allowed' : ''}`}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      disabled={isReadOnly}
                    />

                    {showRcaSection && (
                      <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 rounded-xl">
                        <label className="block text-sm font-bold text-orange-800 dark:text-orange-200 mb-1 flex items-center gap-2">
                          <GitBranch size={16} /> Árbol de Fallas (RCA) — opcional
                        </label>
                        {!isReadOnly ? (
                          <>
                        <p className="text-xs text-orange-700/80 dark:text-orange-300/80 mb-3">
                          Puedes dejarlo vacío y guardar igual. Úsalo solo si el problema/causa/solución ya existen en el catálogo.
                        </p>
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 block mb-1">Problema Encontrado</span>
                            <select
                              className="w-full px-3 py-2 border border-orange-200 dark:border-orange-800 rounded-lg text-sm bg-white dark:bg-slate-900"
                              value={failureProblemId}
                              onChange={(e) => {
                                setFailureProblemId(e.target.value);
                                setFailureCauseId('');
                                setFailureRemedyId('');
                              }}
                            >
                              <option value="">Sin registrar / no aplica...</option>
                              {rcaTree.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>

                          {failureProblemId && (
                            <div className="animate-in fade-in duration-200">
                              <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 block mb-1">Causa Raíz</span>
                              <select
                                className="w-full px-3 py-2 border border-orange-200 dark:border-orange-800 rounded-lg text-sm bg-white dark:bg-slate-900"
                                value={failureCauseId}
                                onChange={(e) => {
                                  setFailureCauseId(e.target.value);
                                  setFailureRemedyId('');
                                }}
                              >
                                <option value="">Selecciona la Causa...</option>
                                {rcaTree.find(p => p.id === failureProblemId)?.causes?.map((c: any) => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {failureCauseId && (
                            <div className="animate-in fade-in duration-200">
                              <span className="text-xs font-semibold text-orange-700 dark:text-orange-300 block mb-1">Solución / Acción Tomada</span>
                              <select
                                className="w-full px-3 py-2 border border-orange-200 dark:border-orange-800 rounded-lg text-sm bg-white dark:bg-slate-900"
                                value={failureRemedyId}
                                onChange={(e) => setFailureRemedyId(e.target.value)}
                              >
                                <option value="">Selecciona la Solución...</option>
                                {rcaTree.find(p => p.id === failureProblemId)
                                  ?.causes?.find((c: any) => c.id === failureCauseId)
                                  ?.remedies?.map((r: any) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                              </select>
                            </div>
                          )}
                        </div>
                          </>
                        ) : (
                          <div className="mt-2 space-y-1.5 text-sm text-orange-900 dark:text-orange-100">
                            {(displayWO as any).failure_problem || (displayWO as any).failure_cause || (displayWO as any).failure_remedy ? (
                              <>
                                <p><span className="font-semibold">Problema:</span> {(displayWO as any).failure_problem?.name || '—'}</p>
                                <p><span className="font-semibold">Causa:</span> {(displayWO as any).failure_cause?.name || '—'}</p>
                                <p><span className="font-semibold">Solución:</span> {(displayWO as any).failure_remedy?.name || '—'}</p>
                              </>
                            ) : (
                              <p className="text-orange-700/80 dark:text-orange-300/80 italic">Sin RCA registrado (opcional).</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {isClosed && workOrder.status === 'FINALIZADO' && (
                      <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <label className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                            <Package size={16} /> Repuestos consumidos
                          </label>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            Costo OT:{' '}
                            {formatCurrency(partsCostTotal || 0)}
                          </span>
                        </div>
                        {consumedParts.length > 0 ? (
                          <ul className="bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-900 divide-y divide-blue-50 dark:divide-slate-800">
                            {consumedParts.map((tx) => {
                              const qty = Math.abs(tx.amount);
                              const unit = resolvePartsUnitCost(tx);
                              return (
                                <li key={tx.id} className="px-4 py-2.5 flex justify-between items-center text-sm gap-3">
                                  <div className="min-w-0">
                                    <span className="font-mono text-xs text-slate-400 mr-2">{tx.item.internal_code}</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{tx.item.name}</span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="text-slate-600 dark:text-slate-300">{qty} {tx.item.uom}</div>
                                    <div className="text-xs text-slate-400">
                                      {formatCurrency(qty * unit)}
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-400 italic">Esta OT no registró consumo de refacciones.</p>
                        )}
                      </div>
                    )}

                    {!isReadOnly && (
                      <div className="mt-4 space-y-6">
                        {/* SECCION DE REPUESTOS */}
                        <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
                          <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
                            <Package size={16} /> Repuestos a descontar del almacén
                          </label>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Al finalizar, se descontará el stock y el costo quedará ligado a esta OT.
                          </p>

                          <div className="flex flex-col sm:flex-row gap-2 mb-4">
                            <div className="flex-1 relative">
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white dark:bg-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="Teclea para buscar repuesto..."
                                value={itemSearchText}
                                onChange={(e) => {
                                  setItemSearchText(e.target.value);
                                  setShowDropdown(true);
                                  setSelectedItemToAdd('');
                                }}
                                onFocus={() => setShowDropdown(true)}
                                onBlur={() => setShowDropdown(false)}
                              />
                              {showDropdown && (
                                <ul className="absolute z-50 w-full bg-white dark:bg-slate-900 border border-blue-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto text-xs divide-y divide-slate-100">
                                  {inventoryItems
                                    .filter(i => i.is_active && `${i.internal_code} ${i.name}`.toLowerCase().includes(itemSearchText.toLowerCase()))
                                    .map(item => (
                                      <li
                                        key={item.id}
                                        className="px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer text-slate-700 dark:text-slate-200 transition-colors"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                          setSelectedItemToAdd(item.id);
                                          setItemSearchText(`${item.internal_code} - ${item.name} (Stock: ${item.stock} ${item.uom})`);
                                          setShowDropdown(false);
                                        }}
                                      >
                                        <span className="font-semibold text-slate-900 dark:text-slate-100">{item.internal_code}</span> - {item.name} <span className="text-slate-400 font-medium ml-1">(Stock: {item.stock} {item.uom})</span>
                                      </li>
                                    ))
                                  }
                                  {inventoryItems.filter(i => i.is_active && `${i.internal_code} ${i.name}`.toLowerCase().includes(itemSearchText.toLowerCase())).length === 0 && (
                                    <li className="px-3 py-3 text-slate-400 text-center italic">No hay resultados</li>
                                  )}
                                </ul>
                              )}
                            </div>
                            <input
                              type="number"
                              step={qtyStep(inventoryItems.find((i) => i.id === selectedItemToAdd)?.qty_mode)}
                              min="0.01"
                              placeholder="Cant."
                              className="w-full sm:w-24 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white dark:bg-slate-900"
                              value={amountToAdd}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '' || raw === '.') {
                                  setAmountToAdd(raw);
                                  return;
                                }
                                const n = parseFloat(raw);
                                if (!Number.isFinite(n) || n < 0) {
                                  setAmountToAdd('');
                                  return;
                                }
                                setAmountToAdd(raw);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!selectedItemToAdd || !amountToAdd) return;
                                const itemObj = inventoryItems.find(i => i.id === selectedItemToAdd);
                                if (!itemObj) return;
                                const qty = parseFloat(amountToAdd);
                                const qtyErr = isInvalidQty(qty, itemObj.qty_mode);
                                if (qtyErr) {
                                  alert(qtyErr);
                                  return;
                                }
                                if (qty > itemObj.stock) {
                                  alert(`No hay suficiente stock. Stock actual: ${itemObj.stock}`);
                                  return;
                                }
                                setUsedItems([...usedItems, {
                                  item_id: itemObj.id,
                                  name: itemObj.name,
                                  amount: qty,
                                  uom: itemObj.uom,
                                  max_stock: itemObj.stock,
                                  qty_mode: itemObj.qty_mode,
                                }]);
                                setSelectedItemToAdd('');
                                setItemSearchText('');
                                setAmountToAdd('');
                              }}
                              className="px-4 py-2 bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 rounded-lg text-sm font-medium hover:bg-emerald-700 dark:hover:bg-emerald-400 transition-colors shrink-0"
                            >
                              Agregar
                            </button>
                          </div>

                          {usedItems.length > 0 && (
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-blue-100 overflow-hidden">
                              <ul className="divide-y divide-blue-50">
                                {usedItems.map((item, idx) => (
                                  <li key={idx} className="px-4 py-2.5 flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-500 dark:text-slate-400">{item.amount} {item.uom}</span>
                                      <button
                                        type="button"
                                        onClick={() => setUsedItems(usedItems.filter((_, i) => i !== idx))}
                                        className="text-red-500 hover:text-red-700 p-1"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="p-4 bg-emerald-100/50 border border-emerald-200 rounded-xl space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-emerald-800 mb-2">📸 Evidencia de Reparación (Después) *</label>
                            <div className="flex gap-2">
                              <label className="flex-1 flex flex-col items-center justify-center py-3 border border-emerald-200 rounded-xl bg-emerald-50/50 hover:bg-emerald-100 cursor-pointer transition-colors text-emerald-700">
                                <span className="text-xl mb-1">📷</span>
                                <span className="text-xs font-semibold">Tomar Foto</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => setAfterImage(e.target.files?.[0] || null)}
                                  className="hidden"
                                />
                              </label>
                              <label className="flex-1 flex flex-col items-center justify-center py-3 border border-emerald-200 rounded-xl bg-emerald-50/50 hover:bg-emerald-100 cursor-pointer transition-colors text-emerald-700">
                                <span className="text-xl mb-1">🖼️</span>
                                <span className="text-xs font-semibold">Subir Archivo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => setAfterImage(e.target.files?.[0] || null)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                            {afterImage && (
                              <div className="mt-2 text-xs text-emerald-700 font-medium px-2 flex justify-between items-center">
                                <span className="truncate max-w-[80%]">✓ {afterImage.name}</span>
                                <button type="button" onClick={() => setAfterImage(null)} className="text-red-500 hover:text-red-700 font-semibold p-1">Quitar</button>
                              </div>
                            )}
                          </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-emerald-200/50">
                          <div>
                            <SignatureField
                              ref={sigCleanAreaRef}
                              label="Firma: Liberación de Área Limpia *"
                              onChange={() => setSigCleanAreaEmpty(sigCleanAreaRef.current?.isEmpty() ?? true)}
                            />
                          </div>
                          <div>
                            <SignatureField
                              ref={sigDeliveryRef}
                              label="Firma: Entrega de Trabajo *"
                              onChange={() => setSigDeliveryEmpty(sigDeliveryRef.current?.isEmpty() ?? true)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {status === 'EN_PROCESO' && !workOrder.before_image_url && (
                  <div ref={evidenceRef} className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 lg:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">📸 Evidencia del Problema (Antes) *</label>
                    <div className="flex gap-2">
                      <label className="flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400">
                        <span className="text-xl mb-1">📷</span>
                        <span className="text-xs font-semibold">Tomar Foto</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => setBeforeImage(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                      <label className="flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400">
                        <span className="text-xl mb-1">🖼️</span>
                        <span className="text-xs font-semibold">Subir Archivo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setBeforeImage(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {beforeImage && (
                      <div className="mt-2 text-xs text-emerald-600 font-medium px-2 flex justify-between items-center">
                        <span className="truncate max-w-[80%]">✓ {beforeImage.name}</span>
                        <button type="button" onClick={() => setBeforeImage(null)} className="text-red-500 hover:text-red-700 font-semibold p-1">Quitar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <WorkOrderCommentsPanel
                  workOrderId={workOrder.id}
                  isOpen={isOpen}
                  canWrite={!isClosed}
                  onZoomImage={(src) => setZoomSrc(src)}
                />
              </div>
            </div>
          </form>
        </div>

        {isTechMobileShell && !isClosed && (needsJoinToOperate || !isReadOnly) && (
          <div className="px-3 pt-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">Acción rápida</p>
            {needsJoinToOperate ? (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  No estás en el equipo de esta orden. Únete para pausar, reanudar o finalizar.
                </p>
                {canShowJoin && (
                  <button
                    type="button"
                    onClick={handleJoin}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-60"
                  >
                    <Users size={18} />
                    {isSubmitting ? 'Uniéndote…' : 'Unirme / Colaborar'}
                  </button>
                )}
              </div>
            ) : (
              <>
            <div className="grid grid-cols-2 gap-2">
              {/* Usar status local: si no, al tocar Aceptar el badge pasa a En proceso pero el botón sigue ahí. */}
              {workOrder.status === 'PENDIENTE' && status === 'PENDIENTE' && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus('EN_PROCESO');
                    if (workOrder.before_image_url) {
                      pendingAutoSaveRef.current = true;
                      skipConfirmRef.current = true;
                    } else {
                      awaitPhotoThenSaveRef.current = true;
                      setTimeout(() => evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
                    }
                  }}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
                >
                  <PlayCircle size={18} /> Aceptar y continuar
                </button>
              )}
              {workOrder.status === 'PENDIENTE' && status === 'EN_PROCESO' && (
                <div className="col-span-2 rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40 px-3 py-3 space-y-2">
                  <p className="text-sm font-bold text-sky-800 dark:text-sky-200 flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} />{' '}
                    {beforeImage || workOrder.before_image_url
                      ? 'Guardando aceptación…'
                      : 'Sube la foto Antes — se guardará solo'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('PENDIENTE');
                      awaitPhotoThenSaveRef.current = false;
                      pendingAutoSaveRef.current = false;
                      skipConfirmRef.current = false;
                    }}
                    className="w-full text-center text-[11px] font-semibold text-sky-700 dark:text-sky-300 underline"
                  >
                    Deshacer aceptación
                  </button>
                </div>
              )}
              {workOrder.status === 'EN_PROCESO' && isAssignedToMe && status === 'EN_PROCESO' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('EN_ESPERA');
                      setTimeout(() => {
                        const empty = !(holdReasonRef.current?.value || '').trim() && !holdReason.trim();
                        if (!empty) return;
                        if (holdReasonRef.current) {
                          holdReasonRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          holdReasonRef.current.focus();
                        } else {
                          setHoldReason('Esperando refacciones / material');
                        }
                      }, 100);
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
                  >
                    <PauseCircle size={18} /> Pausar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('FINALIZADO');
                      scrollToFinalizeSection();
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
                  >
                    <CheckCircle2 size={18} /> Finalizar
                  </button>
                </>
              )}
              {workOrder.status === 'EN_PROCESO' && isAssignedToMe && status === 'EN_ESPERA' && (
                <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-3 space-y-2">
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-200 text-center">
                    Pausar — escribe el motivo y pulsa Guardar
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus('EN_PROCESO')}
                    className="w-full text-center text-[11px] font-semibold text-amber-700 dark:text-amber-300 underline"
                  >
                    Deshacer pausa
                  </button>
                </div>
              )}
              {workOrder.status === 'EN_PROCESO' && isAssignedToMe && status === 'FINALIZADO' && (
                <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-3 py-3 space-y-2">
                  <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 text-center">
                    Finalizar — completa evidencia y firmas, luego Guardar
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus('EN_PROCESO')}
                    className="w-full text-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 underline"
                  >
                    Deshacer finalizar
                  </button>
                </div>
              )}
              {workOrder.status === 'EN_ESPERA' && isAssignedToMe && status === 'EN_ESPERA' && (
                <button
                  type="button"
                  onClick={() => {
                    setStatus('EN_PROCESO');
                    if (workOrder.before_image_url) {
                      pendingAutoSaveRef.current = true;
                      skipConfirmRef.current = true;
                    } else {
                      setTimeout(() => evidenceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
                    }
                  }}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
                >
                  <PlayCircle size={18} /> Reanudar
                </button>
              )}
              {workOrder.status === 'EN_ESPERA' && isAssignedToMe && status === 'EN_PROCESO' && (
                <div className="col-span-2 rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40 px-3 py-3 space-y-2">
                  <p className="text-sm font-bold text-sky-800 dark:text-sky-200 flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} /> Reanudación lista — confirma con Guardar
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus('EN_ESPERA')}
                    className="w-full text-center text-[11px] font-semibold text-sky-700 dark:text-sky-300 underline"
                  >
                    Deshacer reanudación
                  </button>
                </div>
              )}
            </div>
            {quickActionNextStep && (
              <p className="mt-2 text-center text-[11px] font-medium text-sky-700 dark:text-sky-300">
                {quickActionNextStep}
              </p>
            )}
              </>
            )}
          </div>
        )}

        <div className="px-4 py-4 sm:px-6 sm:py-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-slate-50/50 dark:bg-slate-900/50 mt-auto">
          <div className="flex gap-2 justify-stretch sm:justify-start [&>button]:flex-1 [&>button]:sm:flex-initial">
            {hasPermission('DELETE_WORK_ORDERS') && onDelete && workOrder.status !== 'FINALIZADO' && canEdit && (
              <>
                <button type="button" onClick={() => onDelete(workOrder.id)} className="px-3 sm:px-4 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors">
                  <Trash2 size={15} /> Eliminar
                </button>
                {workOrder.status !== 'ANULADO' && (
                  <button type="button" onClick={handleVoid} disabled={isSubmitting} className="px-3 sm:px-4 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors disabled:opacity-70">
                    <Ban size={15} /> Anular
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 justify-stretch sm:justify-end [&>button]:flex-1 [&>button]:sm:flex-initial">
            {canDownloadPDF && (
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isSubmitting}
                className="px-3 sm:px-5 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-100 rounded-xl transition-colors shadow-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                PDF
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 sm:px-5 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
              Cerrar
            </button>
            {!isReadOnly && canSave && (
              <button
                type="submit"
                form="update-wo-form"
                disabled={isSubmitting}
                className={`px-4 sm:px-6 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 disabled:opacity-70 rounded-xl shadow-md shadow-emerald-700/25 transition-colors animate-in fade-in zoom-in-95 duration-200 ${
                  isTechMobileShell
                    ? 'min-h-12 py-3 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900 animate-pulse'
                    : 'py-2.5 font-medium'
                }`}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Guardar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    {zoomSrc && (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
        onClick={() => setZoomSrc(null)}
        role="dialog"
        aria-modal="true"
        aria-label="Vista ampliada de evidencia"
      >
        <button
          type="button"
          onClick={() => setZoomSrc(null)}
          className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Cerrar zoom"
        >
          <X size={22} />
        </button>
        <img
          src={zoomSrc}
          alt="Evidencia ampliada"
          className="max-h-[92vh] max-w-[96vw] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}
    </ErrorBoundary>
  );
};
