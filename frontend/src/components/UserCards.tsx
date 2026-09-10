import { Mail, ClipboardList, CheckCircle2 } from 'lucide-react';
import type { User } from '../api/users';
import type { WorkOrder } from '../api/workOrders';

const ROLE_LABEL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  GESTIONADOR: 'Gestionador',
  TECNICO: 'Técnico',
  OBSERVADOR: 'Observador',
};

const ROLE_CHIP: Record<string, string> = {
  ADMINISTRADOR:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60',
  GESTIONADOR:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
  TECNICO:
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
  OBSERVADOR:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-pink-500',
];

const STATUS_PILL: Record<string, string> = {
  PENDIENTE: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
  EN_PROCESO: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  EN_ESPERA: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
};
const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  EN_ESPERA: 'En espera',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

const avatarColor = (name: string) => {
  const sum = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

interface UserCardsProps {
  users: User[];
  /** ids de usuarios con sesión activa (heartbeat/socket). */
  onlineIds: Set<string>;
  /** Órdenes abiertas asignadas por usuario. */
  openByUser: Map<string, WorkOrder[]>;
  /** OTs completadas en los últimos 12 meses por usuario. */
  completedByUser: Map<string, number>;
  canManage: boolean;
  onUserClick?: (user: User) => void;
}

/** Vista de tarjetas del Directorio: avatar con iniciales, rol, estado en línea y carga de OT. */
export const UserCards = ({
  users,
  onlineIds,
  openByUser,
  completedByUser,
  canManage,
  onUserClick,
}: UserCardsProps) => {
  if (users.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
        No hay usuarios que coincidan con la búsqueda.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {users.map((u) => {
        const online = onlineIds.has(u.id);
        const openList = openByUser.get(u.id) ?? [];
        const openCount = openList.length;
        const completed = completedByUser.get(u.id) ?? 0;
        return (
          <div
            key={u.id}
            onClick={() => (canManage && onUserClick ? onUserClick(u) : undefined)}
            className={`bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 transition-all ${
              canManage && onUserClick
                ? 'hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 cursor-pointer'
                : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`w-14 h-14 rounded-full ${avatarColor(u.name)} flex items-center justify-center text-white font-bold text-lg shrink-0`}
              >
                {initials(u.name) || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate" title={u.name}>
                    {u.name}
                  </h3>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border shrink-0 ${
                      ROLE_CHIP[u.role] || ROLE_CHIP.OBSERVADOR
                    }`}
                  >
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </div>
                <p
                  className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${
                    online
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                  {online ? 'En línea' : 'Fuera de línea'}
                  {!u.is_active && (
                    <span className="ml-1 rounded bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 text-[10px] font-bold">
                      Inactivo
                    </span>
                  )}
                </p>
                {u.email && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate" title={u.email}>
                      {u.email}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <ClipboardList className="w-3.5 h-3.5" />
                {openCount} OT abierta{openCount === 1 ? '' : 's'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {completed} completadas (12m)
              </span>
            </div>

            {openCount > 0 && (
              <div className="mt-2 space-y-1">
                {openList.slice(0, 2).map((wo) => (
                  <div key={wo.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 dark:text-slate-300 truncate" title={wo.title}>
                      {wo.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${
                        STATUS_PILL[wo.status] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {STATUS_LABEL[wo.status] || wo.status}
                    </span>
                  </div>
                ))}
                {openCount > 2 && <p className="text-xs text-slate-400">+{openCount - 2} más</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
