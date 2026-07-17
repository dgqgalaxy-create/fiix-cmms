import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
}

export const Card = ({ children, className = '', padding = true, ...props }: CardProps) => (
  <div className={`ui-card ${padding ? 'p-5' : ''} ${className}`.trim()} {...props}>
    {children}
  </div>
);

interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const CardHeader = ({ title, description, icon, action, className = '' }: CardHeaderProps) => (
  <div className={`mb-4 flex items-start justify-between gap-3 ${className}`.trim()}>
    <div className="flex items-start gap-3">
      {icon && (
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          {icon}
        </div>
      )}
      <div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
    </div>
    {action}
  </div>
);
