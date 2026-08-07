import type { ReactNode } from 'react';
import { CalendarClock, type LucideIcon } from 'lucide-react';

type FilterScopeTone = 'blue' | 'emerald' | 'slate';

const TONE_CLASS: Record<
  FilterScopeTone,
  { section: string; badge: string }
> = {
  blue: {
    section:
      'border-blue-200/80 bg-blue-50/30 dark:border-blue-900/70 dark:bg-blue-950/10',
    badge:
      'border-blue-200 bg-white text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300',
  },
  emerald: {
    section:
      'border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-900/70 dark:bg-emerald-950/10',
    badge:
      'border-emerald-200 bg-white text-emerald-700 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300',
  },
  slate: {
    section:
      'border-slate-200/90 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-900/40',
    badge:
      'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
  },
};

/**
 * Marco visual (como «Resumen por periodo» en Inicio):
 * agrupa filtros opcionales y el contenido que afectan.
 */
export function FilterScopeFrame({
  title,
  hint,
  icon: Icon = CalendarClock,
  tone = 'blue',
  children,
  className = '',
  toolbar,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: FilterScopeTone;
  children: ReactNode;
  className?: string;
  /** Barra de filtros debajo del título del marco */
  toolbar?: ReactNode;
}) {
  const t = TONE_CLASS[tone];

  return (
    <section
      className={`relative mb-8 rounded-3xl border-2 ${t.section} p-3 sm:p-5 ${className}`}
    >
      <div
        className={`absolute -top-3 left-5 z-10 flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm ${t.badge}`}
      >
        <Icon size={14} />
        {title}
      </div>

      {hint ? (
        <p className="mb-3 mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : (
        <div className="mt-2" />
      )}

      {toolbar ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          {toolbar}
        </div>
      ) : null}

      {children}
    </section>
  );
}
