import type { Asset } from '../api/assets';
import { Activity, Ban, Settings, Trash2, Edit, Database } from 'lucide-react';

interface Props {
  assets: Asset[];
  onDelete: (id: string) => void;
  onEdit?: (asset: Asset) => void;
  onRowClick?: (asset: Asset) => void;
  canManage: boolean;
}

export const AssetsTable = ({ assets, onDelete, onEdit, onRowClick, canManage }: Props) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIVO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
            <Activity size={14} /> Operativo
          </span>
        );
      case 'EN_MANTENIMIENTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Settings size={14} /> Mantenimiento
          </span>
        );
      case 'FUERA_DE_SERVICIO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <Ban size={14} /> Fuera de Servicio
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  if (assets.length === 0) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-4">
          <Database size={24} />
        </div>
        <h3 className="text-lg font-medium text-slate-900">No hay activos registrados</h3>
        <p className="text-slate-500 mt-1">Registra tu primer equipo o maquinaria.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-4">Código</th>
              <th className="px-6 py-4">Equipo</th>
              <th className="px-6 py-4">Zona</th>
              <th className="px-6 py-4">Marca / Modelo</th>
              <th className="px-6 py-4">Estado</th>
              {canManage && <th className="px-6 py-4 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((asset) => (
              <tr 
                key={asset.id} 
                onClick={() => onRowClick?.(asset)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50/50' : 'hover:bg-slate-50/50'}`}
              >
                <td className="px-6 py-4 font-mono text-sm text-slate-500">
                  {asset.internal_code}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{asset.name}</div>
                  {asset.description && <div className="text-slate-500 text-xs mt-1 line-clamp-1">{asset.description}</div>}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {asset.zone?.name || <span className="text-slate-400 italic">Sin Zona</span>}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {asset.brand} <span className="text-slate-400">/</span> {asset.model}
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(asset.status)}
                </td>
                {canManage && (
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <button 
                          onClick={() => onEdit(asset)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => onDelete(asset.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
