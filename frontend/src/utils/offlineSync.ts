import { bareAxios } from '../api/axios';
import {
  getOfflineRequests,
  removeOfflineRequest,
  setOfflineRequestRetries,
  type OfflineQueuedRequest,
} from './offlineQueue';

export const MAX_OFFLINE_SYNC_RETRIES = 5;

type QueuedItem = OfflineQueuedRequest & { id: number };

let syncInFlight: Promise<{ synced: number; failed: number; discarded: number }> | null = null;

function notifySyncDone() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fiix-offline-sync-done'));
  }
}

/**
 * Reproduce la cola IndexedDB en segundo plano.
 * - Usa bareAxios (sin interceptores) para no re-encolar.
 * - 2xx → elimina.
 * - 4xx → elimina (petición inválida / ya no aplicable).
 * - Red / 5xx → incrementa retries; tras MAX descarta.
 */
export async function syncOfflineQueue(): Promise<{
  synced: number;
  failed: number;
  discarded: number;
}> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    let synced = 0;
    let failed = 0;
    let discarded = 0;

    if (!navigator.onLine) {
      return { synced, failed, discarded };
    }

    const requests = await getOfflineRequests();
    for (const req of requests) {
      try {
        await replayRequest(req);
        await removeOfflineRequest(req.id);
        synced += 1;
      } catch (error: unknown) {
        const ax = error as { response?: { status?: number } };
        const status = ax?.response?.status;

        // 4xx: no tiene sentido reintentar (URL mala, 401/403/404/409, validación).
        if (status && status >= 400 && status < 500) {
          await removeOfflineRequest(req.id);
          discarded += 1;
          console.warn(`[OfflineSync] Descartado ${req.id} por HTTP ${status}: ${req.method} ${req.url}`);
          continue;
        }

        const nextRetries = (req.retries || 0) + 1;
        if (nextRetries >= MAX_OFFLINE_SYNC_RETRIES) {
          await removeOfflineRequest(req.id);
          discarded += 1;
          console.warn(
            `[OfflineSync] Descartado ${req.id} tras ${nextRetries} intentos: ${req.method} ${req.url}`
          );
        } else {
          await setOfflineRequestRetries(req.id, nextRetries);
          failed += 1;
          console.error(`[OfflineSync] Falló ${req.id} (intento ${nextRetries})`, error);
        }
      }
    }

    notifySyncDone();
    return { synced, failed, discarded };
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

async function replayRequest(req: QueuedItem) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { ...(req.headers || {}) };

  // Auth actual: el token guardado en la cola puede estar vencido.
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (req.body && typeof req.body === 'object' && !(req.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  // Quitar cabeceras que Axios/navegador no deben reenviar tal cual.
  delete headers['Content-Length'];
  delete headers['content-length'];

  await bareAxios({
    url: req.url,
    method: req.method,
    headers,
    data: req.body,
    timeout: 30000,
    validateStatus: (s) => s >= 200 && s < 300,
  });
}
