import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Shield, Loader2, CheckCircle2, Search, Users, Wrench, Package, ShoppingCart,
  ClipboardCheck, BarChart3, Settings, UserCog, Lock, Plus, Trash2, X, FolderOpen,
} from 'lucide-react';
import { getRoles, createRole, updateRole, deleteRole, type RoleDefinition } from '../api/roles';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { useEscapeKey } from '../hooks/useEscapeKey';

type ModuleKey = 'orders' | 'assets' | 'inventory' | 'purchases' | 'personnel' | 'checklists' | 'analytics' | 'files' | 'settings';

const MODULES: { key: ModuleKey; label: string; icon: React.ReactNode }[] = [
  { key: 'orders', label: 'Órdenes de trabajo', icon: <ClipboardCheck size={15} /> },
  { key: 'assets', label: 'Activos', icon: <Wrench size={15} /> },
  { key: 'inventory', label: 'Inventario', icon: <Package size={15} /> },
  { key: 'purchases', label: 'Compras', icon: <ShoppingCart size={15} /> },
  { key: 'personnel', label: 'Personal y turnos', icon: <Users size={15} /> },
  { key: 'checklists', label: 'Checklists', icon: <ClipboardCheck size={15} /> },
  { key: 'analytics', label: 'Análisis y fallas', icon: <BarChart3 size={15} /> },
  { key: 'files', label: 'Archivos', icon: <FolderOpen size={15} /> },
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
  { key: 'MANAGE_SETTINGS', label: 'Administrar configuración', description: 'Cambiar notificaciones, SLA, portal, características y catálogos.', module: 'settings' },
  { key: 'MANAGE_PERMISSIONS', label: 'Administrar permisos', description: 'Acceso a esta pantalla de roles y permisos.', module: 'settings' },
  { key: 'MANAGE_ROLES', label: 'Administrar roles', description: 'Crear, editar y eliminar roles (API de roles).', module: 'settings' },
  { key: 'PERFORM_WRITE_ACTIONS', label: 'Modificar datos', description: 'Sin este permiso el usuario solo puede consultar.', module: 'settings' },

  { key: 'MANAGE_REQUESTERS', label: 'Administrar solicitantes', description: 'Crear, editar y eliminar solicitantes del directorio.', module: 'personnel' },
  { key: 'MANAGE_METER_TRIGGERS', label: 'Administrar disparadores', description: 'Crear y editar disparadores de medidores que generan OT.', module: 'assets' },
  { key: 'MANAGE_LINE_COSTS', label: 'Costos por línea', description: 'Elegir las zonas visibles en el análisis de costos por línea.', module: 'analytics' },
  { key: 'ASSIGN_CHECKLIST_TECHNICIAN', label: 'Asignar técnico a checklist', description: 'Reasignar el técnico responsable de un checklist.', module: 'checklists' },
  { key: 'APPROVE_WORK_ORDERS', label: 'Aprobar órdenes', description: 'Autorizar o rechazar órdenes que requieren aprobación.', module: 'orders' },
  { key: 'MANAGE_FILE_FOLDERS', label: 'Administrar carpetas', description: 'Crear, renombrar y eliminar carpetas de la biblioteca de archivos.', module: 'files' },
];

const BASE_ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTIONADOR: 'Gestionador',
  TECNICO: 'Técnico',
  OBSERVADOR: 'Observador',
};

/** Roles configurables (estilo Atlas): crear, editar permisos y eliminar. */
export const PermissionsPage = () => {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBase, setNewBase] = useState('TECNICO');
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);

  // Escape cierra el diálogo de nuevo rol o el de borrado.
  useEscapeKey(() => {
    if (deleteTarget) { setDeleteTarget(null); return; }
    if (creating) setCreating(false);
  }, Boolean(creating || deleteTarget));

  const load = async (background = false) => {
    try {
      if (!background) setLoading(true);
      const data = await getRoles();
      setRoles(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
    } catch {
      setError('Error al cargar los roles.');
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useSocketRefresh('refresh_permissions', () => { void load(true); });

  const current = roles.find((role) => role.id === selectedId) ?? null;

  /**
   * Único candado del sistema: el rol base Administrador conserva
   * «Administrar permisos» para que nadie se quede sin poder gestionarlos.
   * Todo lo demás se puede activar o desactivar libremente.
   */
  const isLocked = (role: RoleDefinition | null, key: string) => {
    if (!role) return false;
    return role.base_role === 'ADMINISTRADOR' && key === 'MANAGE_PERMISSIONS';
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

  const save = async (role: RoleDefinition, permissions: Record<string, boolean>) => {
    setSavingRole(role.id);
    setError('');
    try {
      const updated = await updateRole(role.id, { permissions });
      setRoles((prev) => prev.map((item) => (item.id === role.id ? { ...item, ...updated } : item)));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Error al guardar los permisos.');
      await load(true);
    } finally {
      setSavingRole(null);
    }
  };

  const toggle = async (role: RoleDefinition, key: string, value: boolean) => {
    const next = { ...role.permissions, [key]: !value };
    setRoles((prev) => prev.map((item) => (item.id === role.id ? { ...item, permissions: next } : item)));
    await save(role, next);
  };

  const toggleModule = async (role: RoleDefinition, module: ModuleKey, enable: boolean) => {
    const next = { ...role.permissions };
    for (const perm of AVAILABLE_PERMISSIONS.filter((item) => item.module === module)) {
      if (isLocked(role, perm.key)) continue;
      next[perm.key] = enable;
    }
    setRoles((prev) => prev.map((item) => (item.id === role.id ? { ...item, permissions: next } : item)));
    await save(role, next);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const created = await createRole({
        name: newName.trim(),
        base_role: newBase,
        permissions: {},
      });
      setRoles((prev) => [...prev, { ...created, users_count: 0 }]);
      setSelectedId(created.id);
      setCreating(false);
      setNewName('');
      setNewBase('TECNICO');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo crear el rol.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRole(deleteTarget.id);
      setRoles((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar el rol.');
      setDeleteTarget(null);
    }
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
            Crea roles, define qué puede hacer cada uno y asígnalos desde la ficha del usuario.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={13} /> Guardado
            </span>
          )}
          {savingRole && <Loader2 size={16} className="animate-spin text-emerald-600" />}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus size={15} /> Nuevo rol
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {roles.map((role) => {
            const total = AVAILABLE_PERMISSIONS.length;
            const active = AVAILABLE_PERMISSIONS.filter((perm) => role.permissions[perm.key]).length;
            const isActive = role.id === selectedId;
            return (
              <div
                key={role.id}
                className={`rounded-xl border px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <button type="button" onClick={() => setSelectedId(role.id)} className="w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm font-bold ${isActive ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-800 dark:text-slate-100'}`}>
                      {role.name}
                    </span>
                    <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {active}/{total}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Base: {BASE_ROLE_LABELS[role.base_role] ?? role.base_role} · {role.users_count} usuario{role.users_count === 1 ? '' : 's'}
                  </p>
                </button>
                {!role.is_system && (
                  <div className="mt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(role)}
                      className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Eliminar rol"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
            <p className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
              <Lock size={12} /> Roles base
            </p>
            <p className="mt-1">
              Administrador, Gestionador, Técnico y Observador no se pueden eliminar (sí editar). El rol base
              define el comportamiento heredado del sistema.
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          {current ? (
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
                        onClick={() => void toggleModule(current, module.key, !allOn)}
                        className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {allOn ? 'Quitar todos' : 'Activar todos'}
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {perms.map((perm) => {
                        const enabled = !!current.permissions[perm.key];
                        const locked = isLocked(current, perm.key);
                        return (
                          <div key={perm.key} className="flex items-start gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{perm.label}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{perm.description}</p>
                            </div>
                            <label
                              className={`relative inline-flex shrink-0 items-center ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                              title={locked ? 'Este permiso no es modificable para este rol base' : undefined}
                            >
                              <input
                                type="checkbox"
                                className="peer sr-only"
                                checked={enabled}
                                disabled={locked}
                                onChange={() => void toggle(current, perm.key, enabled)}
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
                <UserCog size={12} /> Los cambios aplican a los {current.users_count} usuario(s) con este rol.
              </p>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              Elige un rol de la izquierda para configurar sus permisos.
            </p>
          )}
        </section>
      </div>

      {creating && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <form
            onSubmit={handleCreate}
            onClick={(event) => event.stopPropagation()}
            className="animate-in fade-in zoom-in-95 duration-200 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Nuevo rol</h2>
              <button type="button" onClick={() => setCreating(false)} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="role-name">Nombre</label>
                <input
                  id="role-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Ej. Supervisor de turno"
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="role-base">Rol base</label>
                <select
                  id="role-base"
                  value={newBase}
                  onChange={(event) => setNewBase(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="TECNICO">Técnico</option>
                  <option value="GESTIONADOR">Gestionador</option>
                  <option value="ADMINISTRADOR">Administrador</option>
                  <option value="OBSERVADOR">Observador</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  El rol base conserva el comportamiento del sistema (por ejemplo, solo el Administrador
                  puede eliminar zonas). Después ajustas los permisos uno por uno.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newName.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus size={14} /> Crear rol
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">¿Eliminar «{deleteTarget.name}»?</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {deleteTarget.users_count > 0
                ? `Tiene ${deleteTarget.users_count} usuario(s) asignados. Cámbialos de rol antes de eliminarlo.`
                : 'El rol se eliminará de forma permanente.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleteTarget.users_count > 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
