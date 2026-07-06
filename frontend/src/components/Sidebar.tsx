import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, LogOut, Users, Activity, MapPin, Shield, X, Package, CalendarClock, ShoppingCart, Info, GitBranch, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VersionModal, APP_VERSION } from './VersionModal';
import { OnlineUsersBadge } from './common/OnlineUsersBadge';

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  const navItems = [
    { name: 'Órdenes de Trabajo', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Activos', path: '/assets', icon: <Database size={20} /> },
    { name: 'Inventario', path: '/inventory', icon: <Package size={20} /> },
    { name: 'Compras', path: '/purchase-orders', icon: <ShoppingCart size={20} /> },
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

  if (user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR') {
    navItems.push({ name: 'Árbol de Fallas', path: '/rca', icon: <GitBranch size={20} /> });
  }

  if (user?.role === 'ADMINISTRADOR') {
    navItems.push({ name: 'Configuración', path: '/settings', icon: <Settings size={20} /> });
  }

  return (
    <>
      <aside className={`print:hidden w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed top-0 left-0 z-40 transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex flex-col items-center justify-center border-b border-slate-800 relative">
          <div className="flex flex-col items-center gap-2">
            <img src="/lpet.png" alt="LPET Logo" className="h-14 object-contain" />
            <span className="font-bold text-lg text-slate-300 tracking-widest uppercase">CMMS MTTO</span>
          </div>
          <button onClick={onClose} className="md:hidden absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors" title="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
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

        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="px-4 py-3 bg-slate-800/50 rounded-2xl mb-4">
            <p className="text-sm font-semibold text-white">{user?.name || 'Usuario'}</p>
            <p className="text-xs text-blue-400 font-medium truncate">{user?.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">{user?.role}</p>
          </div>
          
          <OnlineUsersBadge />

          <button 
            onClick={logout}
            className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors mb-4"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
          
          <div className="text-center">
            <button 
              onClick={() => setIsVersionModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Info size={14} />
              v{APP_VERSION} - Info del Sistema
            </button>
          </div>
        </div>
      </aside>

      <VersionModal 
        isOpen={isVersionModalOpen} 
        onClose={() => setIsVersionModalOpen(false)} 
      />
    </>
  );
};
