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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Correo</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Registro</th>
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
                <td className="px-6 py-4 text-slate-600 text-sm">
                  {user.email}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.role)}`}>
                    {getRoleIcon(user.role)}
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm">
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
  );
};
