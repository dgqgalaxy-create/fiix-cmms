import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Asset } from '../api/assets';
import { Activity, Ban, Settings, Trash2, Edit, Database, QrCode, Image as ImageIcon, ChevronUp, ChevronDown, Archive, Package, ArrowLeft, ArrowRight, RotateCcw, Columns3 } from 'lucide-react';
import { mediaUrl } from '../utils/mediaUrl';
import { ContextMenu } from './common/ContextMenu';
import type { ContextMenuAction } from './common/ContextMenu';
import { formatCurrency } from '../utils/currency';

const ITEMS_PER_PAGE = 20;

type ColumnKey =
  | 'internal_code'
  | 'name'
  | 'serial_number'
  | 'description'
  | 'zone'
  | 'section'
  | 'vendor'
  | 'brand'
  | 'model'
  | 'kind'
  | 'status'
  | 'critical'
  | 'obsolete'
  | 'price'
  | 'parts_count'
  | 'parts_cost'
  | 'wos_total'
  | 'wos_open'
  | 'stoppages'
  | 'last_wo'
  | 'pms_active'
  | 'next_pm';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  width: string;
  /** Breakpoint mínimo en que se muestra en el modo predeterminado (sin personalizar). */
  responsive?: 'md' | 'lg' | 'xl';
  defaultVisible?: boolean;
  /** Columna de identidad: no se puede ocultar. */
  fixed?: boolean;
  align?: 'left' | 'center' | 'right';
  sortValue: (a: Asset) => string | number | null;
  render: (a: Asset) => ReactNode;
}

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString('es-MX') : '—');

const partsCost = (a: Asset) =>
  (a.parts ?? []).reduce((sum, p) => sum + (p.quantity ?? 0) * (p.item?.purchase_cost ?? 0), 0);

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

const COLUMNS: ColumnDef[] = [
  {
    key: 'internal_code',
    label: 'Código',
    width: 'w-[9.5rem]',
    defaultVisible: true,
    sortValue: (a) => a.internal_code,
    render: (a) => (
      <span className="font-mono text-xs text-slate-500 dark:text-slate-400 block truncate" title={a.internal_code}>
        {a.internal_code}
      </span>
    ),
  },
  {
    key: 'name',
    label: 'Equipo',
    width: 'w-auto',
    defaultVisible: true,
    fixed: true,
    sortValue: (a) => a.name,
    render: (a) => (
      <div className="flex items-center gap-2 min-w-0">
        {a.image_url ? (
          <img
            src={mediaUrl(a.image_url)}
            alt={a.name}
            className="w-8 h-8 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700/60 shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm border border-slate-200 dark:border-slate-700/60 font-semibold text-[10px] shrink-0">
            {a.name?.substring(0, 2).toUpperCase() || 'NA'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-slate-900 dark:text-slate-100 truncate" title={a.name}>
              {a.name}
            </span>
            {a.is_critical && (
              <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Crítico</span>
            )}
            {a.is_obsolete && (
              <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Obsoleto</span>
            )}
          </div>
          <div className="md:hidden text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {a.zone?.name || 'Sin Zona'}
            {(a.zone_section?.name || a.section) && <span> · {a.zone_section?.name || a.section}</span>}
          </div>
          {a.description && (
            <div className="hidden md:block text-slate-500 dark:text-slate-400 text-xs mt-0.5 truncate" title={a.description}>
              {a.description}
            </div>
          )}
        </div>
      </div>
    ),
  },
  {
    key: 'serial_number',
    label: 'N° serie',
    width: 'w-[9rem]',
    align: 'left',
    sortValue: (a) => a.serial_number ?? '',
    render: (a) => (
      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 block truncate" title={a.serial_number || undefined}>
        {a.serial_number || <span className="text-slate-400 italic">—</span>}
      </span>
    ),
  },
  {
    key: 'description',
    label: 'Descripción',
    width: 'w-[14rem]',
    sortValue: (a) => a.description ?? '',
    render: (a) => (
      <span className="text-xs block truncate" title={a.description || undefined}>
        {a.description || <span className="text-slate-400 italic">—</span>}
      </span>
    ),
  },
  {
    key: 'zone',
    label: 'Zona',
    width: 'w-[6.5rem]',
    responsive: 'md',
    defaultVisible: true,
    sortValue: (a) => a.zone?.name ?? '',
    render: (a) => (
      <span className="block truncate" title={a.zone?.name || 'Sin Zona'}>
        {a.zone?.name || <span className="text-slate-400 italic">Sin Zona</span>}
      </span>
    ),
  },
  {
    key: 'section',
    label: 'Sec.',
    width: 'w-[4.5rem]',
    responsive: 'lg',
    defaultVisible: true,
    align: 'center',
    sortValue: (a) => a.zone_section?.name || a.section || '',
    render: (a) => (
      <span className="block truncate font-medium" title={a.zone_section?.name || a.section || undefined}>
        {a.zone_section?.name || a.section || <span className="text-slate-400 italic">—</span>}
      </span>
    ),
  },
  {
    key: 'vendor',
    label: 'Proveedor',
    width: 'w-[7rem]',
    responsive: 'xl',
    defaultVisible: true,
    sortValue: (a) => a.vendor?.name ?? '',
    render: (a) => (
      <span className="block truncate" title={a.vendor?.name || undefined}>
        {a.vendor?.name || <span className="text-slate-400 italic">-</span>}
      </span>
    ),
  },
  {
    key: 'brand',
    label: 'Marca',
    width: 'w-[7.5rem]',
    responsive: 'xl',
    defaultVisible: true,
    sortValue: (a) => a.brand || '',
    render: (a) => <span className="block truncate">{a.brand || <span className="text-slate-400 italic">—</span>}</span>,
  },
  {
    key: 'model',
    label: 'Modelo',
    width: 'w-[8rem]',
    sortValue: (a) => a.model || '',
    render: (a) => <span className="block truncate">{a.model || <span className="text-slate-400 italic">—</span>}</span>,
  },
  {
    key: 'kind',
    label: 'Tipo',
    width: 'w-[6rem]',
    align: 'center',
    sortValue: (a) => (a.asset_kind === 'FIJO' ? 'Fijo' : 'Controlable'),
    render: (a) => (
      <span className="inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
        {a.asset_kind === 'FIJO' ? 'Fijo' : 'Controlable'}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Estado',
    width: 'w-[7rem]',
    defaultVisible: true,
    sortValue: (a) => a.status,
    render: (a) => getStatusBadge(a.status, true),
  },
  {
    key: 'critical',
    label: 'Crítico',
    width: 'w-[4.5rem]',
    align: 'center',
    sortValue: (a) => (a.is_critical ? 1 : 0),
    render: (a) =>
      a.is_critical ? (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-bold text-xs">!</span>
      ) : (
        <span className="text-slate-300 dark:text-slate-600">—</span>
      ),
  },
  {
    key: 'obsolete',
    label: 'Obsoleto',
    width: 'w-[4.5rem]',
    align: 'center',
    sortValue: (a) => (a.is_obsolete ? 1 : 0),
    render: (a) =>
      a.is_obsolete ? (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 font-bold text-xs">O</span>
      ) : (
        <span className="text-slate-300 dark:text-slate-600">—</span>
      ),
  },
  {
    key: 'price',
    label: 'Precio',
    width: 'w-[7rem]',
    align: 'right',
    sortValue: (a) => a.price ?? 0,
    render: (a) => (
      <span className="tabular-nums">{a.price != null ? formatCurrency(a.price) : <span className="text-slate-400 italic">—</span>}</span>
    ),
  },
  {
    key: 'parts_count',
    label: 'Refacciones',
    width: 'w-[6.5rem]',
    responsive: 'lg',
    defaultVisible: true,
    align: 'center',
    sortValue: (a) => a.parts?.length ?? 0,
    render: (a) => (
      <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-medium tabular-nums">
        <Package size={14} className="text-slate-400" />
        {a.parts?.length ?? 0}
      </span>
    ),
  },
  {
    key: 'parts_cost',
    label: 'Costo refacc.',
    width: 'w-[7.5rem]',
    align: 'right',
    sortValue: (a) => partsCost(a),
    render: (a) => <span className="tabular-nums">{partsCost(a) > 0 ? formatCurrency(partsCost(a)) : <span className="text-slate-400 italic">—</span>}</span>,
  },
  {
    key: 'wos_total',
    label: 'OTs totales',
    width: 'w-[5.5rem]',
    align: 'center',
    sortValue: (a) => a.stats?.totalWos ?? 0,
    render: (a) => <span className="tabular-nums">{a.stats?.totalWos ?? 0}</span>,
  },
  {
    key: 'wos_open',
    label: 'OTs abiertas',
    width: 'w-[5.5rem]',
    align: 'center',
    sortValue: (a) => a.stats?.openWos ?? 0,
    render: (a) => (
      <span className={`tabular-nums ${(a.stats?.openWos ?? 0) > 0 ? 'font-bold text-amber-600 dark:text-amber-400' : ''}`}>
        {a.stats?.openWos ?? 0}
      </span>
    ),
  },
  {
    key: 'stoppages',
    label: 'Paros',
    width: 'w-[4.5rem]',
    align: 'center',
    sortValue: (a) => a.stats?.stoppages ?? 0,
    render: (a) => (
      <span className={`tabular-nums ${(a.stats?.stoppages ?? 0) > 0 ? 'font-bold text-rose-600 dark:text-rose-400' : ''}`}>
        {a.stats?.stoppages ?? 0}
      </span>
    ),
  },
  {
    key: 'last_wo',
    label: 'Última OT',
    width: 'w-[7rem]',
    align: 'center',
    sortValue: (a) => a.stats?.lastWoAt ?? '',
    render: (a) => <span className="text-xs">{fmtDate(a.stats?.lastWoAt)}</span>,
  },
  {
    key: 'pms_active',
    label: 'Planes MP',
    width: 'w-[5.5rem]',
    align: 'center',
    sortValue: (a) => a.stats?.activePms ?? 0,
    render: (a) => <span className="tabular-nums">{a.stats?.activePms ?? 0}</span>,
  },
  {
    key: 'next_pm',
    label: 'Próximo MP',
    width: 'w-[7rem]',
    align: 'center',
    sortValue: (a) => a.stats?.nextPmDue ?? '',
    render: (a) => {
      const due = a.stats?.nextPmDue ? new Date(a.stats.nextPmDue) : null;
      const overdue = due && due.getTime() < Date.now();
      return (
        <span className={`text-xs ${overdue ? 'font-bold text-rose-600 dark:text-rose-400' : ''}`}>
          {due ? due.toLocaleDateString('es-MX') : <span className="text-slate-400 italic">—</span>}
        </span>
      );
    },
  },
];

const COLUMN_BY_KEY = new Map(COLUMNS.map((c) => [c.key, c]));

/** Orden/visibilidad predeterminados (igual al diseño original de la tabla). */
const DEFAULT_ORDER: ColumnKey[] = COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);

type SortDirection = 'asc' | 'desc';

interface Props {
  assets: Asset[];
  /** Cambia al filtrar/buscar para volver a la página 1 */
  filterKey?: string;
  /** Si se pasa, la paginación es del servidor (no se hace slice local). */
  serverTotal?: number;
  serverPage?: number;
  serverTotalPages?: number;
  onServerPageChange?: (page: number) => void;
  onDelete: (id: string) => void;
  onEdit?: (asset: Asset) => void;
  onRowClick?: (asset: Asset) => void;
  onPrintQR?: (asset: Asset) => void;
  onToggleObsolete?: (asset: Asset) => void;
  canManage: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Clave de localStorage para la personalización de columnas (por usuario). */
  columnsStorageKey: string;
}

export const AssetsTable = ({
  assets,
  filterKey = '',
  serverTotal,
  serverPage,
  serverTotalPages,
  onServerPageChange,
  onDelete,
  onEdit,
  onRowClick,
  onPrintQR,
  onToggleObsolete,
  canManage,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  columnsStorageKey,
}: Props) => {
  const [sortField, setSortField] = useState<ColumnKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; asset: Asset } | null>(null);
  const [columnMenu, setColumnMenu] = useState<{ x: number; y: number; column: ColumnKey | null } | null>(null);
  /** null = usar diseño predeterminado (responsive); array = columnas personalizadas por el usuario. */
  const [visibleKeys, setVisibleKeys] = useState<ColumnKey[] | null>(null);
  const serverMode = typeof serverTotal === 'number' && typeof onServerPageChange === 'function';

  // Cargar personalización del usuario.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(columnsStorageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const known = parsed.filter((k): k is ColumnKey => COLUMN_BY_KEY.has(k as ColumnKey));
      if (known.length > 0) {
        // Equipo siempre presente (identidad de la fila).
        setVisibleKeys([...new Set<ColumnKey>(['name', ...known])]);
      }
    } catch {
      /* configuración corrupta → se ignora */
    }
  }, [columnsStorageKey]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterKey]);

  const isCustom = visibleKeys !== null;
  const effectiveVisible: ColumnKey[] = isCustom ? (visibleKeys as ColumnKey[]) : DEFAULT_ORDER;
  const visibleCols = effectiveVisible.map((k) => COLUMN_BY_KEY.get(k)!).filter(Boolean);

  const persistColumns = (next: ColumnKey[] | null) => {
    setVisibleKeys(next);
    try {
      if (next === null) localStorage.removeItem(columnsStorageKey);
      else localStorage.setItem(columnsStorageKey, JSON.stringify(next));
    } catch {
      /* quota / modo privado */
    }
  };

  const toggleColumn = (key: ColumnKey) => {
    const current = effectiveVisible;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    persistColumns(next);
  };

  const moveColumn = (key: ColumnKey, dir: -1 | 1) => {
    const current = [...effectiveVisible];
    const idx = current.indexOf(key);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= current.length) return;
    [current[idx], current[target]] = [current[target], current[idx]];
    persistColumns(current);
  };

  const handleSort = (field: ColumnKey) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAssets = useMemo(() => {
    const list = [...assets];
    if (!sortField) return list;
    const def = COLUMN_BY_KEY.get(sortField);
    if (!def) return list;
    list.sort((a, b) => {
      const va = def.sortValue(a);
      const vb = def.sortValue(b);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [assets, sortField, sortDirection]);

  const totalPages = serverMode
    ? Math.max(1, serverTotalPages || 1)
    : Math.ceil(sortedAssets.length / ITEMS_PER_PAGE) || 1;
  const safePage = serverMode
    ? Math.min(Math.max(1, serverPage || 1), totalPages)
    : Math.min(currentPage, totalPages);
  const pageAssets = serverMode
    ? sortedAssets
    : sortedAssets.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const resultTotal = serverMode ? serverTotal! : sortedAssets.length;
  const setPage = (page: number) => {
    if (serverMode) onServerPageChange!(page);
    else setCurrentPage(page);
  };

  useEffect(() => {
    if (!serverMode && currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, serverMode]);

  // Menú de personalización (clic derecho en encabezado, o botón ⚙).
  const columnMenuActions: ContextMenuAction[] = [
    ...COLUMNS.map((col) => ({
      key: `col-${col.key}`,
      label: col.label,
      checked: effectiveVisible.includes(col.key),
      disabled: col.fixed,
      onClick: () => toggleColumn(col.key),
    })),
    ...(columnMenu?.column
      ? [
          {
            key: 'sep-move',
            label: '',
            separator: true,
            checked: undefined,
            onClick: () => {},
          },
          {
            key: 'move-left',
            label: 'Mover a la izquierda',
            icon: <ArrowLeft size={15} />,
            disabled: effectiveVisible.indexOf(columnMenu.column) <= 0,
            onClick: () => moveColumn(columnMenu.column!, -1),
          },
          {
            key: 'move-right',
            label: 'Mover a la derecha',
            icon: <ArrowRight size={15} />,
            disabled: effectiveVisible.indexOf(columnMenu.column) >= effectiveVisible.length - 1,
            onClick: () => moveColumn(columnMenu.column!, 1),
          },
        ]
      : []),
    { key: 'sep-reset', label: '', separator: true, onClick: () => {} },
    {
      key: 'reset',
      label: 'Restaurar predeterminadas',
      icon: <RotateCcw size={15} />,
      onClick: () => persistColumns(null),
    },
  ];

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

  const responsiveClass = (col: ColumnDef) =>
    !isCustom && col.responsive ? `hidden ${col.responsive}:table-cell` : '';
  const alignClass = (col: ColumnDef) =>
    col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left';

  const paginationControls = resultTotal > ITEMS_PER_PAGE && (
    <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 sm:px-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-4">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          type="button"
          onClick={() => setPage(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="relative inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={() => setPage(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
          className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Mostrando <span className="font-medium">{resultTotal === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}</span> a{' '}
          <span className="font-medium">{Math.min(safePage * ITEMS_PER_PAGE, resultTotal)}</span> de{' '}
          <span className="font-medium">{resultTotal}</span> resultados
        </p>
        <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm" aria-label="Pagination">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, safePage - 1))}
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
                  onClick={() => setPage(i + 1)}
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
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
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
            onContextMenu={(e) => { if (canManage) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, asset }); } }}
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
                  src={mediaUrl(asset.image_url)}
                  alt={asset.name}
                  className="w-9 h-9 rounded-lg object-cover bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700/60"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-200 dark:border-slate-700/60 font-semibold text-[10px]">
                  {asset.name?.substring(0, 2).toUpperCase() || <ImageIcon size={14} />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-snug flex items-center gap-1.5" title={asset.name}>
                  <span className="truncate">{asset.name}</span>
                  {asset.is_critical && (
                    <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Crítico</span>
                  )}
                  {asset.is_obsolete && (
                    <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Obsoleto</span>
                  )}
                </h3>
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
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={`${thClass} ${col.width} ${responsiveClass(col)} ${alignClass(col)}`}
                  onClick={() => handleSort(col.key)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setColumnMenu({ x: e.clientX, y: e.clientY, column: col.key });
                  }}
                  title={`Clic: ordenar · Clic derecho: personalizar (${col.label})`}
                >
                  <div className={`flex items-center gap-1 ${col.align === 'center' ? 'justify-center' : ''}`}>
                    {col.label}
                    {sortField === col.key ? (
                      sortDirection === 'asc' ? (
                        <ChevronUp size={14} className="text-emerald-500 shrink-0" />
                      ) : (
                        <ChevronDown size={14} className="text-emerald-500 shrink-0" />
                      )
                    ) : (
                      <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                    )}
                  </div>
                </th>
              ))}
              <th className="px-2 py-2.5 w-10 hidden lg:table-cell">
                <button
                  type="button"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setColumnMenu({ x: rect.right - 220, y: rect.bottom + 4, column: null });
                  }}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                  title="Personalizar columnas"
                  aria-label="Personalizar columnas"
                >
                  <Columns3 size={15} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pageAssets.map((asset) => (
              <tr
                key={asset.id}
                onClick={() => (selectionMode ? onToggleSelect?.(asset.id) : onRowClick?.(asset))}
                onContextMenu={(e) => { if (canManage) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, asset }); } }}
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
                {visibleCols.map((col) => (
                  <td key={col.key} className={`${tdClass} ${responsiveClass(col)} ${alignClass(col)}`}>
                    {col.render(asset)}
                  </td>
                ))}
                <td className={`${tdClass} hidden lg:table-cell w-10`} onClick={(e) => e.stopPropagation()} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginationControls}

      {columnMenu && (
        <ContextMenu
          x={columnMenu.x}
          y={columnMenu.y}
          title="Personalizar columnas"
          actions={columnMenuActions}
          onClose={() => setColumnMenu(null)}
          zIndex={90}
        />
      )}

      {ctxMenu && canManage && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          title={ctxMenu.asset.name}
          onClose={() => setCtxMenu(null)}
          actions={[
            ...(onEdit ? [{ key: 'edit', label: 'Editar', icon: <Edit size={15} />, onClick: () => onEdit(ctxMenu.asset) }] : []),
            ...(onToggleObsolete ? [{ key: 'obsolete', label: ctxMenu.asset.is_obsolete ? 'Quitar obsoleto' : 'Marcar como obsoleto', icon: <Archive size={15} />, onClick: () => onToggleObsolete(ctxMenu.asset) }] : []),
            ...(onPrintQR ? [{ key: 'qr', label: 'Imprimir QR', icon: <QrCode size={15} />, onClick: () => onPrintQR(ctxMenu.asset) }] : []),
            { key: 'delete', label: 'Eliminar', icon: <Trash2 size={15} />, danger: true, onClick: () => onDelete(ctxMenu.asset.id) },
          ]}
        />
      )}
    </div>
  );
};
