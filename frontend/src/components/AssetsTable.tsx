import { useState, useEffect, useMemo } from 'react';
import type { Asset } from '../api/assets';
import { Activity, Ban, Settings, Trash2, Edit, Database, QrCode, Image as ImageIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { BACKEND_URL } from '../api/axios';

const ITEMS_PER_PAGE = 20;

type SortField = 'zone' | 'section' | 'vendor' | 'status' | 'name' | 'internal_code' | 'brand_model' | null;
type SortDirection = 'asc' | 'desc';

interface Props {
  assets: Asset[];
  /** Cambia al filtrar/buscar para volver a la página 1 */
  filterKey?: string;
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
  filterKey = '',
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
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterKey]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusBadge = (status: string, compact = false) => {
    const pad = compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5';
    const iconSize = compact ? 12 : 14;
    switch (status) {
      case 'OPERATIVO':
        return (
          <span className={`inline-flex items-center gap-1 ${pad} rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 whitespace-nowrap`} title="Operativo">
            <Activity size={iconSize} /> {compact ? 'Op.' : 'Operativo'}
          </span>
        );
      case 'EN_MANTENIMIENTO':
        return (
          <span className={`inline-flex items-center gap-1 ${pad} rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 whitespace-nowrap`} title="Mantenimiento">
            <Settings size={iconSize} /> {compact ? 'Mant.' : 'Mantenimiento'}
          </span>
        );
      case 'FUERA_DE_SERVICIO':
        return (
          <span className={`inline-flex items-center gap-1 ${pad} rounded-full text-[11px] font-medium bg-red-100 text-red-700 whitespace-nowrap`} title="Fuera de Servicio">
            <Ban size={iconSize} /> {compact ? 'Fuera' : 'Fuera de Serv.'}
          </span>
        );
      default:
        return <span className={`${pad} rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>{status}</span>;
    }
  };

  const sortedAssets = useMemo(() => {
    const list = [...assets];
    if (!sortField) return list;
    list.sort((a, b) => {
      let valA = '';
      let valB = '';
      switch (sortField) {
        case 'zone':
          valA = a.zone?.name || '';
          valB = b.zone?.name || '';
          break;
        case 'section':
          valA = a.zone_section?.name || a.section || '';
          valB = b.zone_section?.name || b.section || '';
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
    return list;
  }, [assets, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedAssets.length / ITEMS_PER_PAGE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const pageAssets = sortedAssets.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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

  const thClass =
    'px-2 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group';
  const tdClass = 'px-2 py-2.5';

  const paginationControls = sortedAssets.length > ITEMS_PER_PAGE && (
    <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 sm:px-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-4">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={safePage === 1}
          className="relative inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Mostrando <span className="font-medium">{(safePage - 1) * ITEMS_PER_PAGE + 1}</span> a{' '}
          <span className="font-medium">{Math.min(safePage * ITEMS_PER_PAGE, sortedAssets.length)}</span> de{' '}
          <span className="font-medium">{sortedAssets.length}</span> resultados
        </p>
        <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm" aria-label="Pagination">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="relative inline-flex items-center rounded-l-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
          >
            <span className="sr-only">Anterior</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
            </svg>
          </button>
          {[...Array(totalPages)].map((_, i) => {
            if (i === 0 || i === totalPages - 1 || (i >= safePage - 2 && i <= safePage)) {
              return (
                <button
                  type="button"
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                    safePage === i + 1
                      ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
                      : 'text-slate-900 dark:text-slate-100 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {i + 1}
                </button>
              );
            }
            if ((i === 1 && safePage > 3) || (i === totalPages - 2 && safePage < totalPages - 2)) {
              return (
                <span key={i} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-300 dark:ring-slate-700">
                  ...
                </span>
              );
            }
            return null;
          })}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="relative inline-flex items-center rounded-r-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
          >
            <span className="sr-only">Siguiente</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );

  return (
    <div className="min-w-0">
      {/* Vista densa para Celulares */}
      <div className="block sm:hidden space-y-2">
        {pageAssets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => (selectionMode ? onToggleSelect?.(asset.id) : onRowClick?.(asset))}
            className={`bg-white dark:bg-slate-900 px-3 py-2.5 rounded-xl border shadow-sm active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer ${
              selectionMode && selectedIds?.has(asset.id)
                ? 'border-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-900'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={!!selectedIds?.has(asset.id)}
                    onChange={() => onToggleSelect?.(asset.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
                  />
                )}
                <span
                  className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 truncate max-w-[11rem]"
                  title={asset.internal_code}
                >
                  {asset.internal_code}
                </span>
              </div>
              <div className="flex-shrink-0">
                {getStatusBadge(asset.status, true)}
              </div>
            </div>

            <div className="flex gap-2.5 items-center">
              {asset.image_url ? (
                <img
                  src={`${BACKEND_URL}${asset.image_url}`}
                  alt={asset.name}
                  className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700/60"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-200 dark:border-slate-700/60 font-semibold text-[10px]">
                  {asset.name?.substring(0, 2).toUpperCase() || <ImageIcon size={14} />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug truncate" title={asset.name}>{asset.name}</h3>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {asset.zone?.name || 'Sin Zona'}
                  {(asset.zone_section?.name || asset.section) && (
                    <span> · {asset.zone_section?.name || asset.section}</span>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {onPrintQR && (
                    <button
                      onClick={() => onPrintQR(asset)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-950/50 rounded-lg transition-colors"
                      title="Imprimir QR"
                    >
                      <QrCode size={14} />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(asset)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(asset.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Vista de Tabla para Escritorio — sin scroll horizontal */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden min-w-0">
        <table className="w-full table-fixed text-left text-sm text-slate-600 dark:text-slate-400">
          <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
            <tr>
              {selectionMode && <th className="px-2 py-2.5 w-10" />}
              <th className={`${thClass} w-[9.5rem]`} onClick={() => handleSort('internal_code')}>
                <div className="flex items-center gap-1">Código {sortField === 'internal_code' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500 shrink-0"/> : <ChevronDown size={14} className="text-emerald-500 shrink-0"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />}</div>
              </th>
              <th className={thClass} onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">Equipo {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500 shrink-0"/> : <ChevronDown size={14} className="text-emerald-500 shrink-0"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />}</div>
              </th>
              <th className={`${thClass} hidden md:table-cell w-[6.5rem]`} onClick={() => handleSort('zone')}>
                <div className="flex items-center gap-1">Zona {sortField === 'zone' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500 shrink-0"/> : <ChevronDown size={14} className="text-emerald-500 shrink-0"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />}</div>
              </th>
              <th className={`${thClass} hidden lg:table-cell w-[4.5rem]`} onClick={() => handleSort('section')}>
                <div className="flex items-center gap-1">Sec. {sortField === 'section' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500 shrink-0"/> : <ChevronDown size={14} className="text-emerald-500 shrink-0"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />}</div>
              </th>
              <th className={`${thClass} hidden xl:table-cell w-[7rem]`} onClick={() => handleSort('vendor')}>
                <div className="flex items-center gap-1">Prov. {sortField === 'vendor' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500 shrink-0"/> : <ChevronDown size={14} className="text-emerald-500 shrink-0"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />}</div>
              </th>
              <th className={`${thClass} hidden xl:table-cell w-[7.5rem]`} onClick={() => handleSort('brand_model')}>
                <div className="flex items-center gap-1">Marca {sortField === 'brand_model' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500 shrink-0"/> : <ChevronDown size={14} className="text-emerald-500 shrink-0"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />}</div>
              </th>
              <th className={`${thClass} w-[7rem]`} onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">Estado {sortField === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500 shrink-0"/> : <ChevronDown size={14} className="text-emerald-500 shrink-0"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />}</div>
              </th>
              {canManage && <th className="px-2 py-2.5 w-[6.5rem] text-right uppercase tracking-wider text-[11px] font-bold">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pageAssets.map((asset) => {
              const zoneName = asset.zone?.name || '';
              const sectionName = asset.zone_section?.name || asset.section || '';
              const brandModel = [asset.brand, asset.model].filter(Boolean).join(' / ');
              return (
                <tr
                  key={asset.id}
                  onClick={() => (selectionMode ? onToggleSelect?.(asset.id) : onRowClick?.(asset))}
                  className={`transition-colors ${
                    selectionMode && selectedIds?.has(asset.id) ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : ''
                  } ${onRowClick || selectionMode ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  {selectionMode && (
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!selectedIds?.has(asset.id)}
                        onChange={() => onToggleSelect?.(asset.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                  )}
                  <td className={`${tdClass} font-mono text-xs text-slate-500 dark:text-slate-400`}>
                    <span className="block truncate" title={asset.internal_code}>{asset.internal_code}</span>
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-2 min-w-0">
                      {asset.image_url ? (
                        <img
                          src={`${BACKEND_URL}${asset.image_url}`}
                          alt={asset.name}
                          className="w-8 h-8 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700/60 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700/60 font-semibold text-[10px] shrink-0">
                          {asset.name?.substring(0, 2).toUpperCase() || 'NA'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={asset.name}>{asset.name}</div>
                        <div className="md:hidden text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {zoneName || 'Sin Zona'}
                          {sectionName && <span> · {sectionName}</span>}
                        </div>
                        {asset.description && (
                          <div className="hidden md:block text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate" title={asset.description}>
                            {asset.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={`${tdClass} text-slate-700 dark:text-slate-200 hidden md:table-cell`}>
                    <span className="block truncate" title={zoneName || 'Sin Zona'}>
                      {zoneName || <span className="text-slate-400 italic">Sin Zona</span>}
                    </span>
                  </td>
                  <td className={`${tdClass} text-slate-700 dark:text-slate-200 hidden lg:table-cell font-medium`}>
                    <span className="block truncate" title={sectionName || undefined}>
                      {sectionName || <span className="text-slate-400 italic">—</span>}
                    </span>
                  </td>
                  <td className={`${tdClass} text-slate-700 dark:text-slate-200 hidden xl:table-cell`}>
                    <span className="block truncate" title={asset.vendor?.name || undefined}>
                      {asset.vendor?.name || <span className="text-slate-400 italic">-</span>}
                    </span>
                  </td>
                  <td className={`${tdClass} text-slate-700 dark:text-slate-200 hidden xl:table-cell`}>
                    <span className="block truncate" title={brandModel || undefined}>
                      {brandModel || <span className="text-slate-400 italic">—</span>}
                    </span>
                  </td>
                  <td className={tdClass}>
                    {getStatusBadge(asset.status, true)}
                  </td>
                  {canManage && (
                    <td className={`${tdClass} text-right`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-0.5">
                        {onPrintQR && (
                          <button
                            onClick={() => onPrintQR(asset)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-950/50 rounded-lg transition-colors"
                            title="Imprimir QR"
                          >
                            <QrCode size={16} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(asset)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(asset.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {paginationControls}
    </div>
  );
};
