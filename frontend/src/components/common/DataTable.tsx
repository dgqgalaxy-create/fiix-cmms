import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Columns3, EyeOff, GripVertical, LayoutGrid, MoreVertical, Table2 } from 'lucide-react';

/**
 * Tabla reutilizable con columnas redimensionables, menú por encabezado
 * (ordenar / ocultar), selector de columnas y vista de tarjetas opcional.
 * Guarda anchos, columnas ocultas y vista en el navegador por `storageKey`.
 */

export interface DataColumn<T> {
  key: string;
  label: string;
  defaultWidth: number;
  sortKey?: string;
  align?: 'left' | 'center' | 'right';
  /** Si es false no se puede ocultar (p. ej. acciones). */
  hideable?: boolean;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  storageKey: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction?: 'asc' | 'desc') => void;
  onOpen?: (row: T) => void;
  onContextMenu?: (event: React.MouseEvent, row: T) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** Si se pasa, aparece el selector Tabla / Tarjetas. */
  renderCard?: (row: T) => ReactNode;
  defaultView?: 'table' | 'cards';
  className?: string;
}

type Saved = {
  widths?: Record<string, number>;
  hidden?: string[];
  view?: 'table' | 'cards';
};

const load = (key: string): Saved => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : {};
  } catch {
    return {};
  }
};

export function DataTable<T>({
  storageKey,
  columns,
  rows,
  rowKey,
  isLoading,
  emptyMessage = 'Sin registros.',
  sortBy,
  sortDirection,
  onSort,
  onOpen,
  onContextMenu,
  selectionMode,
  selectedIds,
  onToggleSelect,
  renderCard,
  defaultView = 'table',
  className = '',
}: Props<T>) {
  const saved = useMemo(() => load(storageKey), [storageKey]);
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const base = Object.fromEntries(columns.map((c) => [c.key, c.defaultWidth]));
    return { ...base, ...(saved.widths ?? {}) };
  });
  const [hidden, setHidden] = useState<string[]>(saved.hidden ?? []);
  const [view, setView] = useState<'table' | 'cards'>(saved.view ?? defaultView);
  const [menu, setMenu] = useState<string | 'columns' | null>(null);
  const resizing = useRef<{ key: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ widths, hidden, view }));
    } catch {
      /* preferencia opcional */
    }
  }, [storageKey, widths, hidden, view]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = resizing.current;
      if (!current) return;
      event.preventDefault();
      setWidths((prev) => ({
        ...prev,
        [current.key]: Math.max(70, current.startWidth + (event.clientX - current.startX)),
      }));
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

  const startResize = (event: React.PointerEvent, key: string) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = { key, startX: event.clientX, startWidth: widths[key] ?? 120 };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const visible = columns.filter((c) => !hidden.includes(c.key));
  const totalWidth = visible.reduce((sum, c) => sum + (widths[c.key] ?? c.defaultWidth), 0);

  const sortIcon = (column: DataColumn<T>) => {
    if (!column.sortKey) return null;
    const active = sortBy === column.sortKey;
    if (!active) return <ChevronUp size={13} className="opacity-0 transition-opacity group-hover:opacity-40" />;
    return sortDirection === 'asc'
      ? <ChevronUp size={13} className="text-emerald-600" />
      : <ChevronDown size={13} className="text-emerald-600" />;
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <div className="flex items-center justify-end gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-slate-800">
        <span className="mr-auto text-[11px] text-slate-400 dark:text-slate-500">
          Arrastra el borde de un encabezado para cambiar el ancho · ⋮ para opciones
        </span>
        {renderCard && (
          <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
              title="Vista de tabla"
              className={`px-2 py-1.5 ${view === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
            >
              <Table2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              aria-pressed={view === 'cards'}
              title="Vista de tarjetas"
              className={`px-2 py-1.5 ${view === 'cards' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-300'}`}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        )}
        <div className="relative">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setMenu(menu === 'columns' ? null : 'columns')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Columns3 size={14} /> Columnas
          </button>
          {menu === 'columns' && (
            <div
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {columns.filter((c) => c.hideable !== false).map((column) => (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={!hidden.includes(column.key)}
                    onChange={() =>
                      setHidden((prev) =>
                        prev.includes(column.key) ? prev.filter((k) => k !== column.key) : [...prev, column.key]
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
                  setWidths(Object.fromEntries(columns.map((c) => [c.key, c.defaultWidth])));
                  setMenu(null);
                }}
                className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                Restablecer columnas
              </button>
            </div>
          )}
        </div>
      </div>

      {renderCard && view === 'cards' ? (
        <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {isLoading && <p className="col-span-full py-8 text-center text-sm text-slate-500">Cargando…</p>}
          {!isLoading && rows.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-slate-500">{emptyMessage}</p>
          )}
          {!isLoading && rows.map((row) => (
            <div
              key={rowKey(row)}
              onClick={() => onOpen?.(row)}
              onContextMenu={(event) => onContextMenu?.(event, row)}
              className={`rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 ${
                onOpen ? 'cursor-pointer hover:border-emerald-300' : ''
              }`}
            >
              {renderCard(row)}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-fixed text-left text-xs leading-snug text-slate-600 dark:text-slate-300" style={{ width: totalWidth, minWidth: '100%' }}>
            <colgroup>
              {visible.map((c) => <col key={c.key} style={{ width: widths[c.key] ?? c.defaultWidth }} />)}
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold text-slate-500 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
              <tr>
                {visible.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`group relative px-2 py-1.5 ${
                      column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''
                    }`}
                  >
                    <div className={`flex items-center gap-1 ${column.align === 'center' ? 'justify-center' : column.align === 'right' ? 'justify-end' : ''}`}>
                      {column.sortKey ? (
                        <button
                          type="button"
                          onClick={() => onSort?.(column.sortKey!)}
                          className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400"
                          title={`Ordenar por ${column.label}`}
                        >
                          {column.label}
                          {sortIcon(column)}
                        </button>
                      ) : (
                        <span>{column.label}</span>
                      )}

                      {column.hideable !== false && (
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => setMenu(menu === column.key ? null : column.key)}
                          aria-label={`Opciones de ${column.label}`}
                          className="ml-auto rounded p-0.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                        >
                          <MoreVertical size={13} />
                        </button>
                      )}
                    </div>

                    {menu === column.key && (
                      <div
                        onPointerDown={(event) => event.stopPropagation()}
                        className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 text-left text-xs font-medium shadow-xl dark:border-slate-700 dark:bg-slate-900"
                      >
                        {column.sortKey && (
                          <>
                            <button
                              type="button"
                              onClick={() => { onSort?.(column.sortKey!, 'asc'); setMenu(null); }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <ChevronUp size={13} /> Ordenar ascendente
                            </button>
                            <button
                              type="button"
                              onClick={() => { onSort?.(column.sortKey!, 'desc'); setMenu(null); }}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <ChevronDown size={13} /> Ordenar descendente
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => { setHidden((prev) => [...prev, column.key]); setMenu(null); }}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <EyeOff size={13} /> Ocultar columna
                        </button>
                      </div>
                    )}

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
                  <td colSpan={visible.length} className="px-6 py-8 text-center text-slate-500">Cargando…</td>
                </tr>
              )}
              {!isLoading && rows.map((row) => {
                const id = rowKey(row);
                const selected = selectionMode && selectedIds?.has(id);
                return (
                  <tr
                    key={id}
                    className={`transition-colors ${onOpen || selectionMode ? 'cursor-pointer' : ''} ${
                      selected ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    }`}
                    onClick={() => (selectionMode ? onToggleSelect?.(id) : onOpen?.(row))}
                    onContextMenu={(event) => onContextMenu?.(event, row)}
                  >
                    {visible.map((column) => (
                      <td
                        key={column.key}
                        className={`px-2 py-1.5 ${
                          column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : ''
                        }`}
                      >
                        {selectionMode && column === visible[0] && (
                          <input
                            type="checkbox"
                            checked={Boolean(selected)}
                            onChange={() => onToggleSelect?.(id)}
                            onClick={(event) => event.stopPropagation()}
                            className="mr-2 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        )}
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={visible.length} className="px-6 py-8 text-center text-slate-500">{emptyMessage}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
