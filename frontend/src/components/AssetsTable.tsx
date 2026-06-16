import type { Asset } from '../api/assets';
import { Activity, Ban, Settings, Trash2, Edit, Database, QrCode } from 'lucide-react';

interface Props {
  assets: Asset[];
  onDelete: (id: string) => void;
  onEdit?: (asset: Asset) => void;
  onRowClick?: (asset: Asset) => void;
  onPrintQR?: (asset: Asset) => void;
  canManage: boolean;
}

export const AssetsTable = ({ assets, onDelete, onEdit, onRowClick, onPrintQR, canManage }: Props) => {
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
    <div>
      {/* Vista de Tarjetas para Celulares */}
      <div className="block sm:hidden space-y-4">
        {assets.map((asset) => (
          <div 
            key={asset.id} 
            onClick={() => onRowClick?.(asset)}
            className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {asset.internal_code}
              </span>
              <div className="flex-shrink-0">
                {getStatusBadge(asset.status)}
              </div>
            </div>
            
            <h3 className="font-bold text-slate-900 text-sm mb-1 leading-snug">{asset.name}</h3>
            {asset.description && (
              <p className="text-slate-500 text-xs line-clamp-2 mb-3 leading-relaxed">
                {asset.description}
              </p>
            )}
            
            <div className="flex justify-between items-center text-[11px] border-t border-slate-100 pt-2.5 mt-2">
              <div className="text-slate-500">
                Zona: <span className="font-semibold text-slate-700">{asset.zone?.name || 'Sin Zona'}</span>
              </div>
              
              {canManage && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {onPrintQR && (
                    <button 
                      onClick={() => onPrintQR(asset)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Imprimir QR"
                    >
                      <QrCode size={15} />
                    </button>
                  )}
                  {onEdit && (
                    <button 
                      onClick={() => onEdit(asset)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit size={15} />
                    </button>
                  )}
                  <button 
                    onClick={() => onDelete(asset.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
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
                <th className="px-6 py-4 hidden sm:table-cell">Código</th>
                <th className="px-6 py-4">Equipo</th>
                <th className="px-6 py-4 hidden sm:table-cell">Zona</th>
                <th className="px-6 py-4 hidden md:table-cell">Marca / Modelo</th>
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
                  <td className="px-6 py-4 font-mono text-sm text-slate-500 hidden sm:table-cell">
                    {asset.internal_code}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{asset.name}</div>
                    {asset.description && <div className="text-slate-500 text-xs mt-1 line-clamp-1">{asset.description}</div>}
                  </td>
                  <td className="px-6 py-4 text-slate-700 hidden sm:table-cell">
                    {asset.zone?.name || <span className="text-slate-400 italic">Sin Zona</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-700 hidden md:table-cell">
                    {asset.brand} <span className="text-slate-400">/</span> {asset.model}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(asset.status)}
                  </td>
                  {canManage && (
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {onPrintQR && (
                          <button 
                            onClick={() => onPrintQR(asset)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Imprimir QR"
                          >
                            <QrCode size={18} />
                          </button>
                        )}
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
    </div>
  );
};
