import type { WorkOrder } from '../api/workOrders';
import { Clock, CheckCircle2, AlertCircle, Wrench } from 'lucide-react';

interface Props {
  workOrders: WorkOrder[];
  onRowClick?: (wo: WorkOrder) => void;
}

export const WorkOrdersTable = ({ workOrders, onRowClick }: Props) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock size={14} /> Pendiente
          </span>
        );
      case 'EN_PROCESO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Wrench size={14} /> En Proceso
          </span>
        );
      case 'EN_ESPERA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle size={14} /> En Espera
          </span>
        );
      case 'FINALIZADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={14} /> Finalizado
          </span>
        );
      case 'ANULADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 line-through">
            <AlertCircle size={14} /> Anulado
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  if (workOrders.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-4">
          <Wrench size={24} />
        </div>
        <h3 className="text-lg font-medium text-slate-900">No hay órdenes de trabajo</h3>
        <p className="text-slate-500 mt-1">Crea una nueva orden para comenzar.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Vista de Tarjetas para Celulares */}
      <div className="block sm:hidden space-y-4">
        {workOrders.map((wo) => (
          <div 
            key={wo.id} 
            onClick={() => onRowClick && onRowClick(wo)}
            className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">
                  WO-{(wo.folio || 0).toString().padStart(4, '0')}
                </span>
                {wo.priority === 'URGENTE' && (
                  <span className="bg-red-150 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200">
                    URGENTE
                  </span>
                )}
              </div>
              <div className="flex-shrink-0">
                {getStatusBadge(wo.status)}
              </div>
            </div>
            
            <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug">{wo.title}</h3>
            {wo.description && (
              <p className="text-slate-500 text-xs line-clamp-2 mb-3 leading-relaxed">
                {wo.description}
              </p>
            )}
            
            <div className="flex justify-between items-center text-[11px] border-t border-slate-100 pt-2.5 mt-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                <div className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                  {wo.asset.name.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-medium text-slate-700 truncate" title={wo.asset.name}>{wo.asset.name}</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 truncate" title={wo.zone?.name || 'Sin Zona'}>{wo.zone?.name || 'Sin Zona'}</span>
              </div>
              <span className="text-slate-400 font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-150 shrink-0">
                {wo.maintenance_type}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Vista de Tabla para Escritorio */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">Orden</th>
                <th className="px-6 py-4">Activo y Zona</th>
                <th className="px-6 py-4 hidden sm:table-cell">Tipo</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 hidden md:table-cell">Asignado A</th>
                <th className="px-6 py-4 hidden md:table-cell">Fecha Creación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workOrders.map((wo) => (
                <tr 
                  key={wo.id} 
                  onClick={() => onRowClick && onRowClick(wo)}
                  className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50'}`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-bold border border-slate-200">
                          WO-{(wo.folio || 0).toString().padStart(4, '0')}
                        </span>
                        {wo.priority === 'URGENTE' && (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold border border-red-200">
                            URGENTE
                          </span>
                        )}
                        <div className="font-medium text-slate-900">{wo.title}</div>
                    </div>
                    {wo.description && <div className="text-slate-500 text-xs line-clamp-1">{wo.description}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {wo.asset.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-slate-700 block">{wo.asset.name}</span>
                        <span className="text-xs text-slate-500 block">{wo.zone?.name || 'Sin Zona'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden sm:table-cell">
                    <span className="text-sm font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {wo.maintenance_type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(wo.status)}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    {wo.assigned_technicians && wo.assigned_technicians.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {wo.assigned_technicians.map((t) => (
                          <span key={t.id} className="text-slate-700 text-xs font-medium bg-slate-100 px-2 py-0.5 rounded-md inline-block w-fit">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Sin asignar</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 hidden md:table-cell">
                    {new Date(wo.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
