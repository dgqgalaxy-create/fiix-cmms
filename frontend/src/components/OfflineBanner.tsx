import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { getOfflineRequests } from '../utils/offlineQueue';

/**
 * Aviso compacto de modo offline: se muestra si no hay conexión o si aún
 * quedan peticiones pendientes de sincronizar (aceptar/pausar/finalizar OT, etc.).
 */
export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const pending = await getOfflineRequests();
      setPendingCount(pending.length);
    } catch {
      // ignore: IndexedDB no disponible
    }
  }, []);

  useEffect(() => {
    refreshCount();

    const handleOffline = () => {
      setIsOnline(false);
      refreshCount();
    };
    const handleOnline = () => {
      setIsOnline(true);
      refreshCount();
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

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm text-sm font-medium border ${
        isOnline
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse'
          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 animate-pulse'
      }`}
      title={isOnline ? 'Sincronizando cambios guardados sin conexión' : 'Sin conexión: los cambios se guardan en este dispositivo'}
    >
      {isOnline ? <RefreshCw size={14} /> : <WifiOff size={14} />}
      {isOnline
        ? `Sincronizando ${pendingCount} cambio${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}...`
        : pendingCount > 0
        ? `Sin conexión · ${pendingCount} cambio${pendingCount === 1 ? '' : 's'} en espera`
        : 'Sin conexión (Guardando localmente)'}
    </div>
  );
};
