import { LayoutDashboard, Database, LogOut, Users, Activity, Shield, X, Package, CalendarClock, ShoppingCart, Info, GitBranch, Settings, Calendar, ClipboardCheck, Clock, Moon, Sun, GripVertical, Settings2, Check, Home, Smartphone, StickyNote, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { VersionModal, APP_VERSION } from './VersionModal';
import { OnlineUsersBadge } from './common/OnlineUsersBadge';
import { updateMyPreferences } from '../api/users';
import { canUseTechnicianMobileUi, isTechnicianMobileUiPrefOn, useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';
import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getNotesSummary } from '../api/notes';
import { getChatUnreadSummary } from '../api/chat';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
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
  badge?: number;
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

  const badgeEl =
    item.badge && item.badge > 0 ? (
      <span className="ml-auto shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white min-w-[1.25rem] text-center">
        {item.badge > 99 ? '99+' : item.badge}
      </span>
    ) : null;

  return (
    <div ref={setNodeRef} style={style} className={`flex items-center gap-2 ${isDragging ? 'opacity-50' : ''}`}>
      {isEditMode ? (
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors font-medium text-sm bg-slate-800/40 hover:bg-slate-800 text-slate-300 w-full cursor-grab border border-dashed border-slate-700/50"
          {...attributes} 
          {...listeners}
        >
          <GripVertical size={14} className="text-slate-500 shrink-0" />
          {item.icon}
          <span className="truncate flex-1">{item.name}</span>
          {badgeEl}
        </div>
      ) : (
        <Link
          to={item.path}
          onClick={onClose}
          className={`flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors font-medium text-sm ${
            isActive 
              ? 'bg-emerald-600/20 text-emerald-400' 
              : 'hover:bg-slate-800 hover:text-white'
          }`}
        >
          {item.icon}
          <span className="truncate flex-1">{item.name}</span>
          {badgeEl}
        </Link>
      )}
    </div>
  );
};

export const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const location = useLocation();
  const { user, logout, hasPermission, updateUserPreferences } = useAuth();
  const { theme, setTheme } = useTheme();
  const isTechMobileShell = useTechnicianMobileShell();
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [orderedItems, setOrderedItems] = useState<NavItem[]>([]);
  const [notesBadge, setNotesBadge] = useState(0);
  const [chatBadge, setChatBadge] = useState(0);

  const refreshNotesBadge = useCallback(async () => {
    try {
      const s = await getNotesSummary();
      setNotesBadge(s.open_tasks_assigned + s.open_notes + (s.unread_announcements || 0));
    } catch {
      /* ignore */
    }
  }, []);

  const refreshChatBadge = useCallback(async () => {
    try {
      const s = await getChatUnreadSummary();
      setChatBadge(s.unread_total || 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshNotesBadge();
    refreshChatBadge();
  }, [refreshNotesBadge, refreshChatBadge, user?.id]);

  useSocketRefresh('refresh_notes', refreshNotesBadge);
  useSocketRefresh(['refresh_chat', 'chat_message'], refreshChatBadge);

  useEffect(() => {
    const availableItems: NavItem[] = [
      { name: 'Inicio', path: '/home', icon: <Home size={16} /> },
      { name: 'Órdenes de Trabajo', path: '/dashboard', icon: <LayoutDashboard size={16} /> },
      { name: 'Mensajes', path: '/messages', icon: <MessageSquare size={16} />, badge: chatBadge },
      { name: 'Notas y pendientes', path: '/notes', icon: <StickyNote size={16} />, badge: notesBadge },
      { name: 'Activos', path: '/assets', icon: <Database size={16} /> },
      { name: 'Inventario', path: '/inventory', icon: <Package size={16} /> },
      { name: 'Checklist Diario', path: '/checklists', icon: <ClipboardCheck size={16} /> },
      { name: 'Horarios', path: '/roster', icon: <Clock size={16} /> },
      { name: 'Calendario', path: '/calendar', icon: <Calendar size={16} /> },
      { name: 'KPIs y Metas', path: '/kpis', icon: <Activity size={16} /> },
    ];

    if (hasPermission('MANAGE_PURCHASES')) {
      availableItems.push({ name: 'Compras', path: '/purchase-orders', icon: <ShoppingCart size={16} /> });
    }
    if (hasPermission('MANAGE_MAINTENANCE_PLANS')) {
      availableItems.push({ name: 'Planes Preventivos', path: '/maintenance-plans', icon: <CalendarClock size={16} /> });
    }
    if (hasPermission('MANAGE_USERS')) {
      availableItems.push({ name: 'Personal', path: '/users', icon: <Users size={16} /> });
    }
    if (hasPermission('VIEW_RCA')) {
      availableItems.push({ name: 'Árbol de Fallas', path: '/rca', icon: <GitBranch size={16} /> });
    }
    if (hasPermission('VIEW_SETTINGS')) {
      availableItems.push({ name: 'Configuración', path: '/settings', icon: <Settings size={16} /> });
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
        // Nuevo módulo Inicio: colocarlo al inicio aunque el usuario tenga un orden guardado
        if (item.path === '/home') {
          ordered.unshift(item);
        } else {
          ordered.push(item);
        }
      }
    });

    setOrderedItems(ordered);
  }, [user, hasPermission, notesBadge, chatBadge]);

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

  const techMobileUiOn = isTechnicianMobileUiPrefOn(user);

  const toggleTechnicianMobileUi = async () => {
    if (!canUseTechnicianMobileUi(user?.role)) return;
    const next = !techMobileUiOn;
    const newPreferences = {
      ...(user?.preferences || {}),
      use_technician_mobile_ui: next,
    };
    try {
      await updateMyPreferences(newPreferences);
      updateUserPreferences(newPreferences);
    } catch (e) {
      console.error('Error saving mobile UI preference', e);
    }
  };

  return (
    <>
      <aside
        className={`print:hidden w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col h-screen max-h-dvh fixed top-0 left-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 border-r border-transparent dark:border-slate-800 overflow-hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-3 pt-3 pb-2 flex flex-col items-center justify-center border-b border-slate-800 relative shrink-0">
          <div className="flex flex-col items-center gap-1">
            <img src="/lpet.png" alt="GTZ Logo" className="h-10 object-contain" />
            <span className="font-bold text-sm text-slate-300 tracking-widest uppercase">CMMS MTTO</span>
          </div>
          <button onClick={onClose} className="md:hidden absolute top-2 right-2 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors" title="Cerrar menú">
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-2 pb-1 flex justify-end shrink-0">
          <button 
            onClick={toggleEditMode}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md transition-colors ${
              isEditMode ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
            title={isEditMode ? "Guardar orden" : "Reorganizar menú"}
          >
            {isEditMode ? (
              <><Check size={12} /> Listo</>
            ) : (
              <><Settings2 size={12} /> Reorganizar</>
            )}
          </button>
        </div>

        <nav className="flex-1 px-2.5 pb-3 space-y-0.5 overflow-y-auto min-h-0">
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

        <div
          className={`p-2.5 border-t border-slate-800 shrink-0 overflow-y-auto ${
            isTechMobileShell ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]' : ''
          }`}
        >
          <div className="px-2.5 py-2 bg-slate-800/50 rounded-xl mb-2">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Usuario'}</p>
            <p className="text-[11px] text-blue-400 font-medium truncate">{user?.email}</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-500 mt-1">{user?.role}</p>
          </div>
          
          <OnlineUsersBadge />

          {canUseTechnicianMobileUi(user?.role) && (
            <button
              type="button"
              onClick={() => void toggleTechnicianMobileUi()}
              className={`mb-2 w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                techMobileUiOn
                  ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
              title="Preferencia de tu cuenta: interfaz móvil en celular"
            >
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <Smartphone size={14} className="shrink-0" />
                <span className="truncate text-left">Interfaz móvil</span>
              </span>
              <span
                className={`relative inline-flex h-4 w-7 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  techMobileUiOn ? 'bg-emerald-500' : 'bg-slate-600'
                }`}
                aria-hidden
              >
                <span
                  className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition ${
                    techMobileUiOn ? 'translate-x-3' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          )}

          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
              title={theme === 'dark' ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              {theme === 'dark' ? 'Claro' : 'Oscuro'}
            </button>

            <button 
              onClick={logout}
              className="flex items-center justify-center flex-1 gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut size={15} />
              Salir
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => setIsVersionModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-slate-800 hover:text-emerald-200 transition-colors"
            title="Versión, novedades y manual"
          >
            <Info size={12} />
            v{APP_VERSION} · Info y Manual
          </button>
        </div>
      </aside>

      <VersionModal 
        isOpen={isVersionModalOpen} 
        onClose={() => setIsVersionModalOpen(false)} 
      />
    </>
  );
};
