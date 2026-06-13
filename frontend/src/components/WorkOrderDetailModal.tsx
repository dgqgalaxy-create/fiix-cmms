import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import type { WorkOrder } from '../api/workOrders';
import { useAuth } from '../context/AuthContext';

interface Props {
  workOrder: WorkOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: any) => Promise<void>;
}

export const WorkOrderDetailModal = ({ workOrder, isOpen, onClose, onUpdate }: Props) => {
  const { user } = useAuth();
  
  const [status, setStatus] = useState<string>('');
  const [holdReason, setHoldReason] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  
  const [beforeImage, setBeforeImage] = useState<File | null>(null);
  const [afterImage, setAfterImage] = useState<File | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (workOrder) {
      setStatus(workOrder.status);
      setHoldReason(workOrder.hold_reason || '');
      setResolutionNotes(workOrder.resolution_notes || '');
      setBeforeImage(null);
      setAfterImage(null);
      setError('');
    }
  }, [workOrder]);

  if (!isOpen || !workOrder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'EN_ESPERA' && !holdReason.trim()) {
      setError('El motivo de espera es obligatorio cuando el estado es EN_ESPERA.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      const updateData: any = {
        status,
        resolution_notes: resolutionNotes
      };

      if (status === 'EN_ESPERA') {
        updateData.hold_reason = holdReason;
      }
      
      if (beforeImage) updateData.before_image = beforeImage;
      if (afterImage) updateData.after_image = afterImage;

      await onUpdate(workOrder.id, updateData);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar la orden de trabajo');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{workOrder.title}</h2>
            <p className="text-sm text-slate-500 mt-1">Orden Creada el {new Date(workOrder.created_at).toLocaleDateString()}</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Activo Asociado</span>
              <div className="font-medium text-slate-800">{workOrder.asset.name}</div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Descripción del Problema</span>
              <div className="text-sm text-slate-700 whitespace-pre-wrap">
                {workOrder.description || <span className="italic text-slate-400">Sin descripción...</span>}
              </div>
              
              {workOrder.before_image_url && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Evidencia (Antes)</span>
                  <img src={`http://localhost:3000${workOrder.before_image_url}`} alt="Antes" className="w-full h-32 object-cover rounded-xl border border-slate-200" />
                </div>
              )}
            </div>
          </div>
          
          {workOrder.after_image_url && (
            <div className="mb-8 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
               <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block mb-1">Evidencia (Después)</span>
               <img src={`http://localhost:3000${workOrder.after_image_url}`} alt="Después" className="w-full h-48 object-cover rounded-xl border border-emerald-200" />
            </div>
          )}

          <form id="update-wo-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Actualización (Técnico / Admin)</h3>
              
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado de la Orden</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all appearance-none font-medium"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={workOrder.status === 'FINALIZADO'}
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

                {status === 'EN_ESPERA' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-red-600 mb-1">Motivo de Espera *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ej: Faltan refacciones..."
                      className="w-full px-4 py-3 bg-red-50/50 border border-red-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                    />
                  </div>
                )}

                {status === 'FINALIZADO' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-medium text-emerald-700 mb-1">Notas de Resolución *</label>
                    <textarea 
                      required
                      rows={4}
                      placeholder="Describe el trabajo realizado, piezas cambiadas, etc..."
                      className="w-full px-4 py-3 bg-emerald-50/50 border border-emerald-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                    />
                    
                    <div className="mt-4 p-4 bg-emerald-100/50 border border-emerald-200 rounded-xl">
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
                  </div>
                )}
                
                {workOrder.status !== 'FINALIZADO' && (
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

        <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 mt-auto">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors">
            Cerrar
          </button>
          <button type="submit" form="update-wo-form" disabled={isSubmitting} className="px-6 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-70 rounded-xl shadow-sm shadow-purple-500/20 transition-colors">
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
