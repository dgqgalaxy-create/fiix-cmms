import { useState, useEffect } from 'react';
import { X, Loader2, Save, Trash2, Eye, EyeOff } from 'lucide-react';
import type { User } from '../api/users';
import { useAuth } from '../context/AuthContext';

interface Props {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const UserModal = ({ user, isOpen, onClose, onSubmit, onDelete }: Props) => {
  const { user: currentUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('TECNICO');
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!user;

  useEffect(() => {
    if (isOpen) {
      if (user) {
        setName(user.name);
        setEmail(user.email);
        setRole(user.role);
        setIsActive(user.is_active);
        setPassword(''); // Password empty on edit unless they want to change it
      } else {
        setName('');
        setEmail('');
        setRole('TECNICO');
        setIsActive(true);
        setPassword('');
      }
      setError('');
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing && !password) {
      setError('La contraseña es obligatoria para usuarios nuevos.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      const data: any = { name, email, role, is_active: isActive };
      if (password) {
        data.password = password;
      }

      await onSubmit(data);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar usuario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !onDelete) return;
    if (user.id === currentUser?.userId) {
       setError('No puedes eliminar tu propia cuenta.');
       return;
    }
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${user.name}?`)) {
      setIsSubmitting(true);
      try {
        await onDelete(user.id);
        onClose();
      } catch (err: any) {
        setError(err.response?.data?.error || 'Error al eliminar usuario');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">
            {isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form id="user-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
              <input 
                type="text" 
                required
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico *</label>
              <input 
                type="email" 
                required
                placeholder="Ej: juan@empresa.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contraseña {isEditing ? <span className="text-slate-400 font-normal">(Opcional: Dejar en blanco para no cambiarla)</span> : '*'}
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required={!isEditing}
                  placeholder={isEditing ? "Dejar vacío si no quieres cambiarla" : "Mínimo 6 caracteres"}
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol en el Sistema *</label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={user?.id === currentUser?.userId} // Don't allow changing your own role easily
              >
                <option value="TECNICO">TÉCNICO (Solo puede ver y atender sus órdenes)</option>
                <option value="GESTIONADOR">GESTIONADOR (Crea órdenes y asigan a técnicos)</option>
                <option value="ADMINISTRADOR">ADMINISTRADOR (Control total del sistema)</option>
              </select>
            </div>

            {isEditing && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center h-5">
                  <input
                    id="is_active"
                    type="checkbox"
                    className="w-5 h-5 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={user?.id === currentUser?.userId}
                  />
                </div>
                <div className="flex flex-col">
                  <label htmlFor="is_active" className={`text-sm font-bold cursor-pointer ${isActive ? 'text-emerald-700' : 'text-red-600'}`}>
                    {isActive ? 'Usuario Activo' : 'Dado de Baja'}
                  </label>
                  <p className="text-xs text-slate-500">
                    {isActive 
                      ? 'Puede acceder al sistema y ser asignado a órdenes.' 
                      : 'No podrá iniciar sesión ni ser asignado a nuevas órdenes, pero se conservará su historial.'}
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>

        <div className="px-6 py-5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex gap-2">
             {isEditing && onDelete && user?.id !== currentUser?.id && (
                <button type="button" onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-70">
                  <Trash2 size={16} /> Eliminar
                </button>
             )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" form="user-form" disabled={isSubmitting} className="px-6 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 rounded-xl shadow-sm shadow-emerald-700/20 transition-colors">
              {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {isEditing ? 'Guardar Cambios' : 'Crear Usuario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
