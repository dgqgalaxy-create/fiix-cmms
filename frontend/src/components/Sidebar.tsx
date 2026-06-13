import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { name: 'Órdenes de Trabajo', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Activos', path: '/assets', icon: <Database size={20} /> },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed top-0 left-0">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow-inner flex items-center justify-center">
          <span className="text-white font-bold text-lg leading-none">F</span>
        </div>
        <span className="font-bold text-xl text-white tracking-tight">Fiix CMMS</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${
                isActive 
                  ? 'bg-purple-600/20 text-purple-400' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="px-4 py-3 bg-slate-800/50 rounded-2xl mb-4">
          <p className="text-sm font-semibold text-white">{user?.name || 'Usuario'}</p>
          <p className="text-xs text-purple-400 font-medium truncate">{user?.email}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">{user?.role}</p>
        </div>
        <button 
          onClick={logout}
          className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};
