import { forwardRef } from 'react';
import type { WorkOrder } from '../api/workOrders';
import { BACKEND_URL } from '../api/axios';

interface Props {
  workOrder: WorkOrder;
}

export const WorkOrderPDFTemplate = forwardRef<HTMLDivElement, Props>(({ workOrder }, ref) => {
  return (
    <div 
      ref={ref} 
      className="bg-white p-10" 
      style={{ 
        width: '800px', 
        minHeight: '1120px', 
        color: 'black', 
        fontFamily: 'sans-serif',
        position: 'absolute',
        left: '-9999px',
        top: '0'
      }}
    >
      {/* Encabezado */}
      <div className="border-b-4 border-emerald-800 pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-wide text-slate-900">Reporte de Mantenimiento</h1>
          <p className="text-slate-600 mt-1 font-medium text-lg">Folio: WO-{(workOrder.folio || 0).toString().padStart(4, '0')}</p>
        </div>
        <div className="text-right text-sm text-slate-500 font-medium">
          <p>Generado el: {new Date().toLocaleDateString()}</p>
          <p>Estado Final: <span className="text-emerald-700 font-bold uppercase">{workOrder.status}</span></p>
        </div>
      </div>

      {/* Info General */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Información del Activo</p>
          <p className="font-bold text-xl text-slate-800 mb-1">{workOrder.asset?.name || 'Activo Desconocido'}</p>
          <div className="text-sm text-slate-600 space-y-1">
            <p><b>ID:</b> {workOrder.asset?.id || 'N/A'}</p>
            <p><b>Zona:</b> {workOrder.zone?.name || 'N/A'}</p>
          </div>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Detalles de la Orden</p>
          <div className="text-sm text-slate-600 space-y-1">
            <p><b>Prioridad:</b> {workOrder.priority}</p>
            <p><b>Tipo:</b> {workOrder.maintenance_type}</p>
            <p><b>Solicitante:</b> {workOrder.requester_name}</p>
            <p><b>Grupo:</b> {workOrder.production_group}</p>
            {workOrder.machine_stopped && <p className="text-red-600 font-bold mt-2">⚠ Hubo Paro de Máquina</p>}
          </div>
        </div>
      </div>

      {/* Descripciones */}
      <div className="mb-6">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción del Problema Reportado</p>
        <p className="text-sm p-4 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap text-slate-800">
          {workOrder.description || 'Sin descripción'}
        </p>
      </div>

      <div className="mb-6">
        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">Trabajo Realizado (Resolución)</p>
        <p className="text-sm p-4 bg-emerald-50 border border-emerald-200 rounded-lg whitespace-pre-wrap text-slate-800 font-medium">
          {workOrder.resolution_notes || 'Sin notas de resolución'}
        </p>
      </div>

      {/* Evidencias */}
      <div className="mb-8">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Evidencia Fotográfica</p>
        <div className="grid grid-cols-3 gap-4">
          {workOrder.request_image_url ? (
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1 text-center">Falla Reportada</p>
              <img crossOrigin="anonymous" src={`${BACKEND_URL}${workOrder.request_image_url}`} className="w-full h-40 object-cover border-2 border-slate-200 rounded-lg" />
            </div>
          ) : <div className="border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center h-40"><span className="text-xs text-slate-400">Sin foto reporte</span></div>}
          
          {workOrder.before_image_url ? (
            <div>
              <p className="text-[10px] font-bold text-slate-500 mb-1 text-center">Antes de Reparar</p>
              <img crossOrigin="anonymous" src={`${BACKEND_URL}${workOrder.before_image_url}`} className="w-full h-40 object-cover border-2 border-slate-200 rounded-lg" />
            </div>
          ) : <div className="border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center h-40"><span className="text-xs text-slate-400">Sin foto antes</span></div>}
          
          {workOrder.after_image_url ? (
            <div>
              <p className="text-[10px] font-bold text-emerald-600 mb-1 text-center">Reparación Finalizada</p>
              <img crossOrigin="anonymous" src={`${BACKEND_URL}${workOrder.after_image_url}`} className="w-full h-40 object-cover border-2 border-emerald-300 rounded-lg" />
            </div>
          ) : <div className="border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center h-40"><span className="text-xs text-slate-400">Sin foto después</span></div>}
        </div>
      </div>

      {/* Tiempos y Técnicos */}
      <div className="grid grid-cols-2 gap-6 mb-12">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Técnicos Asignados</p>
          <div className="text-sm text-slate-700 font-medium">
            {workOrder.assigned_technicians && workOrder.assigned_technicians.length > 0 
              ? workOrder.assigned_technicians.map(t => t.name).join(', ')
              : 'Ninguno'}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Registro de Tiempos</p>
          <div className="text-sm text-slate-700">
            <p><b>Inicio:</b> {workOrder.started_at ? new Date(workOrder.started_at).toLocaleString() : 'N/A'}</p>
            <p><b>Fin:</b> {workOrder.completed_at ? new Date(workOrder.completed_at).toLocaleString() : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Firmas */}
      <div className="grid grid-cols-2 gap-12 mt-auto pt-8 border-t-2 border-slate-800">
        <div className="text-center">
          {typeof workOrder.signature_clean_area === 'string' && workOrder.signature_clean_area.startsWith('data:image') && (
            <img src={workOrder.signature_clean_area} className="h-20 mx-auto mb-2 object-contain" />
          )}
          {(!workOrder.signature_clean_area || (typeof workOrder.signature_clean_area === 'string' && !workOrder.signature_clean_area.startsWith('data:image'))) && (
            <div className="h-20 flex items-end justify-center mb-2">
              <span className="text-lg font-bold italic text-slate-700">{workOrder.signature_clean_area}</span>
            </div>
          )}
          <div className="border-t-2 border-slate-800 pt-2 w-4/5 mx-auto">
            <p className="text-sm font-bold text-slate-800 uppercase">Liberación de Área Limpia</p>
            <p className="text-xs text-slate-500">Firma o Sello</p>
          </div>
        </div>

        <div className="text-center">
          {typeof workOrder.signature_delivery === 'string' && workOrder.signature_delivery.startsWith('data:image') && (
            <img src={workOrder.signature_delivery} className="h-20 mx-auto mb-2 object-contain" />
          )}
          {(!workOrder.signature_delivery || (typeof workOrder.signature_delivery === 'string' && !workOrder.signature_delivery.startsWith('data:image'))) && (
            <div className="h-20 flex items-end justify-center mb-2">
              <span className="text-lg font-bold italic text-slate-700">{workOrder.signature_delivery}</span>
            </div>
          )}
          <div className="border-t-2 border-slate-800 pt-2 w-4/5 mx-auto">
            <p className="text-sm font-bold text-slate-800 uppercase">Entrega de Trabajo</p>
            <p className="text-xs text-slate-500">Firma o Sello</p>
          </div>
        </div>
      </div>

    </div>
  );
});
