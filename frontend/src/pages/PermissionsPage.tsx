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
  { key: 'MANAGE_KPIS', label: 'Administrar Metas KPI', description: 'Modificar metas e indicadores de desempeño.' },
  { key: 'CREATE_WORK_ORDERS', label: 'Crear Órdenes', description: 'Generar nuevas solicitudes de mantenimiento.' },
  { key: 'VIEW_ALL_WORK_ORDERS', label: 'Ver Todas las Órdenes', description: 'Permite visualizar el historial y lista completa de órdenes de todos.' },
  { key: 'EDIT_WORK_ORDERS', label: 'Editar Órdenes', description: 'Modificar estado y detalles de una orden.' },
  { key: 'DELETE_WORK_ORDERS', label: 'Eliminar Órdenes', description: 'Anular o eliminar permanentemente órdenes de trabajo.' },
  { key: 'MANAGE_MAINTENANCE_PLANS', label: 'Mantenimiento Preventivo', description: 'Crear y editar planes de mantenimiento preventivo.' },
  { key: 'MANAGE_CALENDAR', label: 'Administrar Calendario', description: 'Agendar, desagendar y reubicar órdenes en el calendario.' },
  { key: 'USE_QR_SCANNER', label: 'Usar Escáner QR', description: 'Permite abrir la cámara para escanear repuestos o equipos desde las búsquedas.' },
  { key: 'APPROVE_CHECKLIST', label: 'Aprobar Checklists Diarios', description: 'Permite revisar y aprobar los Checklists Diarios completados.' },
  { key: 'MANAGE_CHECKLIST_CATALOG', label: 'Administrar Catálogo de Checklists', description: 'Permite editar, agregar y eliminar las actividades del Checklist Diario.' },
  { key: 'MANAGE_PURCHASES', label: 'Administrar Compras', description: 'Permite acceder al módulo de compras y generar pedidos desde el inventario.' },
  { key: 'MANAGE_INVENTORY', label: 'Administrar Inventario', description: 'Crear, editar y eliminar repuestos, categorías y ubicaciones.' },
  { key: 'REGISTER_INVENTORY_ENTRIES', label: 'Registrar Entradas de Inventario', description: 'Permite registrar entradas de stock. Sin este permiso, solo se pueden registrar salidas.' },
  { key: 'MANAGE_SHIFTS', label: 'Administrar Horarios', description: 'Permite asignar patrones de turno e incidencias a los técnicos.' },
  { key: 'VIEW_RCA', label: 'Ver Árbol de Fallas', description: 'Permite consultar el catálogo de Problemas, Causas y Soluciones (RCA).' },
  { key: 'MANAGE_RCA', label: 'Editar Árbol de Fallas', description: 'Permite agregar, activar o desactivar elementos del Árbol de Fallas.' },
  { key: 'VIEW_SETTINGS', label: 'Ver Configuración', description: 'Permite acceder al módulo de Configuración del sistema.' },
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
    return <Navigate to="/home" replace />;
  }

  const handleToggle = async (role: string, permKey: string, currentValue: boolean) => {
    // 1. Actualización optimista de UI
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

    // 2. Guardar en backend
    const rp = rolePermissions.find(r => r.role === role);
    if (!rp) return;

    const newPermissions = {
      ...rp.permissions,
      [permKey]: !currentValue
    };

    try {
      setSavingRole(role);
      setError('');
      await updateRolePermissions(role, newPermissions);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar los permisos. Recargando...');
      fetchPermissions(); // Revertir en caso de error
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
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Shield className="text-emerald-600 dark:text-emerald-400" size={28} />
            Privilegios por Rol
          </h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Configura qué acciones puede realizar cada tipo de usuario en el sistema.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rolePermissions.map((rp) => (
          <div key={rp.role} className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 flex justify-between items-center gap-3">
              <div className="min-w-0 flex items-center gap-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate" title={rp.role}>{rp.role}</h3>
                {savingRole === rp.role && <Loader2 size={16} className="animate-spin text-emerald-600 dark:text-emerald-400" />}
              </div>
            </div>
            <div className="p-2 flex-1">
              {AVAILABLE_PERMISSIONS.map((perm) => {
                const isEnabled = !!rp.permissions[perm.key];
                // Evitar que el administrador se quite sus propios permisos vitales
                const isLocked = rp.role === 'ADMINISTRADOR' && (perm.key === 'MANAGE_PERMISSIONS' || perm.key === 'MANAGE_USERS');
                
                return (
                  <div key={perm.key} className="p-2.5 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl sm:rounded-2xl transition-colors flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{perm.label}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{perm.description}</div>
                    </div>
                    <label className={`relative inline-flex items-center ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isEnabled}
                        disabled={isLocked}
                        onChange={() => handleToggle(rp.role, perm.key, isEnabled)}
                      />
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
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
