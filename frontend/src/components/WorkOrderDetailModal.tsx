import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Save, Trash2, Ban, Clock, Package, GitBranch, ChevronDown, CheckCircle2, Users } from 'lucide-react';
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
  onUpdate: (id: string, data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onJoin?: (id: string) => Promise<void>;
}

export const WorkOrderDetailModal = ({ workOrder, isOpen, onClose, onUpdate, onDelete, onJoin }: Props) => {
  const { user, hasPermission } = useAuth();
  const { canEdit, remoteEditorName } = useWorkOrderPresence(workOrder?.id, isOpen);

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
  const [usedItems, setUsedItems] = useState<{item_id: string, name: string, amount: number, uom: string, max_stock: number}[]>([]);
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

  useEffect(() => {
    if (workOrder) setLiveWorkOrder(workOrder);
  }, [workOrder]);

  // Sync detalle en vivo (sobre todo si otro usuario es el editor)
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
            setConsumedParts(full.inventory_transactions || []);
            setPartsCostTotal(full.parts_cost_total || 0);
          })
          .catch(() => {});
      }
    }
  }, [liveWorkOrder, workOrder, canEdit]);

  useEffect(() => {
    if (isOpen && user?.role !== 'TECNICO') {
      getUsers('TECNICO').then(setTechnicians).catch(console.error);
    }
    if (isOpen) {
      getItems().then(setInventoryItems).catch(console.error);
      api.get('/rca/tree').then(res => setRcaTree(res.data)).catch(console.error);
    }
  }, [isOpen, user]);

  if (!isOpen || !workOrder) return null;

  const displayWO = liveWorkOrder || workOrder;
  const isClosed = displayWO.status === 'FINALIZADO' || displayWO.status === 'ANULADO';
  const isReadOnly = isClosed || !canEdit;

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
  if (canSave) {
    if (finalStatus === 'EN_PROCESO') {
      if (!beforeImage && !workOrder.before_image_url) canSave = false;
    } else if (finalStatus === 'FINALIZADO') {
      if (!resolutionNotes?.trim()) canSave = false;
      if (!afterImage && !workOrder.after_image_url) canSave = false;
      if (sigCleanAreaEmpty || sigDeliveryEmpty) canSave = false;
      if (workOrder.maintenance_type === 'CORRECTIVO' && (!failureProblemId || !failureCauseId || !failureRemedyId)) canSave = false;
    } else if (finalStatus === 'EN_ESPERA') {
      if (!holdReason?.trim()) canSave = false;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!window.confirm("¿Estás seguro de que deseas guardar los cambios realizados en esta orden?")) {
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

      await onUpdate(workOrder.id, updateData);
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
    try {
      await onJoin(workOrder.id);
      onClose();
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
              <span
                className="bg-slate-200 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-lg text-sm font-bold border border-slate-300 font-mono"
                title="Folio inmutable (FOL-####). Se asigna al crear la orden y no se puede editar."
              >
                {formatWorkOrderFolio(workOrder.folio)}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 break-words min-w-0">{workOrder.title}</h2>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-4 items-center mt-1.5">
              <p className="text-sm text-slate-500 dark:text-slate-400">Orden Creada el {new Date(workOrder.created_at).toLocaleDateString()}</p>
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
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
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
                    <span className="font-medium text-slate-800 dark:text-slate-100">{new Date(workOrder.started_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs">Fin:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{new Date(workOrder.completed_at).toLocaleString()}</span>
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
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1" title="Acuerdo de Nivel de Servicio">SLA</span>
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

            {workOrder.request_image_url && (
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">📸 Foto al reportar la falla</span>
                <img src={`${BACKEND_URL}${workOrder.request_image_url}`} alt="Falla Reportada" className="w-full max-h-64 object-contain bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700" />
              </div>
            )}

            {workOrder.before_image_url && (
              <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">📸 Evidencia Técnica (Antes de reparar)</span>
                <img src={`${BACKEND_URL}${workOrder.before_image_url}`} alt="Antes" className="w-full max-h-64 object-contain bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700" />
              </div>
            )}
          </div>

          {workOrder.after_image_url && (
            <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/20 p-3 sm:p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
               <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-2">📸 Evidencia de Reparación (Después)</span>
               <img src={`${BACKEND_URL}${workOrder.after_image_url}`} alt="Después" className="w-full max-h-72 object-contain bg-white dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-emerald-900" />

               {workOrder.signature_clean_area && workOrder.signature_delivery && (
                 <div className="mt-4 pt-4 border-t border-emerald-200/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <span className="text-xs font-semibold text-emerald-700 block mb-1">Firma Liberación de Área:</span>
                     {typeof workOrder.signature_clean_area === 'string' && workOrder.signature_clean_area.startsWith('data:image') ? (
                       <img src={workOrder.signature_clean_area} alt="Firma" className="h-16 object-contain bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 p-1 block" />
                     ) : (
                       <span className="text-sm font-medium text-emerald-900 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-100 block">{workOrder.signature_clean_area}</span>
                     )}
                   </div>
                   <div>
                     <span className="text-xs font-semibold text-emerald-700 block mb-1">Firma Entrega de Trabajo:</span>
                     {typeof workOrder.signature_delivery === 'string' && workOrder.signature_delivery.startsWith('data:image') ? (
                       <img src={workOrder.signature_delivery} alt="Firma" className="h-16 object-contain bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 p-1 block" />
                     ) : (
                       <span className="text-sm font-medium text-emerald-900 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-emerald-100 block">{workOrder.signature_delivery}</span>
                     )}
                   </div>
                 </div>
               )}
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
                    : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-100 dark:border-emerald-900/50'
                }`}>
                  {/* Decorative background element */}
                  {!isClosed && <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 dark:bg-emerald-950/500/10 rounded-full blur-xl pointer-events-none"></div>}

                  <div className={`flex items-center gap-2 text-sm font-bold mb-2 ${
                    isClosed ? 'text-slate-500 dark:text-slate-400' : 'text-emerald-900 dark:text-emerald-200'
                  }`}>
                    Estado de la Orden
                    {!isReadOnly && (
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
                  ) : (
                    <div className="relative">
                      <select
                        className="w-full px-4 py-3.5 border rounded-xl outline-none transition-all appearance-none font-bold text-base shadow-sm bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value={workOrder.status}>{statusLabel(workOrder.status)}</option>

                        {workOrder.status === 'PENDIENTE' && (
                          <option value="EN_PROCESO">Aceptar orden</option>
                        )}

                        {workOrder.status === 'EN_PROCESO' && (
                          <>
                            <option value="EN_ESPERA">Pausar</option>
                            <option value="FINALIZADO">Finalizar</option>
                          </>
                        )}

                        {workOrder.status === 'EN_ESPERA' && (
                          <option value="EN_PROCESO">Reanudar</option>
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-600 dark:text-emerald-400">
                        <ChevronDown size={20} />
                      </div>
                    </div>
                  )}
                </div>

                {user?.role !== 'TECNICO' && !isReadOnly ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Técnicos Asignados</label>
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                      {technicians.length === 0 ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400 italic">No hay técnicos disponibles</div>
                      ) : (
                        technicians.filter(tech => tech.is_active !== false).map((tech) => (
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
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                      {workOrder.status === 'FINALIZADO' ? 'Técnicos que intervinieron' : 'Técnicos Asignados'}
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
                    {!isReadOnly && workOrder.assigned_technicians && workOrder.assigned_technicians.length > 0 && !workOrder.assigned_technicians.some(t => t.id === (user as any).userId || t.id === (user as any).id) && (workOrder.status === 'EN_PROCESO' || workOrder.status === 'PENDIENTE') && (
                      <button
                        type="button"
                        onClick={handleJoin}
                        disabled={isSubmitting}
                        className="mt-3 w-full px-4 py-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200 rounded-xl font-medium transition-colors text-sm"
                      >
                        Unirme a esta orden
                      </button>
                    )}
                  </div>
                )}

                {status === 'EN_ESPERA' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 lg:col-span-2">
                    <label className="block text-sm font-medium text-red-600 mb-1">Motivo de Espera *</label>
                    <input
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
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300 lg:col-span-2">
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

                    {!isReadOnly && status === 'FINALIZADO' && workOrder.maintenance_type === 'CORRECTIVO' && (
                      <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                        <label className="block text-sm font-bold text-orange-800 mb-1 flex items-center gap-2">
                          <GitBranch size={16} /> Árbol de Fallas (RCA) — opcional
                        </label>
                        <p className="text-xs text-orange-700/80 mb-3">
                          Úsalo solo si el problema/causa/solución ya existen en el catálogo. Si no está, deja vacío y reporta el caso para ampliar el árbol.
                        </p>
                        <div className="space-y-3">
                          <div>
                            <span className="text-xs font-semibold text-orange-700 block mb-1">Problema Encontrado</span>
                            <select
                              className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm bg-white dark:bg-slate-900"
                              value={failureProblemId}
                              onChange={(e) => {
                                setFailureProblemId(e.target.value);
                                setFailureCauseId('');
                                setFailureRemedyId('');
                              }}
                            >
                              <option value="">Selecciona el Problema...</option>
                              {rcaTree.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>

                          {failureProblemId && (
                            <div className="animate-in fade-in duration-200">
                              <span className="text-xs font-semibold text-orange-700 block mb-1">Causa Raíz</span>
                              <select
                                className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm bg-white dark:bg-slate-900"
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
                                className="w-full px-3 py-2 border border-orange-200 rounded-lg text-sm bg-white dark:bg-slate-900"
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
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(partsCostTotal || 0)}
                          </span>
                        </div>
                        {consumedParts.length > 0 ? (
                          <ul className="bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-900 divide-y divide-blue-50 dark:divide-slate-800">
                            {consumedParts.map((tx) => {
                              const qty = Math.abs(tx.amount);
                              const unit = tx.unit_cost ?? tx.item.purchase_cost ?? 0;
                              return (
                                <li key={tx.id} className="px-4 py-2.5 flex justify-between items-center text-sm gap-3">
                                  <div className="min-w-0">
                                    <span className="font-mono text-xs text-slate-400 mr-2">{tx.item.internal_code}</span>
                                    <span className="font-medium text-slate-700 dark:text-slate-200">{tx.item.name}</span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <div className="text-slate-600 dark:text-slate-300">{qty} {tx.item.uom}</div>
                                    <div className="text-xs text-slate-400">
                                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(qty * unit)}
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
                              step="0.01"
                              min="0.01"
                              placeholder="Cant."
                              className="w-full sm:w-24 px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white dark:bg-slate-900"
                              value={amountToAdd}
                              onChange={(e) => setAmountToAdd(e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!selectedItemToAdd || !amountToAdd) return;
                                const itemObj = inventoryItems.find(i => i.id === selectedItemToAdd);
                                if (!itemObj) return;
                                const qty = parseFloat(amountToAdd);
                                if (qty > itemObj.stock) {
                                  alert(`No hay suficiente stock. Stock actual: ${itemObj.stock}`);
                                  return;
                                }
                                setUsedItems([...usedItems, {
                                  item_id: itemObj.id,
                                  name: itemObj.name,
                                  amount: qty,
                                  uom: itemObj.uom,
                                  max_stock: itemObj.stock
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
                  <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 lg:col-span-2">
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
            </div>
          </form>
        </div>

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
              <button type="submit" form="update-wo-form" disabled={isSubmitting} className="px-4 sm:px-6 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 disabled:opacity-70 rounded-xl shadow-sm shadow-emerald-700/20 transition-colors animate-in fade-in zoom-in-95 duration-200">
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                Guardar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
};
