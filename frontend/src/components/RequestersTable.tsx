import { Edit2, Trash2 } from 'lucide-react';
import type { Requester } from '../api/requesters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  requesters: Requester[];
  onEdit: (requester: Requester) => void;
  onDelete: (id: string) => void;
}

export const RequestersTable = ({ requesters, onEdit, onDelete }: Props) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Nombre</th>
              <th className="p-4 font-semibold">Correo Electrónico</th>
              <th className="p-4 font-semibold">Departamento</th>
              <th className="p-4 font-semibold">Fecha de Registro</th>
              <th className="p-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requesters.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No hay solicitantes registrados.
                </td>
              </tr>
            ) : (
              requesters.map((requester) => (
                <tr key={requester.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-slate-800">{requester.name}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-600">{requester.email || '-'}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-600">{requester.department || '-'}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-slate-500 text-sm">
                      {format(new Date(requester.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(requester)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
    </div>
  );
};
