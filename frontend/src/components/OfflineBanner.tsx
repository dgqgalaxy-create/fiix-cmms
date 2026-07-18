import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw, Trash2, X } from 'lucide-react';
import { getOfflineRequests, clearOfflineQueue } from '../utils/offlineQueue';
import { syncOfflineQueue } from '../utils/offlineSync';

/**
 * Aviso compacto de modo offline: se muestra si no hay conexión o si aún
 * quedan peticiones pendientes de sincronizar (aceptar/pausar/finalizar OT, etc.).
 * No bloquea la UI ni las listas; la cola se sincroniza en segundo plano.
 */
export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const pending = await getOfflineRequests();
      setPendingCount(pending.length);
      if (pending.length === 0) setDismissed(false);
    } catch {
      // ignore: IndexedDB no disponible
    }
  }, []);

  useEffect(() => {
    refreshCount();

    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
      refreshCount();
    };
    const handleOnline = () => {
      setIsOnline(true);
      refreshCount();
      setIsSyncing(true);
      void syncOfflineQueue().finally(() => {
        setIsSyncing(false);
        refreshCount();
      });
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('fiix-offline-sync-done', refreshCount);

    const interval = setInterval(refreshCount, 10000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('fiix-offline-sync-done', refreshCount);
      clearInterval(interval);
    };
  }, [refreshCount]);

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
    } finally {
      setClearing(false);
    }
  };

  const handleRetrySync = () => {
    setIsSyncing(true);
    void syncOfflineQueue().finally(() => {
      setIsSyncing(false);
      refreshCount();
    });
  };

  if (isOnline && pendingCount === 0) return null;
  if (isOnline && pendingCount > 0 && dismissed) return null;

  const label = !isOnline
    ? pendingCount > 0
      ? `Sin conexión · ${pendingCount} cambio${pendingCount === 1 ? '' : 's'} en espera`
      : 'Sin conexión (Guardando localmente)'
    : isSyncing
      ? `Sincronizando ${pendingCount} cambio${pendingCount === 1 ? '' : 's'}...`
      : `${pendingCount} cambio${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm text-sm font-medium border ${
        isOnline
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
      }`}
      title={
        isOnline
          ? 'Cambios guardados sin conexión pendientes de enviar'
          : 'Sin conexión: los cambios se guardan en este dispositivo'
      }
    >
      {isOnline ? (
        <RefreshCw size={14} className={isSyncing ? 'animate-spin' : undefined} />
      ) : (
        <WifiOff size={14} />
      )}
      <span>{label}</span>
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          type="button"
          onClick={handleRetrySync}
          className="underline text-xs font-bold hover:opacity-80"
        >
          Reintentar
        </button>
      )}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
          title="Descartar cola offline"
        >
          <Trash2 size={12} />
          Descartar
        </button>
      )}
      {isOnline && pendingCount > 0 && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10"
          title="Ocultar aviso"
          aria-label="Ocultar aviso"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
