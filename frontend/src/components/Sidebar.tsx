import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, LogOut, Users, Activity, MapPin, Shield, X, Package, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();

  const navItems = [
    { name: 'Órdenes de Trabajo', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Activos', path: '/assets', icon: <Database size={20} /> },
    { name: 'Inventario', path: '/inventory', icon: <Package size={20} /> },
  ];

  if (hasPermission('MANAGE_MAINTENANCE_PLANS')) {
    navItems.push({ name: 'Planes Preventivos', path: '/maintenance-plans', icon: <CalendarClock size={20} /> });
  }

  if (hasPermission('MANAGE_ZONES')) {
    navItems.push({ name: 'Zonas', path: '/zones', icon: <MapPin size={20} /> });
  }

  if (hasPermission('MANAGE_PERMISSIONS')) {
    navItems.push({ name: 'Permisos', path: '/permissions', icon: <Shield size={20} /> });
  }

  if (hasPermission('MANAGE_USERS')) {
    navItems.push({ name: 'Personal', path: '/users', icon: <Users size={20} /> });
  }

  if (hasPermission('VIEW_KPIS') || hasPermission('MANAGE_KPIS')) {
    navItems.push({ name: 'KPIs y Metas', path: '/kpis', icon: <Activity size={20} /> });
  }

  return (
    <aside className={`w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed top-0 left-0 z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-6 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-800 shadow-inner flex items-center justify-center">
            <span className="text-white font-bold text-lg leading-none">L</span>
          </div>
          <span className="font-bold text-xl text-white tracking-tight">LPET CMMS</span>
        </div>
        <button onClick={onClose} className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors" title="Cerrar menú">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${
                isActive 
                  ? 'bg-emerald-600/20 text-emerald-400' 
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
          <p className="text-xs text-blue-400 font-medium truncate">{user?.email}</p>
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
