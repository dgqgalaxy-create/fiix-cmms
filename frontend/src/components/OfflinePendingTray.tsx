import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Camera, RefreshCw, Trash2, X } from 'lucide-react';
import {
  getMyParkedRequests,
  unparkOfflineRequest,
  discardOfflineRequest,
  getOfflineOverview,
  type OfflineQueuedRequest,
} from '../utils/offlineQueue';
import { syncOfflineQueue } from '../utils/offlineSync';
import { getOfflinePhotoBlob, isOfflineMultipartBody } from '../utils/offlinePhotoQueue';

type ParkedItem = OfflineQueuedRequest & { id: number };

function shortMethod(m: string) {
  return (m || '?').toUpperCase();
}

/** Miniaturas de las fotos conservadas de una petición (evidencia recuperable). */
function PhotoThumbs({ body }: { body: unknown }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const created: string[] = [];
    (async () => {
      if (!isOfflineMultipartBody(body)) return;
      const blobs = await Promise.all(
        body.files.slice(0, 3).map((f) => getOfflinePhotoBlob(f.blobKey))
      );
      if (!alive) return;
      const next = blobs
        .filter((b): b is NonNullable<typeof b> => !!b)
        .map((b) => URL.createObjectURL(b.blob));
      created.push(...next);
      setUrls(next);
    })();
    return () => {
      alive = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  if (urls.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400">
        <Camera size={12} /> sin fotos
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {urls.map((u) => (
        <img
          key={u}
          src={u}
          alt="Evidencia offline"
          className="h-9 w-9 rounded border border-slate-200 object-cover dark:border-slate-700"
        />
      ))}
    </span>
  );
}

/**
 * Bandeja de pendientes offline: cambios que fallaron y fueron CONSERVADOS (con sus
 * fotos) para reintento o descarte manual. Nunca se pierden solos.
 */
export const OfflinePendingTray = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [items, setItems] = useState<ParkedItem[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setItems(await getMyParkedRequests());
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void reload();
    }
  }, [open, reload]);

  if (!open) return null;

  const refreshCounts = async () => {
    try {
      await getOfflineOverview();
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fiix-offline-sync-done'));
    }
  };

  const handleRetry = async (item: ParkedItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      await unparkOfflineRequest(item.id);
      const result = await syncOfflineQueue();
      if (result.failed === 0 && result.parked === 0) {
        await reload();
      } else {
        await reload();
      }
    } catch (e) {
      setError('No se pudo reintentar en este momento.');
      console.error(e);
    } finally {
      setBusyId(null);
      await refreshCounts();
    }
  };

  const handleRetryAll = async () => {
    setBusyAll(true);
    setError(null);
    try {
      for (const item of items) {
        await unparkOfflineRequest(item.id);
      }
      await syncOfflineQueue();
      await reload();
    } catch (e) {
      setError('No se pudieron reintentar todos los pendientes.');
      console.error(e);
    } finally {
      setBusyAll(false);
      await refreshCounts();
    }
  };

  const handleDiscard = async (item: ParkedItem) => {
    const label = isOfflineMultipartBody(item.body)
      ? `¿Descartar este cambio pendiente y SUS FOTOS asociadas? No se enviarán al servidor.`
      : `¿Descartar este cambio pendiente? No se enviará al servidor.`;
    if (!window.confirm(label)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await discardOfflineRequest(item.id);
      await reload();
    } catch (e) {
      setError('No se pudo descartar el elemento.');
      console.error(e);
    } finally {
      setBusyId(null);
      await refreshCounts();
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(`¿Descartar TODOS (${items.length}) los pendientes fallidos y sus fotos?`)) return;
    setBusyAll(true);
    setError(null);
    try {
      for (const item of items) {
        await discardOfflineRequest(item.id);
      }
      await reload();
    } catch (e) {
      setError('No se pudo vaciar la bandeja.');
      console.error(e);
    } finally {
      setBusyAll(false);
      await refreshCounts();
    }
  };

  const photoCount = (item: ParkedItem) =>
    isOfflineMultipartBody(item.body) ? item.body.files.length : 0;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Pendientes offline"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle size={16} className="text-amber-500" />
            Pendientes offline ({items.length})
            <span className="hidden text-xs font-normal text-slate-400 sm:inline">
              — conservados, no se pierden
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {error && (
            <p className="mb-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
              {error}
            </p>
          )}
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No hay pendientes fallidos. Todo sincronizado ✔
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        <span className="rounded bg-slate-200 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-700">
                          {shortMethod(item.method)}
                        </span>{' '}
                        <span className="font-normal text-slate-500">{item.url}</span>
                      </p>
                      {item.lastError && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {item.lastError}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {new Date(item.timestamp).toLocaleString()} · {photoCount(item)} foto
                        {photoCount(item) === 1 ? '' : 's'}
                      </p>
                    </div>
                    <PhotoThumbs body={item.body} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.id || busyAll}
                      onClick={() => void handleRetry(item)}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={busyId === item.id ? 'animate-spin' : undefined} />
                      Reintentar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id || busyAll}
                      onClick={() => void handleDiscard(item)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                    >
                      <Trash2 size={11} />
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <button
              type="button"
              disabled={busyAll}
              onClick={() => void handleClearAll}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
            >
              <Trash2 size={12} />
              Vaciar bandeja
            </button>
            <button
              type="button"
              disabled={busyAll}
              onClick={() => void handleRetryAll()}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <RefreshCw size={12} className={busyAll ? 'animate-spin' : undefined} />
              Reintentar todos
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
