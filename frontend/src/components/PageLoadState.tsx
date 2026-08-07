import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Estado de carga / error de red para listas principales.
 * Evita el círculo infinito cuando el servidor no responde.
 */
export function PageLoadingState({
  label = 'Cargando…',
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <RefreshCw size={32} className="animate-spin text-emerald-600 dark:text-emerald-400 mb-4" />
      <p className="text-slate-500 dark:text-slate-400 font-medium">{label}</p>
    </div>
  );
}

export function PageLoadError({
  message = 'No se pudo conectar con el servidor. Revisa la red o que el CMMS esté en línea.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 bg-white dark:bg-slate-800 rounded-2xl border border-rose-100 dark:border-rose-900/40 shadow-sm text-center">
      <AlertTriangle size={36} className="text-rose-500" />
      <p className="text-slate-700 dark:text-slate-200 font-semibold max-w-md">{message}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
        Si acabas de reiniciar el servidor, espera unos segundos y pulsa Reintentar.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          <RefreshCw size={16} />
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Detecta fallo de red / timeout de axios (servidor caído con Wi‑Fi “online”). */
export function isLikelyServerUnreachable(error: unknown): boolean {
  const ax = error as { code?: string; message?: string; response?: unknown };
  if (ax?.response) return false;
  const code = ax?.code || '';
  const msg = (ax?.message || '').toLowerCase();
  return (
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK' ||
    code === 'ETIMEDOUT' ||
    msg.includes('timeout') ||
    msg.includes('network error')
  );
}
