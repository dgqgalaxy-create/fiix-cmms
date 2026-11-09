import { useMemo, useState } from 'react';
import type { User } from '../api/users';
import { Pencil, Shield, Wrench, User as UserIcon, Eye, Ban, CheckCircle2, Trash2, DollarSign, CalendarClock } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currency';
import { ContextMenu } from './common/ContextMenu';
import { DataTable } from './common/DataTable';
import type { TechnicianPattern } from '../api/roster';
import { latestPattern } from '../utils/personnelRoster';

interface Props {
  users: User[];
  onRowClick?: (user: User) => void;
  onToggleActive?: (user: User) => void;
  onDelete?: (user: User) => void;
  /** Patrones de turno (con vigencia) para mostrar el turno de cada persona. */
  patterns?: TechnicianPattern[];
  /** Abre el panel de turno de la persona. */
  onShiftClick?: (user: User) => void;
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'ADMINISTRADOR': return <Shield size={14} />;
    case 'GESTIONADOR': return <UserIcon size={14} />;
    case 'TECNICO': return <Wrench size={14} />;
    case 'OBSERVADOR': return <Eye size={14} />;
    default: return <UserIcon size={14} />;
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'ADMINISTRADOR': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900';
    case 'GESTIONADOR': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900';
    case 'TECNICO': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
    case 'OBSERVADOR': return 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900';
    default: return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

type SortField = 'name' | 'email' | 'role' | 'rate' | 'date';

export const UsersTable = ({ users, onRowClick, onToggleActive, onDelete, patterns = [], onShiftClick }: Props) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; user: User } | null>(null);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'email': cmp = a.email.localeCompare(b.email); break;
        case 'role': cmp = a.role.localeCompare(b.role); break;
        case 'rate': cmp = (a.hourly_rate ?? 0) - (b.hourly_rate ?? 0); break;
        case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [users, sortField, sortDirection]);

  const roleBadge = (user: User) => (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getRoleColor(user.role)}`}>
      {getRoleIcon(user.role)}
      {user.role}
    </span>
  );

  const rateText = (user: User) =>
    user.hourly_rate != null ? `${formatCurrency(user.hourly_rate)}/h` : '—';

  const shiftLabel = (user: User) => {
    const pattern = latestPattern(patterns, user.id);
    if (!pattern) return null;
    const label = pattern.pattern_type === 'MIXTO'
      ? 'Mixto'
      : pattern.pattern_type === '4X4_FIJO'
        ? '4x4 fijo'
        : '4x4 rotatorio';
    return { label, since: pattern.start_date.slice(0, 10), active: !pattern.end_date };
  };

  const shiftCell = (user: User) => {
    const shift = shiftLabel(user);
    return (
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); onShiftClick?.(user); }}
        disabled={!onShiftClick}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-transparent dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/40"
        title={shift ? `Turno vigente desde ${shift.since}${shift.active ? '' : ' (histórico)'}` : 'Asignar turno'}
      >
        <CalendarClock size={12} className="shrink-0" />
        <span className="truncate">{shift ? shift.label : 'Sin turno'}</span>
      </button>
    );
  };

  return (
    <>
      <DataTable
        storageKey="fiix-personal-users"
        rows={sortedUsers}
        rowKey={(user) => user.id}
        sortBy={sortField}
        sortDirection={sortDirection}
        onSort={(key, direction) => {
          const field = key as SortField;
          if (direction) {
            setSortField(field);
            setSortDirection(direction);
            return;
          }
          setSortField(field);
          setSortDirection(sortField === field && sortDirection === 'asc' ? 'desc' : 'asc');
        }}
        onOpen={onRowClick}
        onContextMenu={(event, user) => {
          event.preventDefault();
          setCtxMenu({ x: event.clientX, y: event.clientY, user });
        }}
        columns={[
          {
            key: 'name',
            label: 'Nombre',
            defaultWidth: 240,
            sortKey: 'name',
            render: (user) => (
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {user.name.substring(0, 2).toUpperCase()}
                </span>
                <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{user.name}</span>
                {!user.is_active && (
                  <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:bg-red-950/50 dark:text-red-300">
                    Baja
                  </span>
                )}
              </div>
            ),
          },
          {
            key: 'email',
            label: 'Correo',
            defaultWidth: 260,
            sortKey: 'email',
            render: (user) => <span className="truncate text-slate-600 dark:text-slate-300">{user.email}</span>,
          },
          {
            key: 'role',
            label: 'Rol',
            defaultWidth: 180,
            sortKey: 'role',
            render: (user) => roleBadge(user),
          },
          {
            key: 'shift',
            label: 'Turno',
            defaultWidth: 165,
            render: (user) => shiftCell(user),
          },
          {
            key: 'rate',
            label: 'Tarifa / h',
            defaultWidth: 120,
            align: 'right',
            sortKey: 'rate',
            render: (user) => (
              <span className={`inline-flex items-center gap-1 ${user.hourly_rate != null ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                {user.hourly_rate != null && <DollarSign size={12} />}
                {rateText(user)}
              </span>
            ),
          },
          {
            key: 'date',
            label: 'Registro',
            defaultWidth: 130,
            sortKey: 'date',
            render: (user) => <span className="text-slate-500 dark:text-slate-400">{formatDate(user.created_at)}</span>,
          },
          {
            key: 'actions',
            label: 'Acción',
            defaultWidth: 80,
            align: 'right',
            hideable: false,
            render: (user) => (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onRowClick?.(user); }}
                className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800"
                title="Editar"
              >
                <Pencil size={15} />
              </button>
            ),
          },
        ]}
        renderCard={(user) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{user.name}</p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{user.email}</p>
              </div>
              {!user.is_active && (
                <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  Baja
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {roleBadge(user)}
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{rateText(user)}</span>
            </div>
          </div>
        )}
        emptyMessage="No hay usuarios registrados."
      />

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          title={ctxMenu.user.name}
          onClose={() => setCtxMenu(null)}
          actions={[
            { key: 'edit', label: 'Editar', icon: <Pencil size={15} />, onClick: () => onRowClick?.(ctxMenu.user) },
            ...(onToggleActive ? [{ key: 'active', label: ctxMenu.user.is_active ? 'Dar de baja' : 'Reactivar', icon: ctxMenu.user.is_active ? <Ban size={15} /> : <CheckCircle2 size={15} />, onClick: () => onToggleActive(ctxMenu.user) }] : []),
            ...(onDelete ? [{ key: 'delete', label: 'Eliminar', icon: <Trash2 size={15} />, danger: true, onClick: () => onDelete(ctxMenu.user) }] : []),
          ]}
        />
      )}
    </>
  );
};
