import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, icon, actions, className = '' }: PageHeaderProps) => (
  <div className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}>
    <div className="flex items-start gap-3">
      {icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          {icon}
        </div>
      )}
      <div>
        <h1 className="ui-page-title">{title}</h1>
        {description && <p className="ui-page-subtitle mt-1">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
