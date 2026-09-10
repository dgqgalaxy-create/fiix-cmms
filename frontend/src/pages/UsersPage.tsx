import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Users, Search, Eye, EyeOff, LayoutGrid, Table2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, updateUser, deleteUser, getOnlineUsers } from '../api/users';
import type { User } from '../api/users';
import { getRequesters, deleteRequester } from '../api/requesters';
import type { Requester } from '../api/requesters';
import { getWorkOrders } from '../api/workOrders';
import type { WorkOrder } from '../api/workOrders';
import { getTechnicianPerformance } from '../api/kpis';
import { UsersTable } from '../components/UsersTable';
import { UserCards } from '../components/UserCards';
import { UserModal } from '../components/UserModal';
import { RequestersTable } from '../components/RequestersTable';
import { RequesterModal } from '../components/RequesterModal';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { PageLoadError, PageLoadingState, isLikelyServerUnreachable } from '../components/PageLoadState';

export const UsersPage = () => {
  const { hasPermission, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'users' | 'requesters'>('users');
  
  const [users, setUsers] = useState<User[]>([]);
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Vista del Directorio: tarjetas (default) o tabla; se guarda por usuario.
  const viewKey = `fiix_users_view_v1_${user?.userId ?? user?.id ?? 'anon'}`;
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    try {
      const saved = localStorage.getItem(viewKey);
      if (saved === 'table' || saved === 'cards') return saved;
    } catch {
      /* ignorar */
    }
    return 'cards';
  });
  const [openOrdersByUser, setOpenOrdersByUser] = useState<Map<string, WorkOrder[]>>(new Map());
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [completedByUser, setCompletedByUser] = useState<Map<string, number>>(new Map());

  const applyViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem(viewKey, mode);
    } catch {
      /* quota / modo privado */
    }
  };

  const loadCardData = async () => {
    try {
      const [open, online, perf] = await Promise.all([
        getWorkOrders({ openOnly: true }).catch(() => [] as WorkOrder[]),
        getOnlineUsers().catch(() => [] as User[]),
        getTechnicianPerformance({ period: 'LAST_12_MONTHS' }).catch(() => []),
      ]);
      const openMap = new Map<string, WorkOrder[]>();
      for (const wo of open) {
        for (const t of wo.assigned_technicians ?? []) {
          const list = openMap.get(t.id) ?? [];
          list.push(wo);
          openMap.set(t.id, list);
        }
      }
      setOpenOrdersByUser(openMap);
      setOnlineIds(new Set(online.map((o) => o.id)));
      const compMap = new Map<string, number>();
      for (const row of perf) compMap.set(row.id, row.Finalizadas ?? 0);
      setCompletedByUser(compMap);
    } catch (error) {
      console.error('Error loading card data', error);
    }
  };
  
  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [isRequesterModalOpen, setIsRequesterModalOpen] = useState(false);
  const [selectedRequester, setSelectedRequester] = useState<Requester | null>(null);

  const fetchUsers = async (background = false) => {
    try {
      if (!background) {
        setIsLoading(true);
        setLoadError(false);
      }
      const data = await getUsers();
      setUsers(data);
      setLoadError(false);
    } catch (error) {
      console.error('Error fetching users', error);
      if (!background) setLoadError(isLikelyServerUnreachable(error));
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  const fetchRequesters = async (background = false) => {
    try {
      if (!background) {
        setIsLoading(true);
        setLoadError(false);
      }
      const data = await getRequesters();
      setRequesters(data);
      setLoadError(false);
    } catch (error) {
      console.error('Error fetching requesters', error);
      if (!background) setLoadError(isLikelyServerUnreachable(error));
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchUsers();
      void loadCardData();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRequesters();
    }
  }, [activeTab]);

  useSocketRefresh('refresh_users', () => {
    if (activeTab === 'users') {
      void fetchUsers(true);
      void loadCardData();
    }
  });
  useSocketRefresh('refresh_work_orders', () => {
    if (activeTab === 'users') void loadCardData();
  });
  useSocketRefresh('refresh_requesters', () => {
    if (activeTab === 'requesters') void fetchRequesters(true);
  });

  const handleCreate = async (data: any) => {
    await createUser(data);
    await fetchUsers();
  };

  const handleUpdate = async (data: any) => {
    if (!selectedUser) return;
    await updateUser(selectedUser.id, data);
    await fetchUsers();
  };

  const handleDelete = async (id: string) => {
    await deleteUser(id);
    await fetchUsers();
  };

  const handleToggleActive = async (user: User) => {
    const next = !user.is_active;
    const ok = confirm(next ? `¿Dar de baja a «${user.name}»?` : `¿Reactivar a «${user.name}»?`);
    if (!ok) return;
    try {
      await updateUser(user.id, { is_active: next });
      await fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo actualizar el usuario.');
    }
  };

  const handleDeleteRequester = async (id: string) => {
    await deleteRequester(id);
    await fetchRequesters();
  };

  const handleOpenCreateUser = () => {
    setSelectedUser(null);
    setIsUserModalOpen(true);
  };

  const handleOpenCreateRequester = () => {
    setSelectedRequester(null);
    setIsRequesterModalOpen(true);
  };

  let filteredUsers = [...users];
  
  if (!showInactive) {
    filteredUsers = filteredUsers.filter(u => u.is_active);
  }

  if (searchTerm.trim() !== '') {
    const term = searchTerm.toLowerCase();
    filteredUsers = filteredUsers.filter(u => u.name.toLowerCase().includes(term));
  }

  const roleValue = { 'ADMINISTRADOR': 4, 'GESTIONADOR': 3, 'TECNICO': 2, 'OBSERVADOR': 1 };
  filteredUsers.sort((a, b) => (roleValue[b.role as keyof typeof roleValue] || 0) - (roleValue[a.role as keyof typeof roleValue] || 0));

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
            <Users size={32} className="text-emerald-600 dark:text-emerald-400" />
            Directorio de Personal
          </h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Gestiona técnicos, gestionadores y administradores del sistema.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={activeTab === 'users' ? () => void fetchUsers(true) : () => void fetchRequesters(true)}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-sm"
            title="Actualizar"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          {hasPermission('MANAGE_USERS') && (
            <button 
              onClick={activeTab === 'users' ? handleOpenCreateUser : handleOpenCreateRequester}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm shadow-emerald-700/20 transition-colors"
            >
              <Plus size={18} />
              {activeTab === 'users' ? 'Nuevo Usuario' : 'Nuevo Solicitante'}
            </button>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'users' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Personal Interno
          {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400" />}
        </button>
        <button
          onClick={() => setActiveTab('requesters')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'requesters' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Catálogo de Solicitantes
          {activeTab === 'requesters' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400" />}
        </button>
      </div>

      {isLoading && ((activeTab === 'users' && users.length === 0) || (activeTab === 'requesters' && requesters.length === 0)) ? (
        <PageLoadingState />
      ) : loadError &&
        ((activeTab === 'users' && users.length === 0) ||
          (activeTab === 'requesters' && requesters.length === 0)) ? (
        <PageLoadError
          onRetry={() =>
            void (activeTab === 'users' ? fetchUsers() : fetchRequesters())
          }
        />
      ) : activeTab === 'users' ? (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <button
                  type="button"
                  onClick={() => applyViewMode('cards')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title="Vista de tarjetas"
                >
                  <LayoutGrid size={15} /> Tarjetas
                </button>
                <button
                  type="button"
                  onClick={() => applyViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'table'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                  title="Vista de tabla"
                >
                  <Table2 size={15} /> Tabla
                </button>
              </div>
              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors border shadow-sm ${
                  showInactive 
                    ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' 
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {showInactive ? <EyeOff size={16} /> : <Eye size={16} />}
                {showInactive ? 'Ocultar Inactivos' : 'Ver Inactivos'}
              </button>
            </div>
          </div>
          {viewMode === 'cards' ? (
            <UserCards
              users={filteredUsers}
              onlineIds={onlineIds}
              openByUser={openOrdersByUser}
              completedByUser={completedByUser}
              canManage={hasPermission('MANAGE_USERS')}
              onUserClick={(u) => {
                setSelectedUser(u);
                setIsUserModalOpen(true);
              }}
            />
          ) : (
            <UsersTable 
              users={filteredUsers} 
              onRowClick={hasPermission('MANAGE_USERS') ? (u) => {
                setSelectedUser(u);
                setIsUserModalOpen(true);
              } : undefined}
              onToggleActive={hasPermission('MANAGE_USERS') ? handleToggleActive : undefined}
              onDelete={hasPermission('MANAGE_USERS') ? (u) => { if (confirm(`¿Eliminar permanentemente a ${u.name}?`)) handleDelete(u.id); } : undefined}
            />
          )}
        </>
      ) : (
        <RequestersTable 
          requesters={requesters}
          onEdit={hasPermission('MANAGE_USERS') ? (r) => {
            setSelectedRequester(r);
            setIsRequesterModalOpen(true);
          } : () => {}}
          onDelete={hasPermission('MANAGE_USERS') ? handleDeleteRequester : () => {}}
        />
      )}

      <UserModal 
        user={selectedUser}
        isOpen={isUserModalOpen} 
        onClose={() => setIsUserModalOpen(false)} 
        onSubmit={selectedUser ? handleUpdate : handleCreate}
        onDelete={handleDelete}
      />

      <RequesterModal
        isOpen={isRequesterModalOpen}
        onClose={() => setIsRequesterModalOpen(false)}
        requester={selectedRequester}
        onSuccess={() => void fetchRequesters(true)}
      />
    </>
  );
};
