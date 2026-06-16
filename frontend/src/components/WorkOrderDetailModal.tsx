import { useState, useEffect } from 'react';
import { X, Loader2, Save, Trash2, Ban, Clock } from 'lucide-react';
import type { WorkOrder } from '../api/workOrders';
import { useAuth } from '../context/AuthContext';
import { getUsers } from '../api/users';
import type { User } from '../api/users';
import { SignatureField } from './SignatureField';
import { BACKEND_URL } from '../api/axios';
import type { SignatureFieldRef } from './SignatureField';
import { useRef } from 'react';
import { Download } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { generateWorkOrderPDF } from '../utils/pdfGenerator';

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
  
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [assignedTechniciansIds, setAssignedTechniciansIds] = useState<string[]>([]);

  useEffect(() => {
    if (workOrder) {
      setStatus(workOrder.status);
      setHoldReason(workOrder.hold_reason || '');
      setResolutionNotes(workOrder.resolution_notes || '');
      setSignatureCleanArea(workOrder.signature_clean_area || '');
      setSignatureDelivery(workOrder.signature_delivery || '');
      setAssignedTechniciansIds(workOrder.assigned_technicians?.map(t => t.id) || []);
      setBeforeImage(null);
      setAfterImage(null);
      setError('');
    }
  }, [workOrder]);

  useEffect(() => {
    if (isOpen && user?.role !== 'TECNICO') {
      getUsers('TECNICO').then(setTechnicians).catch(console.error);
    }
  }, [isOpen, user]);

  if (!isOpen || !workOrder) return null;

  const isClosed = workOrder.status === 'FINALIZADO' || workOrder.status === 'ANULADO';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let finalStatus = status;
      // Si la orden está PENDIENTE y el técnico le da guardar, pasarla a EN_PROCESO automáticamente
      if (user?.role === 'TECNICO' && workOrder.status === 'PENDIENTE' && status === 'PENDIENTE') {
        finalStatus = 'EN_PROCESO';
      }

      if (finalStatus === 'EN_PROCESO' && user?.role !== 'TECNICO' && assignedTechniciansIds.length === 0) {
        setError('Debes asignar al menos un técnico para poder poner la orden en proceso.');
        return;
      }

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
        setError('El motivo de espera es obligatorio cuando el estado es EN_ESPERA.');
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
      }
      
      if (beforeImage) updateData.before_image = beforeImage;
      if (afterImage) updateData.after_image = afterImage;

      await onUpdate(workOrder.id, updateData);
      onClose();
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      setError(err.response?.data?.error || err.message || 'Error inesperado al procesar la orden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async () => {
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>

        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg text-sm font-bold border border-slate-300">
                WO-{(workOrder.folio || 0).toString().padStart(4, '0')}
              </span>
              <h2 className="text-xl font-bold text-slate-800">{workOrder.title}</h2>
            </div>
            <div className="flex gap-4 items-center mt-2">
              <p className="text-sm text-slate-500">Orden Creada el {new Date(workOrder.created_at).toLocaleDateString()}</p>
              {workOrder.status === 'FINALIZADO' && getDuration() && (
                <div className="flex items-center gap-1 text-sm text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md font-medium border border-blue-100">
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
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Activo Asociado</span>
                <div className="font-medium text-slate-800">{workOrder.asset?.name || 'Desconocido'}</div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200/60">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Zona</span>
                <div className="font-medium text-slate-800">{workOrder.zone?.name || 'Sin Zona'}</div>
              </div>
            </div>
            
            {workOrder.status === 'FINALIZADO' && workOrder.started_at && workOrder.completed_at ? (
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block mb-2 flex items-center gap-1">
                  <Clock size={14} /> Registro de Tiempos
                </span>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 block text-xs">Inicio:</span>
                    <span className="font-medium text-slate-800">{new Date(workOrder.started_at).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs">Fin:</span>
                    <span className="font-medium text-slate-800">{new Date(workOrder.completed_at).toLocaleString()}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-slate-500 block text-xs">Tiempo Neto Trabajado:</span>
                    <span className="font-bold text-blue-800">{getDuration()}</span>
                  </div>
                  {getPausedTime() && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block text-xs">Tiempo en Pausa (Espera):</span>
                      <span className="font-medium text-amber-600">{getPausedTime()}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Estado Actual</span>
                <div className="font-medium text-slate-800">{workOrder.status}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Prioridad</span>
              <div className={`text-sm font-bold ${
                workOrder.priority === 'URGENTE' ? 'text-red-600' :
                workOrder.priority === 'BAJO' ? 'text-slate-500' : 'text-blue-600'
              }`}>{workOrder.priority}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tipo</span>
              <div className="text-sm font-medium text-slate-700">{workOrder.maintenance_type}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Solicitante</span>
              <div className="text-sm font-medium text-slate-700 truncate" title={workOrder.requester_name}>{workOrder.requester_name || '-'}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Grupo</span>
              <div className="text-sm font-medium text-slate-700">{workOrder.production_group}</div>
            </div>
          </div>

          {workOrder.machine_stopped && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 font-medium text-sm">
              <Ban size={16} /> ¡Esta falla reporta paro de máquina!
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-8">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Descripción del Problema</span>
            <div className="text-sm text-slate-700 whitespace-pre-wrap">
              {workOrder.description || <span className="italic text-slate-400">Sin descripción...</span>}
            </div>
            
            {workOrder.request_image_url && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">📸 Foto al reportar la falla</span>
                <img src={`${BACKEND_URL}${workOrder.request_image_url}`} alt="Falla Reportada" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
              </div>
            )}
            
            {workOrder.before_image_url && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">📸 Evidencia Técnica (Antes de reparar)</span>
                <img src={`${BACKEND_URL}${workOrder.before_image_url}`} alt="Antes" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
              </div>
            )}
          </div>
          
          {workOrder.after_image_url && (
            <div className="mb-8 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
               <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-2">📸 Evidencia de Reparación (Después)</span>
               <img src={`${BACKEND_URL}${workOrder.after_image_url}`} alt="Después" className="w-full h-48 object-cover rounded-xl border border-emerald-200" />
               
               {workOrder.signature_clean_area && workOrder.signature_delivery && (
                 <div className="mt-4 pt-4 border-t border-emerald-200/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div>
                     <span className="text-xs font-semibold text-emerald-700 block mb-1">Firma Liberación de Área:</span>
                     {typeof workOrder.signature_clean_area === 'string' && workOrder.signature_clean_area.startsWith('data:image') ? (
                       <img src={workOrder.signature_clean_area} alt="Firma" className="h-16 object-contain bg-white rounded-lg border border-emerald-100 p-1 block" />
                     ) : (
                       <span className="text-sm font-medium text-emerald-900 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 block">{workOrder.signature_clean_area}</span>
                     )}
                   </div>
                   <div>
                     <span className="text-xs font-semibold text-emerald-700 block mb-1">Firma Entrega de Trabajo:</span>
                     {typeof workOrder.signature_delivery === 'string' && workOrder.signature_delivery.startsWith('data:image') ? (
                       <img src={workOrder.signature_delivery} alt="Firma" className="h-16 object-contain bg-white rounded-lg border border-emerald-100 p-1 block" />
                     ) : (
                       <span className="text-sm font-medium text-emerald-900 bg-white px-3 py-1.5 rounded-lg border border-emerald-100 block">{workOrder.signature_delivery}</span>
                     )}
                   </div>
                 </div>
               )}
            </div>
          )}

          <form id="update-wo-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Actualización (Técnico / Admin)</h3>
              
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado de la Orden</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-800 outline-none transition-all appearance-none font-medium"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={isClosed}
                  >
                    <option value={workOrder.status}>{workOrder.status}</option>
                    
                    {workOrder.status === 'PENDIENTE' && (
                      <option value="EN_PROCESO">EN_PROCESO (Aceptar Orden)</option>
                    )}
                    
                    {workOrder.status === 'EN_PROCESO' && (
                      <>
                        <option value="EN_ESPERA">EN_ESPERA (Pausar)</option>
                        <option value="FINALIZADO">FINALIZADO (Completar)</option>
                      </>
                    )}
                    
                    {workOrder.status === 'EN_ESPERA' && (
                      <option value="EN_PROCESO">EN_PROCESO (Reanudar)</option>
                    )}
                  </select>
                </div>

                {user?.role !== 'TECNICO' ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Técnicos Asignados</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                      {technicians.length === 0 ? (
                        <div className="text-sm text-slate-500 italic">No hay técnicos disponibles</div>
                      ) : (
                        technicians.map((tech) => (
                          <label key={tech.id} className={`flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg transition-colors ${isClosed ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-800 rounded border-slate-300 focus:ring-blue-800"
                              checked={assignedTechniciansIds.includes(tech.id)}
                              disabled={isClosed}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignedTechniciansIds([...assignedTechniciansIds, tech.id]);
                                } else {
                                  setAssignedTechniciansIds(assignedTechniciansIds.filter(id => id !== tech.id));
                                }
                              }}
                            />
                            <span className="text-sm font-medium text-slate-700">{tech.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Técnicos Asignados</label>
                    <div className="flex flex-wrap gap-2">
                      {workOrder.assigned_technicians && workOrder.assigned_technicians.length > 0 ? (
                        workOrder.assigned_technicians.map(t => (
                          <span key={t.id} className="bg-slate-100 px-3 py-1 rounded-md text-sm font-medium text-slate-700">
                            {t.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500 italic">Nadie asignado</span>
                      )}
                    </div>
                    {!isClosed && workOrder.assigned_technicians && workOrder.assigned_technicians.length > 0 && !workOrder.assigned_technicians.some(t => t.id === (user as any).userId || t.id === (user as any).id) && (workOrder.status === 'EN_PROCESO' || workOrder.status === 'PENDIENTE') && (
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
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-red-600 mb-1">Motivo de Espera *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: Faltan refacciones..."
                      className={`w-full px-4 py-3 bg-red-50/50 border border-red-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all ${isClosed ? 'opacity-70 cursor-not-allowed' : ''}`}
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      disabled={isClosed}
                    />
                  </div>
                )}

                {(status === 'FINALIZADO' || status === 'ANULADO') && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className={`block text-sm font-medium mb-1 ${status === 'ANULADO' ? 'text-red-700' : 'text-emerald-700'}`}>
                      {status === 'ANULADO' ? 'Motivo de Anulación' : 'Notas de Resolución'} *
                    </label>
                    <textarea 
                      required
                      rows={4}
                      placeholder={status === 'ANULADO' ? "Razón por la que se anuló..." : "Describe el trabajo realizado, piezas cambiadas, etc..."}
                      className={`w-full px-4 py-3 border rounded-xl text-slate-900 focus:ring-2 outline-none transition-all resize-none ${
                        status === 'ANULADO' ? 'bg-red-50/50 border-red-200 focus:ring-red-500' : 'bg-emerald-50/50 border-emerald-200 focus:ring-emerald-500'
                      } ${isClosed ? 'opacity-70 cursor-not-allowed' : ''}`}
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      disabled={isClosed}
                    />
                    
                    {!isClosed && (
                      <div className="mt-4 p-4 bg-emerald-100/50 border border-emerald-200 rounded-xl space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-emerald-800 mb-2">📸 Evidencia de Reparación (Después)</label>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => setAfterImage(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-emerald-700
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-sm file:font-semibold
                              file:bg-emerald-600 file:text-white
                              hover:file:bg-emerald-700 transition-colors cursor-pointer"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-emerald-200/50">
                          <div>
                            <SignatureField 
                              ref={sigCleanAreaRef}
                              label="Firma: Liberación de Área Limpia *"
                            />
                          </div>
                          <div>
                            <SignatureField 
                              ref={sigDeliveryRef}
                              label="Firma: Entrega de Trabajo *"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {status === 'EN_PROCESO' && workOrder.status === 'PENDIENTE' && (
                  <div className="pt-4 mt-2 border-t border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-2">📸 Evidencia del Problema (Antes)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setBeforeImage(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-slate-100 file:text-slate-700
                        hover:file:bg-slate-200 transition-colors cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-5 border-t border-slate-100 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-slate-50/50 mt-auto">
          <div className="flex gap-2 justify-stretch sm:justify-start [&>button]:flex-1 [&>button]:sm:flex-initial">
            {hasPermission('DELETE_WORK_ORDERS') && onDelete && (
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
                className="px-3 sm:px-5 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors shadow-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                PDF
              </button>
            )}
            <button type="button" onClick={onClose} className="px-3 sm:px-5 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors">
              Cerrar
            </button>
            {!isClosed && (
              <button type="submit" form="update-wo-form" disabled={isSubmitting} className="px-4 sm:px-6 py-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 rounded-xl shadow-sm shadow-emerald-700/20 transition-colors">
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
