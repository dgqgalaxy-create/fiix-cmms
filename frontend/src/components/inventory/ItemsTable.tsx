import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronUp, ChevronDown, MoreVertical, EyeOff, Columns3, GripVertical, ArrowRightLeft, QrCode, Edit2, Package, MapPin,
} from 'lucide-react';
import type { Item } from '../../api/inventory';
import { mediaUrl } from '../../utils/mediaUrl';

/**
 * Tabla de repuestos con columnas redimensionables (arrastrando el borde),
 * menú por encabezado (ordenar / ocultar) y selector de columnas visibles.
 * Las preferencias se guardan en el navegador.
 */

const STORAGE_KEY = 'fiix-inventory-table-v1';

type ColumnKey = 'code' | 'name' | 'stock' | 'where' | 'actions';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  defaultWidth: number;
  sortKey?: 'code' | 'name' | 'stock' | 'category';
  align?: 'left' | 'center' | 'right';
}

const COLUMNS: ColumnDef[] = [
  { key: 'code', label: 'Código', defaultWidth: 110, sortKey: 'code' },
  { key: 'name', label: 'Repuesto', defaultWidth: 340, sortKey: 'name' },
  { key: 'stock', label: 'Stock', defaultWidth: 110, sortKey: 'stock', align: 'center' },
  { key: 'where', label: 'Categoría / Ubicación', defaultWidth: 180, sortKey: 'category' },
  { key: 'actions', label: 'Acciones', defaultWidth: 120, align: 'right' },
];

type SavedState = { widths?: Partial<Record<ColumnKey, number>>; hidden?: ColumnKey[] };

const loadSaved = (): SavedState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

interface Props {
  items: Item[];
  isLoading: boolean;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSort: (key: 'code' | 'name' | 'stock' | 'category', direction?: 'asc' | 'desc') => void;
  onOpen: (item: Item) => void;
  onTransaction: (itemId: string) => void;
  onQr: (item: Item) => void;
  onEdit: (item: Item) => void;
  onContextMenu?: (event: React.MouseEvent, item: Item) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  canManage: boolean;
  emptyMessage?: string;
}

export const ItemsTable = ({
  items,
  isLoading,
  sortBy,
  sortDirection,
  onSort,
  onOpen,
  onTransaction,
  onQr,
  onEdit,
  onContextMenu,
  selectionMode,
  selectedIds,
  onToggleSelect,
  canManage,
  emptyMessage = 'No se encontraron repuestos.',
}: Props) => {
  const saved = useMemo(loadSaved, []);
  const [widths, setWidths] = useState<Record<ColumnKey, number>>(() => {
    const base = Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColumnKey, number>;
    return { ...base, ...(saved.widths ?? {}) };
  });
  const [hidden, setHidden] = useState<ColumnKey[]>(saved.hidden ?? []);
  const [openMenu, setOpenMenu] = useState<ColumnKey | 'columns' | null>(null);
  const resizing = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);

  // Persistencia de preferencias
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ widths, hidden }));
    } catch {
      /* preferencia opcional */
    }
  }, [widths, hidden]);

  // Cierre de menús al hacer clic fuera
  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [openMenu]);

  // Arrastre para redimensionar
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = resizing.current;
      if (!current) return;
      event.preventDefault();
      const next = Math.max(70, current.startWidth + (event.clientX - current.startX));
      setWidths((prev) => ({ ...prev, [current.key]: next }));
    };
    const onUp = () => {
      if (!resizing.current) return;
      resizing.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const startResize = (event: React.PointerEvent, key: ColumnKey) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = { key, startX: event.clientX, startWidth: widths[key] };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const visible = COLUMNS.filter((c) => !hidden.includes(c.key));
  const totalWidth = visible.reduce((sum, c) => sum + widths[c.key], 0);

  const sortIcon = (col: ColumnDef) => {
    if (!col.sortKey) return null;
    const active = sortBy === col.sortKey;
    if (!active) return <ChevronUp size={13} className="opacity-0 transition-opacity group-hover:opacity-40" />;
    return sortDirection === 'asc'
      ? <ChevronUp size={13} className="text-emerald-600" />
      : <ChevronDown size={13} className="text-emerald-600" />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 dark:bg-slate-900">
      {/* Barra de columnas */}
      <div className="flex items-center justify-end gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-slate-800">
        <span className="mr-auto text-[11px] text-slate-400 dark:text-slate-500">
          Arrastra el borde de un encabezado para cambiar el ancho · ⋮ para opciones
        </span>
        <div className="relative">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpenMenu(openMenu === 'columns' ? null : 'columns')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Columns3 size={14} /> Columnas
          </button>
          {openMenu === 'columns' && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {COLUMNS.filter((c) => c.key !== 'actions').map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={!hidden.includes(column.key)}
                    onChange={() =>
                      setHidden((prev) =>
                        prev.includes(column.key)
                          ? prev.filter((k) => k !== column.key)
                          : [...prev, column.key]
                      )
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  {column.label}
                </label>
              ))}
              <button
                type="button"
                onClick={() => {
                  setHidden([]);
                  setWidths(Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth])) as Record<ColumnKey, number>);
                  setOpenMenu(null);
                }}
                className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                Restablecer columnas
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table-fixed text-left text-xs leading-snug text-slate-600 dark:text-slate-300" style={{ width: totalWidth, minWidth: '100%' }}>
          <colgroup>
            {visible.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}
          </colgroup>
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold text-slate-500 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
            <tr>
              {visible.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`group relative px-2 py-1.5 ${column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''}`}
                >
                  <div className={`flex items-center gap-1 ${column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : ''}`}>
                    {column.sortKey && (
                      <button
                        type="button"
                        onClick={() => onSort(column.sortKey!)}
                        className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title={`Ordenar por ${column.label}`}
                      >
                        {column.label}
                        {sortIcon(column)}
                      </button>
                    )}
                    {!column.sortKey && <span>{column.label}</span>}

                    {column.key !== 'actions' && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setOpenMenu(openMenu === column.key ? null : column.key)}
                        aria-label={`Opciones de ${column.label}`}
                        className="ml-auto rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                      >
                        <MoreVertical size={13} />
                      </button>
                    )}
                  </div>

                  {openMenu === column.key && (
                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left text-xs font-medium shadow-xl dark:border-slate-700 dark:bg-slate-900"
                    >
                      {column.sortKey && (
                        <>
                          <button
                            type="button"
                            onClick={() => { onSort(column.sortKey!, 'asc'); setOpenMenu(null); }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <ChevronUp size={13} /> Ordenar {sortBy === column.sortKey && sortDirection === 'asc' ? 'descendente' : 'ascendente'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { onSort(column.sortKey!, 'desc'); setOpenMenu(null); }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <ChevronDown size={13} /> Ordenar descendente
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => { setHidden((prev) => [...prev, column.key]); setOpenMenu(null); }}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <EyeOff size={13} /> Ocultar columna
                      </button>
                    </div>
                  )}

                  {/* Handle de redimensionado */}
                  <span
                    onPointerDown={(event) => startResize(event, column.key)}
                    className="absolute right-0 top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center hover:bg-emerald-200/60 dark:hover:bg-emerald-800/40"
                    aria-hidden
                  >
                    <GripVertical size={10} className="text-slate-300 opacity-0 group-hover:opacity-100 dark:text-slate-600" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={visible.length} className="px-6 py-8 text-center text-slate-500">
                  Cargando repuestos…
                </td>
              </tr>
            )}
            {!isLoading && items.map((item) => (
              <tr
                key={item.id}
                className={`cursor-pointer transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${selectionMode && selectedIds.has(item.id) ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}`}
                onClick={() => (selectionMode ? onToggleSelect(item.id) : onOpen(item))}
                onContextMenu={(event) => onContextMenu?.(event, item)}
              >
                {visible.map((column) => {
                  if (column.key === 'code') {
                    return (
                      <td key="code" className="px-2 py-1.5 font-mono text-[10px] font-medium text-slate-500 [overflow-wrap:anywhere]">
                        <div className="flex items-center gap-2">
                          {selectionMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.has(item.id)}
                              onChange={() => onToggleSelect(item.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                          )}
                          {item.internal_code}
                        </div>
                      </td>
                    );
                  }
                  if (column.key === 'name') {
                    return (
                      <td key="name" className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="shrink-0">
                            {item.image_url ? (
                              <img src={mediaUrl(item.image_url)} alt={item.name} className="h-7 w-7 rounded border border-slate-200 object-cover" />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-100 text-slate-400 dark:bg-slate-800">
                                <Package size={16} />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-slate-900 dark:text-slate-100" title={item.name}>{item.name}</div>
                            <div className="flex flex-wrap items-center gap-1">
                              {!item.is_active && (
                                <span className="inline-flex shrink-0 items-center rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">Descontinuado</span>
                              )}
                              {!item.vendor_id && item.stock <= item.minimum_inventory && (
                                <span className="inline-flex shrink-0 items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Sin proveedor</span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-slate-500" title={item.description || undefined}>{item.description}</div>
                          </div>
                        </div>
                      </td>
                    );
                  }
                  if (column.key === 'stock') {
                    return (
                      <td key="stock" className="px-2 py-1.5 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 dark:border-slate-700 dark:bg-slate-800">
                          <span className={`text-sm font-bold ${item.stock <= item.minimum_inventory ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {item.stock}
                          </span>
                          <span className="text-xs font-medium text-slate-400">{item.uom}</span>
                        </div>
                      </td>
                    );
                  }
                  if (column.key === 'where') {
                    return (
                      <td key="where" className="px-2 py-1.5">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="inline-flex w-fit max-w-full items-center rounded border border-blue-100 bg-blue-50 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                            <span className="truncate" title={item.category?.name || 'Sin Cat.'}>{item.category?.name || 'Sin Cat.'}</span>
                          </span>
                          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate" title={item.location?.name || 'N/A'}>{item.location?.name || 'N/A'}</span>
                          </span>
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key="actions" className="whitespace-nowrap px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onTransaction(item.id)}
                          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-transparent p-1.5 text-slate-400 transition-colors hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-600"
                          title="Realizar movimiento"
                        >
                          <ArrowRightLeft size={15} />
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => onQr(item)}
                              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-transparent p-1.5 text-slate-400 transition-colors hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
                              title="Imprimir QR"
                            >
                              <QrCode size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-transparent p-1.5 text-slate-400 transition-colors hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
                              title="Editar"
                            >
                              <Edit2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={visible.length} className="px-6 py-8 text-center text-slate-500">{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
