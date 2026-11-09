import { useMemo, useState } from 'react';
import { Edit2, Trash2, Building2, Mail } from 'lucide-react';
import type { Requester } from '../api/requesters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ContextMenu } from './common/ContextMenu';
import { DataTable } from './common/DataTable';

interface Props {
  requesters: Requester[];
  emptyMessage?: string;
  onEdit: (requester: Requester) => void;
  onDelete: (id: string) => void;
}

type SortField = 'name' | 'email' | 'department' | 'date';

export const RequestersTable = ({ requesters, onEdit, onDelete, emptyMessage = 'No hay solicitantes registrados.' }: Props) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; requester: Requester } | null>(null);

  const sortedRequesters = useMemo(() => {
    return [...requesters].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'email': cmp = (a.email || '').localeCompare(b.email || ''); break;
        case 'department': cmp = (a.department || '').localeCompare(b.department || ''); break;
        case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [requesters, sortField, sortDirection]);

  const handleDelete = (requester: Requester) => {
    if (window.confirm(`¿Estás seguro de eliminar a ${requester.name}?`)) onDelete(requester.id);
  };

  return (
    <>
      <DataTable
        storageKey="fiix-personal-requesters"
        rows={sortedRequesters}
        rowKey={(requester) => requester.id}
        sortBy={sortField}
        sortDirection={sortDirection}
        onSort={(key, direction) => {
          const field = key as SortField;
          if (direction) {
            setSortField(field);
            setSortDirection(direction);
            return;
          }
          setSortField(field);
          setSortDirection(sortField === field && sortDirection === 'asc' ? 'desc' : 'asc');
        }}
        onOpen={onEdit}
        onContextMenu={(event, requester) => {
          event.preventDefault();
          setCtxMenu({ x: event.clientX, y: event.clientY, requester });
        }}
        columns={[
          {
            key: 'name',
            label: 'Nombre',
            defaultWidth: 280,
            sortKey: 'name',
            render: (requester) => (
              <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{requester.name}</span>
            ),
          },
          {
            key: 'email',
            label: 'Correo electrónico',
            defaultWidth: 260,
            sortKey: 'email',
            render: (requester) => (
              <span className="truncate text-slate-600 dark:text-slate-300">{requester.email || '—'}</span>
            ),
          },
          {
            key: 'department',
            label: 'Departamento',
            defaultWidth: 200,
            sortKey: 'department',
            render: (requester) => (
              <span className="truncate text-slate-600 dark:text-slate-300">{requester.department || '—'}</span>
            ),
          },
          {
            key: 'date',
            label: 'Fecha de registro',
            defaultWidth: 170,
            sortKey: 'date',
            render: (requester) => (
              <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                {format(new Date(requester.created_at), "d 'de' MMMM, yyyy", { locale: es })}
              </span>
            ),
          },
          {
            key: 'actions',
            label: 'Acciones',
            defaultWidth: 90,
            align: 'right',
            hideable: false,
            render: (requester) => (
              <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onEdit(requester)}
                  className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                  title="Editar"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(requester)}
                  className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800"
                  title="Eliminar"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ),
          },
        ]}
        renderCard={(requester) => (
          <div className="flex flex-col gap-1.5">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{requester.name}</p>
            <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              {requester.email && (
                <p className="flex items-center gap-1.5 truncate"><Mail size={11} className="shrink-0" /> {requester.email}</p>
              )}
              {requester.department && (
                <p className="flex items-center gap-1.5 truncate"><Building2 size={11} className="shrink-0" /> {requester.department}</p>
              )}
            </div>
            <div className="flex justify-end gap-1 border-t border-slate-100 pt-2 dark:border-slate-800" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => onEdit(requester)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(requester)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-slate-800"
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
        emptyMessage={emptyMessage}
      />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          title={ctxMenu.requester.name}
          onClose={() => setCtxMenu(null)}
          actions={[
            { key: 'edit', label: 'Editar', icon: <Edit2 size={15} />, onClick: () => onEdit(ctxMenu.requester) },
            { key: 'delete', label: 'Eliminar', icon: <Trash2 size={15} />, danger: true, onClick: () => handleDelete(ctxMenu.requester) },
          ]}
        />
      )}
    </>
  );
};
