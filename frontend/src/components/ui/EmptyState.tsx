import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ icon, title, description, action, className = '' }: EmptyStateProps) => (
  <div className={`flex min-h-40 flex-col items-center justify-center px-4 py-10 text-center ${className}`.trim()}>
    {icon && <div className="mb-3 text-slate-300 dark:text-slate-600">{icon}</div>}
    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</p>
    {description && <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Spinner = ({ label = 'Cargando...' }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-400" />
    <p className="text-sm">{label}</p>
  </div>
);
