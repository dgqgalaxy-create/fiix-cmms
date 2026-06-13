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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-4">Orden</th>
              <th className="px-6 py-4">Activo</th>
              <th className="px-6 py-4">Estado</th>
              <th className="px-6 py-4">Asignado A</th>
              <th className="px-6 py-4">Fecha Creación</th>
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
                  <div className="font-medium text-slate-900">{wo.title}</div>
                  {wo.description && <div className="text-slate-500 text-xs mt-1 line-clamp-1">{wo.description}</div>}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      {wo.asset.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-700">{wo.asset.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(wo.status)}
                </td>
                <td className="px-6 py-4">
                  {wo.assigned_to ? (
                    <span className="text-slate-700">{wo.assigned_to.name}</span>
                  ) : (
                    <span className="text-slate-400 italic">Sin asignar</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {new Date(wo.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
