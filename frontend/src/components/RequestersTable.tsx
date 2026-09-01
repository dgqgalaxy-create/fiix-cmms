import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { Requester } from '../api/requesters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ContextMenu } from './common/ContextMenu';

interface Props {
  requesters: Requester[];
  onEdit: (requester: Requester) => void;
  onDelete: (id: string) => void;
}

export const RequestersTable = ({ requesters, onEdit, onDelete }: Props) => {
  const [sortField, setSortField] = useState<'name' | 'email' | 'department' | 'date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; requester: Requester } | null>(null);

  const sortedRequesters = useMemo(() => {
    return [...requesters].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '');
          break;
        case 'department':
          cmp = (a.department || '').localeCompare(b.department || '');
          break;
        case 'date':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [requesters, sortField, sortDirection]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
            <tr>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => { setSortField('name'); setSortDirection(sortField === 'name' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                <div className="flex items-center gap-1.5">Nombre {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => { setSortField('email'); setSortDirection(sortField === 'email' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                <div className="flex items-center gap-1.5">Correo Electrónico {sortField === 'email' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => { setSortField('department'); setSortDirection(sortField === 'department' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                <div className="flex items-center gap-1.5">Departamento {sortField === 'department' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
              </th>
              <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800/60 hover:text-emerald-600 dark:text-emerald-400 transition-colors group" onClick={() => { setSortField('date'); setSortDirection(sortField === 'date' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                <div className="flex items-center gap-1.5">Fecha de Registro {sortField === 'date' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
              </th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requesters.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                  No hay solicitantes registrados.
                </td>
              </tr>
            ) : (
              sortedRequesters.map((requester) => (
                <tr key={requester.id} onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, requester }); }} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{requester.name}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-600 dark:text-slate-400">{requester.email || '-'}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-600 dark:text-slate-400">{requester.department || '-'}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-500 dark:text-slate-400 text-sm">
                      {format(new Date(requester.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(requester)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`¿Estás seguro de eliminar a ${requester.name}?`)) {
                            onDelete(requester.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          title={ctxMenu.requester.name}
          onClose={() => setCtxMenu(null)}
          actions={[
            { key: 'edit', label: 'Editar', icon: <Edit2 size={15} />, onClick: () => onEdit(ctxMenu.requester) },
            { key: 'delete', label: 'Eliminar', icon: <Trash2 size={15} />, danger: true, onClick: () => { if (window.confirm(`¿Estás seguro de eliminar a ${ctxMenu.requester.name}?`)) onDelete(ctxMenu.requester.id); } },
          ]}
        />
      )}
    </div>
  );
};
