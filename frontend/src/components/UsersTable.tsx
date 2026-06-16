import type { User } from '../api/users';
import { Pencil, Shield, Wrench, User as UserIcon } from 'lucide-react';

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
  return (
    <div>
      {/* Vista de Tarjetas para Celulares */}
      <div className="block sm:hidden space-y-4">
        {users.map((user) => (
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
            <h3 className="font-bold text-slate-900 text-sm leading-snug">{user.name}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{user.email}</p>
          </div>
        ))}
      </div>

      {/* Vista de Tabla para Escritorio */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Correo</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Registro</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr 
                  key={user.id} 
                  onClick={() => onRowClick(user)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{user.name}</div>
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
