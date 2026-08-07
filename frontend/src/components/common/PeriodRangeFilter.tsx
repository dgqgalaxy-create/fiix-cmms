/**
 * Inputs Desde / Hasta para filtrar por periodo (mismo patrón que Inicio).
 */
export function PeriodRangeFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClear,
  className = '',
  size = 'md',
}: {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onClear?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const inputClass =
    size === 'sm'
      ? 'text-sm px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
      : 'text-sm px-2.5 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
        Desde:
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
        Hasta:
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className={inputClass}
        />
      </label>
      {onClear && (startDate || endDate) ? (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1 bg-rose-50 dark:bg-rose-950/30 rounded-lg"
        >
          Limpiar fechas
        </button>
      ) : null}
    </div>
  );
}

/** ¿`isoDate` cae dentro del rango YYYY-MM-DD (inclusive)? */
export function isInDateRange(isoDate: string, startDate: string, endDate: string): boolean {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return false;
  if (startDate) {
    const [y, m, d] = startDate.split('-').map(Number);
    if (y && m && d) {
      const s = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      if (t < s) return false;
    }
  }
  if (endDate) {
    const [y, m, d] = endDate.split('-').map(Number);
    if (y && m && d) {
      const e = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
      if (t > e) return false;
    }
  }
  return true;
}

/** Primer día del mes actual en YYYY-MM-DD (local). */
export function firstDayOfMonthYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

/** Hoy en YYYY-MM-DD (local). */
export function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
