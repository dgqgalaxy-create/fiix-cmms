import { useState, useEffect } from 'react';
import { Shield, Loader2, Save } from 'lucide-react';
import { getAllPermissions, updateRolePermissions } from '../api/permissions';
import type { RolePermission } from '../api/permissions';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const AVAILABLE_PERMISSIONS = [
  { key: 'MANAGE_USERS', label: 'Administrar Usuarios', description: 'Crear, editar y eliminar usuarios del sistema.' },
  { key: 'MANAGE_ASSETS', label: 'Administrar Activos', description: 'Crear, editar y eliminar equipos o maquinaria.' },
  { key: 'MANAGE_ZONES', label: 'Administrar Zonas', description: 'Crear y eliminar zonas de la planta.' },
  { key: 'MANAGE_KPIS', label: 'Administrar KPIs', description: 'Modificar metas e indicadores de desempeño.' },
  { key: 'CREATE_WORK_ORDERS', label: 'Crear Órdenes', description: 'Generar nuevas solicitudes de mantenimiento.' },
  { key: 'EDIT_WORK_ORDERS', label: 'Editar Órdenes', description: 'Modificar estado y detalles de una orden.' },
  { key: 'DELETE_WORK_ORDERS', label: 'Eliminar Órdenes', description: 'Anular o eliminar permanentemente órdenes de trabajo.' },
  { key: 'MANAGE_PERMISSIONS', label: 'Administrar Permisos', description: 'Acceso a esta pantalla de configuración.' },
];

export const PermissionsPage = () => {
  const { hasPermission } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const data = await getAllPermissions();
      setRolePermissions(data);
    } catch (err: any) {
      setError('Error al cargar la configuración de permisos.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasPermission('MANAGE_PERMISSIONS')) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleToggle = (role: string, permKey: string, currentValue: boolean) => {
    setRolePermissions(prev => 
      prev.map(rp => {
        if (rp.role === role) {
          return {
            ...rp,
            permissions: {
              ...rp.permissions,
              [permKey]: !currentValue
            }
          };
        }
        return rp;
      })
    );
  };

  const handleSave = async (role: string) => {
    try {
      setSavingRole(role);
      setError('');
      setSuccessMsg('');
      const rp = rolePermissions.find(r => r.role === role);
      if (!rp) return;

      await updateRolePermissions(role, rp.permissions);
      setSuccessMsg(`Permisos actualizados para el rol: ${role}`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar los permisos.');
    } finally {
      setSavingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Shield className="text-indigo-600" size={32} />
            Privilegios por Rol
          </h1>
          <p className="text-slate-500 mt-1">Configura qué acciones puede realizar cada tipo de usuario en el sistema.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium border border-emerald-100 flex items-center gap-2">
          <Shield size={16} /> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {rolePermissions.map((rp) => (
          <div key={rp.role} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-800 truncate" title={rp.role}>{rp.role}</h3>
                <p className="text-xs text-slate-500 font-medium truncate">Configuración de acceso</p>
              </div>
              <button
                onClick={() => handleSave(rp.role)}
                disabled={savingRole === rp.role}
                className="px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl flex items-center gap-2 transition-colors disabled:opacity-70 flex-shrink-0"
              >
                {savingRole === rp.role ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Guardar
              </button>
            </div>
            <div className="p-2 flex-1">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const isEnabled = !!rp.permissions[perm.key];
                // Evitar que el administrador se quite sus propios permisos vitales
                const isLocked = rp.role === 'ADMINISTRADOR' && (perm.key === 'MANAGE_PERMISSIONS' || perm.key === 'MANAGE_USERS');
                
                return (
                  <div key={perm.key} className="p-4 hover:bg-slate-50 rounded-2xl transition-colors flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-slate-800">{perm.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{perm.description}</div>
                    </div>
                    <label className={`relative inline-flex items-center ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isEnabled}
                        disabled={isLocked}
                        onChange={() => handleToggle(rp.role, perm.key, isEnabled)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
