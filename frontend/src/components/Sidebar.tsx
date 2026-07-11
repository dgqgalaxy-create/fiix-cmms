import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, LogOut, Users, Activity, MapPin, Shield, X, Package, CalendarClock, ShoppingCart, Info, GitBranch, Settings, Calendar, ClipboardCheck, Clock, Moon, Sun, GripVertical, Settings2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { VersionModal, APP_VERSION } from './VersionModal';
import { OnlineUsersBadge } from './common/OnlineUsersBadge';
import { updateMyPreferences } from '../api/users';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface NavItem {
  name: string;
  path: string;
  icon: JSX.Element;
}

const SortableNavItem = ({ item, isActive, isEditMode, onClose }: { item: NavItem, isActive: boolean, isEditMode: boolean, onClose: () => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.path });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 ${isDragging ? 'opacity-50' : ''}`}>
      {isEditMode ? (
        <div 
          className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium bg-slate-800/40 hover:bg-slate-800 text-slate-300 w-full cursor-grab border border-dashed border-slate-700/50"
          {...attributes} 
          {...listeners}
        >
          <GripVertical size={16} className="text-slate-500" />
          {item.icon}
          {item.name}
        </div>
      ) : (
        <Link
          to={item.path}
          onClick={onClose}
          className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium ${
            isActive 
              ? 'bg-emerald-600/20 text-emerald-400' 
              : 'hover:bg-slate-800 hover:text-white'
          }`}
        >
          {item.icon}
          {item.name}
        </Link>
      )}
    </div>
  );
};

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const location = useLocation();
  const { user, logout, hasPermission, updateUserPreferences } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [orderedItems, setOrderedItems] = useState<NavItem[]>([]);

  useEffect(() => {
    const availableItems: NavItem[] = [
      { name: 'Órdenes de Trabajo', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
      { name: 'Activos', path: '/assets', icon: <Database size={20} /> },
      { name: 'Inventario', path: '/inventory', icon: <Package size={20} /> },
      { name: 'Checklist Diario', path: '/checklists', icon: <ClipboardCheck size={20} /> },
      { name: 'Horarios', path: '/roster', icon: <Clock size={20} /> },
      { name: 'Calendario', path: '/calendar', icon: <Calendar size={20} /> },
      { name: 'KPIs y Metas', path: '/kpis', icon: <Activity size={20} /> },
    ];

    if (hasPermission('MANAGE_PURCHASES')) {
      availableItems.push({ name: 'Compras', path: '/purchase-orders', icon: <ShoppingCart size={20} /> });
    }
    if (hasPermission('MANAGE_MAINTENANCE_PLANS')) {
      availableItems.push({ name: 'Planes Preventivos', path: '/maintenance-plans', icon: <CalendarClock size={20} /> });
    }
    if (hasPermission('MANAGE_ZONES')) {
      availableItems.push({ name: 'Zonas', path: '/zones', icon: <MapPin size={20} /> });
    }
    if (hasPermission('MANAGE_USERS')) {
      availableItems.push({ name: 'Personal', path: '/users', icon: <Users size={20} /> });
    }
    if (user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR') {
      availableItems.push({ name: 'Árbol de Fallas', path: '/rca', icon: <GitBranch size={20} /> });
    }
    if (user?.role === 'ADMINISTRADOR') {
      availableItems.push({ name: 'Configuración', path: '/settings', icon: <Settings size={20} /> });
    }

    // Apply saved order
    const savedOrder: string[] = user?.preferences?.sidebarOrder || [];
    const ordered: NavItem[] = [];
    
    // Add items that are in savedOrder
    savedOrder.forEach(path => {
      const found = availableItems.find(item => item.path === path);
      if (found) {
        ordered.push(found);
      }
    });

    // Add remaining items that are not in savedOrder (e.g. newly added features)
    availableItems.forEach(item => {
      if (!ordered.find(o => o.path === item.path)) {
        ordered.push(item);
      }
    });

    setOrderedItems(ordered);
  }, [user, hasPermission]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedItems((items) => {
        const oldIndex = items.findIndex((i) => i.path === active.id);
        const newIndex = items.findIndex((i) => i.path === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const toggleEditMode = async () => {
    if (isEditMode) {
      // Save
      const newOrder = orderedItems.map(i => i.path);
      const newPreferences = { ...(user?.preferences || {}), sidebarOrder: newOrder };
      try {
        await updateMyPreferences(newPreferences);
        updateUserPreferences(newPreferences);
      } catch (e) {
        console.error("Error saving preferences", e);
      }
    }
    setIsEditMode(!isEditMode);
  };

  return (
    <>
      <aside className={`print:hidden w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col h-screen fixed top-0 left-0 z-40 transition-transform duration-300 ease-in-out md:translate-x-0 border-r border-transparent dark:border-slate-800 ${
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

        <div className="px-4 pt-4 pb-2 flex justify-end">
          <button 
            onClick={toggleEditMode}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              isEditMode ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
            title={isEditMode ? "Guardar orden" : "Reorganizar menú"}
          >
            {isEditMode ? (
              <><Check size={14} /> Listo</>
            ) : (
              <><Settings2 size={14} /> Reorganizar</>
            )}
          </button>
        </div>

        <nav className="flex-1 px-4 pb-6 space-y-2 overflow-y-auto">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={orderedItems.map(i => i.path)}
              strategy={verticalListSortingStrategy}
            >
              {orderedItems.map((item) => (
                <SortableNavItem 
                  key={item.path}
                  item={item}
                  isActive={location.pathname === item.path}
                  isEditMode={isEditMode}
                  onClose={onClose}
                />
              ))}
            </SortableContext>
          </DndContext>
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="px-4 py-3 bg-slate-800/50 rounded-2xl mb-4">
            <p className="text-sm font-semibold text-white">{user?.name || 'Usuario'}</p>
            <p className="text-xs text-blue-400 font-medium truncate">{user?.email}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-2">{user?.role}</p>
          </div>
          
          <OnlineUsersBadge />

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition-colors"
              title={theme === 'dark' ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </button>

            <button 
              onClick={logout}
              className="flex items-center justify-center flex-1 gap-2 px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
          
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
