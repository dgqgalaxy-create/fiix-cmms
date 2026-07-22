import { useEffect, useState, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, Trash2, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getOfflineRequests, clearOfflineQueue } from '../utils/offlineQueue';
import { syncOfflineQueue, type SyncResult } from '../utils/offlineSync';

type BannerTone = 'offline' | 'syncing' | 'pending' | 'success' | 'partial';

/**
 * Aviso compacto de modo offline + resultado de sincronización.
 * Tras un sync completo muestra mensaje verde temporal; si hay fallos,
 * resume cuántos fallaron y el motivo breve con opción de reintentar/descartar.
 */
export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const pending = await getOfflineRequests();
      setPendingCount(pending.length);
      if (pending.length === 0 && !lastResult) setDismissed(false);
    } catch {
      // ignore: IndexedDB no disponible
    }
  }, [lastResult]);

  const applySyncResult = useCallback((result: SyncResult) => {
    setLastResult(result);
    setSyncProgress(null);
    if (successTimer.current) clearTimeout(successTimer.current);
    // Éxito total: toast verde y se oculta solo
    if (result.synced > 0 && result.failed === 0 && result.discarded === 0) {
      successTimer.current = setTimeout(() => {
        setLastResult(null);
      }, 4500);
    }
  }, []);

  const runSync = useCallback(async () => {
    setIsSyncing(true);
    setLastResult(null);
    try {
      const pending = await getOfflineRequests();
      setSyncProgress({ done: 0, total: pending.length });
      const result = await syncOfflineQueue();
      applySyncResult(result);
      await refreshCount();
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [applySyncResult, refreshCount]);

  useEffect(() => {
    refreshCount();

    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
      setLastResult(null);
      refreshCount();
    };
    const handleOnline = () => {
      setIsOnline(true);
      void runSync();
    };
    const handleSyncDone = (ev: Event) => {
      const detail = (ev as CustomEvent<SyncResult>).detail;
      if (detail) applySyncResult(detail);
      refreshCount();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('fiix-offline-sync-done', handleSyncDone);

    const interval = setInterval(refreshCount, 10000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('fiix-offline-sync-done', handleSyncDone);
      clearInterval(interval);
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, [refreshCount, runSync, applySyncResult]);

  const handleClear = async () => {
    if (
      !window.confirm(
        `¿Descartar ${pendingCount} cambio(s) pendiente(s)? No se enviarán al servidor.`
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      await clearOfflineQueue();
      setPendingCount(0);
      setDismissed(false);
      setLastResult(null);
    } finally {
      setClearing(false);
    }
  };

  const handleRetrySync = () => {
    void runSync();
  };

  const briefFailure = lastResult?.failures?.[0]?.reason;

  let tone: BannerTone = 'offline';
  let label = '';

  if (!isOnline) {
    tone = 'offline';
    label =
      pendingCount > 0
        ? `Sin conexión · ${pendingCount} cambio${pendingCount === 1 ? '' : 's'} en espera`
        : 'Sin conexión (Guardando localmente)';
  } else if (isSyncing) {
    tone = 'syncing';
    const total = syncProgress?.total ?? pendingCount;
    label =
      total > 0
        ? `Sincronizando ${total} cambio${total === 1 ? '' : 's'}…`
        : 'Sincronizando…';
  } else if (
    lastResult &&
    lastResult.synced > 0 &&
    lastResult.failed === 0 &&
    lastResult.discarded === 0
  ) {
    tone = 'success';
    label = `Sincronización completa (${lastResult.synced} cambio${lastResult.synced === 1 ? '' : 's'})`;
  } else if (lastResult && (lastResult.failed > 0 || lastResult.discarded > 0)) {
    tone = 'partial';
    const failedTotal = lastResult.failed + lastResult.discarded;
    const withPhotos = lastResult.failures.filter((f) =>
      /foto|multipart|imagen|conflicto \(409\)/i.test(f.reason)
    ).length;
    const photoHint =
      withPhotos > 0
        ? ` (${withPhotos} con fotos/conflicto — revisa el detalle)`
        : '';
    label = `${lastResult.synced} sincronizado${lastResult.synced === 1 ? '' : 's'}, ${failedTotal} fallaron${
      briefFailure ? `: ${briefFailure}` : ''
    }${photoHint}`;
  } else if (pendingCount > 0) {
    tone = 'pending';
    label = `${pendingCount} cambio${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`;
  }

  const showSuccessOnly = tone === 'success';
  const showPartial = tone === 'partial';

  if (isOnline && pendingCount === 0 && !showSuccessOnly && !showPartial && !isSyncing) return null;
  if (isOnline && pendingCount > 0 && dismissed && !showPartial && !isSyncing) return null;

  const toneClass =
    tone === 'offline'
      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
      : tone === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
        : tone === 'partial'
          ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';

  return (
    <div
      className={`flex max-w-xl items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm ${toneClass}`}
      title={
        tone === 'partial' && lastResult?.failures?.length
          ? lastResult.failures.map((f) => f.reason).join(' · ')
          : tone === 'offline'
            ? 'Sin conexión: los cambios se guardan en este dispositivo'
            : 'Cambios guardados sin conexión pendientes de enviar'
      }
    >
      {tone === 'offline' ? (
        <WifiOff size={14} />
      ) : tone === 'success' ? (
        <CheckCircle2 size={14} />
      ) : tone === 'partial' ? (
        <AlertTriangle size={14} />
      ) : (
        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
      )}
      <span className="min-w-0 truncate">{label}</span>
      {isOnline && (pendingCount > 0 || showPartial) && !isSyncing && (
        <button
          type="button"
          onClick={handleRetrySync}
          className="shrink-0 text-xs font-bold underline hover:opacity-80"
        >
          Reintentar
        </button>
      )}
      {(pendingCount > 0 || (showPartial && (lastResult?.failed || 0) > 0)) && (
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-bold hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
          title="Descartar cola offline"
        >
          <Trash2 size={12} />
          Descartar
        </button>
      )}
      {isOnline && (pendingCount > 0 || showPartial) && !isSyncing && (
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            setLastResult(null);
          }}
          className="shrink-0 rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10"
          title="Ocultar aviso"
          aria-label="Ocultar aviso"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
