import { useState } from 'react';
import type { Asset } from '../api/assets';
import { Activity, Ban, Settings, Trash2, Edit, Database, QrCode, Image as ImageIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { BACKEND_URL } from '../api/axios';

type SortField = 'zone' | 'vendor' | 'status' | 'name' | 'internal_code' | 'brand_model' | null;
type SortDirection = 'asc' | 'desc';

interface Props {
  assets: Asset[];
  onDelete: (id: string) => void;
  onEdit?: (asset: Asset) => void;
  onRowClick?: (asset: Asset) => void;
  onPrintQR?: (asset: Asset) => void;
  canManage: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export const AssetsTable = ({
  assets,
  onDelete,
  onEdit,
  onRowClick,
  onPrintQR,
  canManage,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: Props) => {
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{status}</span>;
    }
  };

  if (assets.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-950 text-slate-400 mb-4">
          <Database size={24} />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No hay activos registrados</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Registra tu primer equipo o maquinaria.</p>
      </div>
    );
  }

  const sortedAssets = [...assets].sort((a, b) => {
    if (!sortField) return 0;
    let valA = '';
    let valB = '';
    switch (sortField) {
      case 'zone':
        valA = a.zone?.name || '';
        valB = b.zone?.name || '';
        break;
      case 'vendor':
        valA = a.vendor?.name || '';
        valB = b.vendor?.name || '';
        break;
      case 'status':
        valA = a.status || '';
        valB = b.status || '';
        break;
      case 'name':
        valA = a.name || '';
        valB = b.name || '';
        break;
      case 'internal_code':
        valA = a.internal_code || '';
        valB = b.internal_code || '';
        break;
      case 'brand_model':
        valA = `${a.brand || ''} ${a.model || ''}`;
        valB = `${b.brand || ''} ${b.model || ''}`;
        break;
    }
    const cmp = valA.localeCompare(valB);
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  return (
    <div>
      {/* Vista de Tarjetas para Celulares */}
      <div className="block sm:hidden space-y-4">
        {sortedAssets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => (selectionMode ? onToggleSelect?.(asset.id) : onRowClick?.(asset))}
            className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border shadow-sm active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer ${
              selectionMode && selectedIds?.has(asset.id)
                ? 'border-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-900'
                : 'border-slate-150'
            }`}
          >
            <div className="flex justify-between items-start mb-2 gap-2">
              <div className="flex items-center gap-2">
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={!!selectedIds?.has(asset.id)}
                    onChange={() => onToggleSelect?.(asset.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                )}
                <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  {asset.internal_code}
                </span>
              </div>
              <div className="flex-shrink-0">
                {getStatusBadge(asset.status)}
              </div>
            </div>

            <div className="flex gap-3 mb-2">
              {asset.image_url ? (
                <img
                  src={`${BACKEND_URL}${asset.image_url}`}
                  alt={asset.name}
                  className="w-12 h-12 rounded-xl object-cover bg-slate-100 dark:bg-slate-800 shadow-sm flex-shrink-0 border border-slate-200 dark:border-slate-700/60"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-200 dark:border-slate-700/60 shadow-sm">
                  <ImageIcon size={20} />
                </div>
              )}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1 leading-snug">{asset.name}</h3>
                {asset.description && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2 mb-1 leading-relaxed">
                    {asset.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] border-t border-slate-100 dark:border-slate-800 pt-2.5 mt-2">
              <div className="text-slate-500 dark:text-slate-400">
                Zona: <span className="font-semibold text-slate-700 dark:text-slate-200">{asset.zone?.name || 'Sin Zona'}</span>
              </div>

              {canManage && (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {onPrintQR && (
                    <button
                      onClick={() => onPrintQR(asset)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-950/50 rounded-lg transition-colors"
                      title="Imprimir QR"
                    >
                      <QrCode size={15} />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(asset)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
              <tr>
                {selectionMode && <th className="px-4 py-4 w-10" />}
                <th className="px-6 py-4 hidden sm:table-cell cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => handleSort('internal_code')}>
                  <div className="flex items-center gap-1.5">Código {sortField === 'internal_code' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1.5">Equipo {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 hidden sm:table-cell cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => handleSort('zone')}>
                  <div className="flex items-center gap-1.5">Zona {sortField === 'zone' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 hidden lg:table-cell cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => handleSort('vendor')}>
                  <div className="flex items-center gap-1.5">Proveedor {sortField === 'vendor' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 hidden md:table-cell cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => handleSort('brand_model')}>
                  <div className="flex items-center gap-1.5">Marca / Modelo {sortField === 'brand_model' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => handleSort('status')}>
                  <div className="flex items-center gap-1.5">Estado {sortField === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                {canManage && <th className="px-6 py-4 text-right uppercase tracking-wider text-[11px] font-bold">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAssets.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => (selectionMode ? onToggleSelect?.(asset.id) : onRowClick?.(asset))}
                  className={`transition-colors ${
                    selectionMode && selectedIds?.has(asset.id) ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : ''
                  } ${onRowClick || selectionMode ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {selectionMode && (
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!selectedIds?.has(asset.id)}
                        onChange={() => onToggleSelect?.(asset.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono text-sm text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                    {asset.internal_code}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {asset.image_url ? (
                        <img
                          src={`${BACKEND_URL}${asset.image_url}`}
                          alt={asset.name}
                          className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700/60"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700/60 font-semibold text-xs">
                          {asset.name?.substring(0, 2).toUpperCase() || 'NA'}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{asset.name}</div>
                        {asset.description && <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 line-clamp-1">{asset.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200 hidden sm:table-cell">
                    {asset.zone?.name || <span className="text-slate-400 italic">Sin Zona</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200 hidden lg:table-cell">
                    {asset.vendor?.name || <span className="text-slate-400 italic">-</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-200 hidden md:table-cell">
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
                            className="p-2 text-slate-400 hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-950/50 rounded-lg transition-colors"
                            title="Imprimir QR"
                          >
                            <QrCode size={18} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(asset)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
