import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Shield, Loader2, CheckCircle2, Search, Users, Wrench, Package, ShoppingCart,
  ClipboardCheck, BarChart3, Settings, UserCog, Lock,
} from 'lucide-react';
import { getAllPermissions, updateRolePermissions } from '../api/permissions';
import type { RolePermission } from '../api/permissions';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

type ModuleKey = 'orders' | 'assets' | 'inventory' | 'purchases' | 'personnel' | 'checklists' | 'analytics' | 'settings';

const MODULES: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  { key: 'orders', label: 'Órdenes de trabajo', icon: <ClipboardCheck size={15} /> },
  { key: 'assets', label: 'Activos', icon: <Wrench size={15} /> },
  { key: 'inventory', label: 'Inventario', icon: <Package size={15} /> },
  { key: 'purchases', label: 'Compras', icon: <ShoppingCart size={15} /> },
  { key: 'personnel', label: 'Personal y turnos', icon: <Users size={15} /> },
  { key: 'checklists', label: 'Checklists', icon: <ClipboardCheck size={15} /> },
  { key: 'analytics', label: 'Análisis y fallas', icon: <BarChart3 size={15} /> },
  { key: 'settings', label: 'Configuración', icon: <Settings size={15} /> },
];

const AVAILABLE_PERMISSIONS: { key: string; label: string; description: string; module: ModuleKey }[] = [
  { key: 'CREATE_WORK_ORDERS', label: 'Crear órdenes', description: 'Generar nuevas solicitudes de mantenimiento.', module: 'orders' },
  { key: 'VIEW_ALL_WORK_ORDERS', label: 'Ver todas las órdenes', description: 'Ver el historial y la lista completa de órdenes de todos.', module: 'orders' },
  { key: 'EDIT_WORK_ORDERS', label: 'Editar órdenes', description: 'Modificar estado y detalles de una orden.', module: 'orders' },
  { key: 'DELETE_WORK_ORDERS', label: 'Eliminar órdenes', description: 'Anular o eliminar permanentemente órdenes de trabajo.', module: 'orders' },
  { key: 'MANAGE_MAINTENANCE_PLANS', label: 'Mantenimiento preventivo', description: 'Crear y editar planes de mantenimiento preventivo.', module: 'orders' },
  { key: 'MANAGE_CALENDAR', label: 'Administrar calendario', description: 'Agendar, desagendar y reubicar órdenes en el calendario.', module: 'orders' },

  { key: 'MANAGE_ASSETS', label: 'Administrar activos', description: 'Crear, editar y eliminar equipos o maquinaria.', module: 'assets' },
  { key: 'MANAGE_ZONES', label: 'Administrar zonas', description: 'Crear y editar zonas y secciones. Eliminar zona: solo Administrador.', module: 'assets' },
  { key: 'USE_QR_SCANNER', label: 'Usar escáner QR', description: 'Abrir la cámara para escanear repuestos o equipos.', module: 'assets' },

  { key: 'MANAGE_INVENTORY', label: 'Administrar inventario', description: 'Crear, editar y eliminar repuestos, categorías y ubicaciones.', module: 'inventory' },
  { key: 'REGISTER_INVENTORY_ENTRIES', label: 'Registrar entradas', description: 'Registrar entradas de stock. Sin este permiso solo se registran salidas.', module: 'inventory' },
  { key: 'DELETE_ITEMS', label: 'Eliminar repuestos', description: 'Eliminar permanentemente repuestos del catálogo.', module: 'inventory' },
  { key: 'DELETE_INVENTORY_MOVEMENTS', label: 'Eliminar movimientos', description: 'Eliminar movimientos de inventario (revierte el stock).', module: 'inventory' },

  { key: 'MANAGE_PURCHASES', label: 'Administrar compras', description: 'Acceder al módulo de compras y generar pedidos desde inventario.', module: 'purchases' },

  { key: 'MANAGE_USERS', label: 'Administrar usuarios', description: 'Crear, editar y eliminar usuarios del sistema.', module: 'personnel' },
  { key: 'MANAGE_SHIFTS', label: 'Administrar horarios', description: 'Asignar patrones de turno e incidencias a los técnicos.', module: 'personnel' },

  { key: 'APPROVE_CHECKLIST', label: 'Aprobar checklists', description: 'Revisar y aprobar los checklists diarios completados.', module: 'checklists' },
  { key: 'MANAGE_CHECKLIST_CATALOG', label: 'Administrar catálogo de checklists', description: 'Editar, agregar y eliminar actividades del checklist diario.', module: 'checklists' },

  { key: 'MANAGE_KPIS', label: 'Administrar metas KPI', description: 'Modificar metas e indicadores de desempeño.', module: 'analytics' },
  { key: 'VIEW_RCA', label: 'Ver árbol de fallas', description: 'Consultar el catálogo de problemas, causas y soluciones.', module: 'analytics' },
  { key: 'MANAGE_RCA', label: 'Editar árbol de fallas', description: 'Agregar, activar o desactivar elementos del árbol de fallas.', module: 'analytics' },

  { key: 'VIEW_SETTINGS', label: 'Ver configuración', description: 'Acceso a Configuración (apariencia y opciones del sistema).', module: 'settings' },
  { key: 'MANAGE_PERMISSIONS', label: 'Administrar permisos', description: 'Acceso a esta pantalla de permisos por rol.', module: 'settings' },
];

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTIONADOR: 'Gestionador',
  TECNICO: 'Técnico',
  OBSERVADOR: 'Observador',
};

/** Pantalla de permisos por rol, agrupada por módulo (estilo Atlas). */
export const PermissionsPage = () => {
  const { hasPermission } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchPermissions = async (background = false) => {
    try {
      if (!background) setLoading(true);
      const data = await getAllPermissions();
      setRolePermissions(data);
      setSelectedRole((currentRole) => currentRole ?? data[0]?.role ?? null);
    } catch {
      setError('Error al cargar la configuración de permisos.');
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPermissions();
  }, []);

  useSocketRefresh('refresh_permissions', () => { void fetchPermissions(true); });

  const current = rolePermissions.find((rp) => rp.role === selectedRole) ?? null;

  const isLocked = (role: string, key: string) => {
    if (role === 'ADMINISTRADOR' && (key === 'MANAGE_PERMISSIONS' || key === 'MANAGE_USERS')) return true;
    if (role === 'OBSERVADOR' && key !== 'VIEW_ALL_WORK_ORDERS' && key !== 'VIEW_RCA') return true;
    return false;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return AVAILABLE_PERMISSIONS;
    return AVAILABLE_PERMISSIONS.filter(
      (perm) => perm.label.toLowerCase().includes(term) || perm.description.toLowerCase().includes(term)
    );
  }, [search]);

  if (!hasPermission('MANAGE_PERMISSIONS')) {
    return <Navigate to="/home" replace />;
  }

  const save = async (role: string, permissions: Record<string, boolean>) => {
    setSavingRole(role);
    setError('');
    try {
      await updateRolePermissions(role, permissions);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al guardar los permisos.');
      await fetchPermissions(true);
    } finally {
      setSavingRole(null);
    }
  };

  const toggle = async (role: string, key: string, currentValue: boolean) => {
    const rp = rolePermissions.find((item) => item.role === role);
    if (!rp) return;
    const next = { ...rp.permissions, [key]: !currentValue };
    setRolePermissions((prev) => prev.map((item) => (item.role === role ? { ...item, permissions: next } : item)));
    await save(role, next);
  };

  const toggleModule = async (role: string, module: ModuleKey, enable: boolean) => {
    const rp = rolePermissions.find((item) => item.role === role);
    if (!rp) return;
    const next = { ...rp.permissions };
    for (const perm of AVAILABLE_PERMISSIONS.filter((item) => item.module === module)) {
      if (isLocked(role, perm.key)) continue;
      next[perm.key] = enable;
    }
    setRolePermissions((prev) => prev.map((item) => (item.role === role ? { ...item, permissions: next } : item)));
    await save(role, next);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
            <Shield className="text-emerald-600 dark:text-emerald-400" size={28} />
            Roles y permisos
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-300">
            Elige un rol y activa las acciones que puede realizar. Los cambios se guardan al instante.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={13} /> Guardado
            </span>
          )}
          {savingRole && <Loader2 size={16} className="animate-spin text-emerald-600" />}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Lista de roles */}
        <aside className="space-y-2">
          {rolePermissions.map((rp) => {
            const total = AVAILABLE_PERMISSIONS.length;
            const active = AVAILABLE_PERMISSIONS.filter((perm) => rp.permissions[perm.key]).length;
            const isActive = rp.role === selectedRole;
            return (
              <button
                key={rp.role}
                type="button"
                onClick={() => setSelectedRole(rp.role)}
                aria-current={isActive ? 'true' : undefined}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${isActive ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-800 dark:text-slate-100'}`}>
                    {ROLE_LABELS[rp.role] ?? rp.role}
                  </span>
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    {active}/{total}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{rp.role}</p>
              </button>
            );
          })}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            <p className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
              <Lock size={12} /> Bloqueados
            </p>
            <p className="mt-1">
              El Administrador no puede quitarse <em>Permisos</em> ni <em>Usuarios</em>. El Observador solo
              tiene permisos de consulta; el servidor bloquea el resto.
            </p>
          </div>
        </aside>

        {/* Matriz de permisos del rol */}
        <section className="min-w-0">
          {current && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar permiso…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {MODULES.map((module) => {
                const perms = filtered.filter((perm) => perm.module === module.key);
                if (perms.length === 0) return null;
                const allOn = perms.every((perm) => current.permissions[perm.key]);
                return (
                  <div key={module.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                      <span className="text-slate-500 dark:text-slate-400">{module.icon}</span>
                      <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{module.label}</h2>
                      <button
                        type="button"
                        onClick={() => void toggleModule(current.role, module.key, !allOn)}
                        className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {allOn ? 'Quitar todos' : 'Activar todos'}
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {perms.map((perm) => {
                        const enabled = !!current.permissions[perm.key];
                        const locked = isLocked(current.role, perm.key);
                        return (
                          <div key={perm.key} className="flex items-start gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{perm.label}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{perm.description}</p>
                            </div>
                            <label
                              className={`relative inline-flex shrink-0 items-center ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                              title={locked ? 'Este permiso no es modificable para este rol' : undefined}
                            >
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={enabled}
                                disabled={locked}
                                onChange={() => void toggle(current.role, perm.key, enabled)}
                              />
                              <span className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-emerald-600 dark:bg-slate-700" />
                              <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <p className="flex items-center gap-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500">
                <UserCog size={12} /> Los permisos aplican a todos los usuarios con rol {ROLE_LABELS[current.role] ?? current.role}.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
