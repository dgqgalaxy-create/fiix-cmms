import React, { useState, useMemo } from 'react';
import type { User } from '../api/users';
import { Pencil, Shield, Wrench, User as UserIcon, ChevronUp, ChevronDown } from 'lucide-react';

interface Props {
  users: User[];
  onRowClick: (user: User) => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'ADMINISTRADOR': return <Shield size={16} />;
    case 'GESTIONADOR': return <UserIcon size={16} />;
    case 'TECNICO': return <Wrench size={16} />;
    default: return <UserIcon size={16} />;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'ADMINISTRADOR': return 'bg-red-100 text-red-700 border-red-200';
    case 'GESTIONADOR': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'TECNICO': return 'bg-amber-100 text-amber-700 border-amber-200';
    default: return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const UsersTable = ({ users, onRowClick }: Props) => {
  const [sortField, setSortField] = useState<'name' | 'email' | 'role' | 'date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'email':
          cmp = a.email.localeCompare(b.email);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'date':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [users, sortField, sortDirection]);

  return (
    <div>
      {/* Vista de Tarjetas para Celulares */}
      <div className="block sm:hidden space-y-4">
        {sortedUsers.map((user) => (
          <div 
            key={user.id} 
            onClick={() => onRowClick(user)}
            className="bg-white p-4 rounded-2xl border border-slate-150 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-center mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleColor(user.role)}`}>
                {getRoleIcon(user.role)}
                {user.role}
              </span>
              <button className="text-slate-400 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 transition-colors shrink-0">
                <Pencil size={15} />
              </button>
            </div>
            <h3 className="font-bold text-slate-900 text-sm leading-snug flex items-center gap-2">
              {user.name}
              {!user.is_active && (
                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase border border-red-200">
                  Baja
                </span>
              )}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">{user.email}</p>
          </div>
        ))}
      </div>

      {/* Vista de Tabla para Escritorio */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortField('name'); setSortDirection(sortField === 'name' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Nombre {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 hidden sm:table-cell cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortField('email'); setSortDirection(sortField === 'email' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Correo {sortField === 'email' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortField('role'); setSortDirection(sortField === 'role' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Rol {sortField === 'role' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 hidden md:table-cell cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortField('date'); setSortDirection(sortField === 'date' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Registro {sortField === 'date' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedUsers.map((user) => (
                <tr 
                  key={user.id} 
                  onClick={() => onRowClick(user)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800 flex items-center gap-2">
                      {user.name}
                      {!user.is_active && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase border border-red-200">
                          Dado de Baja
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm hidden sm:table-cell">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                      {getRoleIcon(user.role)}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm hidden md:table-cell">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-400 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors">
                      <Pencil size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
