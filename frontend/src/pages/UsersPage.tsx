import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, updateUser, deleteUser } from '../api/users';
import type { User } from '../api/users';
import { UsersTable } from '../components/UsersTable';
import { UserModal } from '../components/UserModal';

export const UsersPage = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Users size={32} className="text-blue-800" />
            Directorio de Personal
          </h1>
          <p className="text-slate-500 mt-1">Gestiona técnicos, gestionadores y administradores del sistema.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={fetchUsers}
            className="p-2.5 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="Actualizar"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          {hasPermission('MANAGE_USERS') && (
            <button 
              onClick={handleOpenCreate}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm shadow-emerald-700/20 transition-colors"
            >
              <Plus size={18} />
              Nuevo Usuario
            </button>
          )}
        </div>
      </div>

      {isLoading && users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <RefreshCw size={32} className="animate-spin text-blue-800 mb-4" />
          <p className="text-slate-500 font-medium">Cargando personal...</p>
        </div>
      ) : (
        <UsersTable 
          users={users} 
          onRowClick={hasPermission('MANAGE_USERS') ? (u) => {
            setSelectedUser(u);
            setIsModalOpen(true);
          } : undefined}
        />
      )}

      <UserModal 
        user={selectedUser}
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={selectedUser ? handleUpdate : handleCreate}
        onDelete={handleDelete}
      />
    </>
  );
};
