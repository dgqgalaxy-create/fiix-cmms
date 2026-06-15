import { X, Database, MapPin, Tag, Activity, Settings, Ban } from 'lucide-react';
import type { Asset } from '../api/assets';

interface Props {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AssetDetailModal = ({ asset, isOpen, onClose }: Props) => {
  if (!isOpen || !asset) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIVO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
            <Activity size={16} /> Operativo
          </span>
        );
      case 'EN_MANTENIMIENTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
            <Settings size={16} /> Mantenimiento
          </span>
        );
      case 'FUERA_DE_SERVICIO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <Ban size={16} /> Fuera de Servicio
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Database size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-mono font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {asset.internal_code}
                </span>
                {getStatusBadge(asset.status)}
              </div>
              <h2 className="text-xl font-bold text-slate-800">{asset.name}</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="space-y-6">
            
            {/* Description */}
            {asset.description && (
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2">Descripción</h3>
                <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl leading-relaxed">
                  {asset.description}
                </p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Tag size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Marca</span>
                </div>
                <div className="text-sm font-medium text-slate-800">{asset.brand || 'No especificada'}</div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Settings size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Modelo</span>
                </div>
                <div className="text-sm font-medium text-slate-800">{asset.model || 'No especificado'}</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <MapPin size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Zona asignada</span>
                </div>
                <div className="text-sm font-medium text-slate-800">{asset.zone?.name || 'Sin Zona'}</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Database size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Número de Serie</span>
                </div>
                <div className="text-sm font-medium text-slate-800">{asset.serial_number || 'No especificado'}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
