import { bareAxios } from '../api/axios';
import {
  getOfflineRequests,
  removeOfflineRequest,
  setOfflineRequestRetries,
  parkOfflineRequest,
  scopeOfflineRequests,
  getOfflineUserId,
  type OfflineQueuedRequest,
} from './offlineQueue';
import {
  getOfflinePhotoBlob,
  isOfflineMultipartBody,
  removeOfflinePhotoBlobs,
} from './offlinePhotoQueue';

export const MAX_OFFLINE_SYNC_RETRIES = 5;

type QueuedItem = OfflineQueuedRequest & { id: number };

export type SyncFailureReason = {
  id: number;
  method: string;
  url: string;
  reason: string;
  status?: number;
};

export type SyncResult = {
  synced: number;
  failed: number;
  /** Peticiones que pasaron a la BANDEJA de pendientes (se conservan con sus fotos). */
  parked: number;
  failures: SyncFailureReason[];
};

let syncInFlight: Promise<SyncResult> | null = null;

function notifySyncDone(detail?: SyncResult) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('fiix-offline-sync-done', { detail }));
  }
}

function reasonFromError(error: unknown): { reason: string; status?: number } {
  const ax = error as {
    response?: { status?: number; data?: { error?: string; message?: string } };
    message?: string;
    code?: string;
  };
  const status = ax?.response?.status;
  if (status === 401 || status === 403) {
    return { reason: 'sesión expirada o sin permiso (401/403)', status };
  }
  if (status === 409) {
    return {
      reason:
        'conflicto (409): otro usuario ya cambió el registro; si había fotos offline, no se subieron',
      status,
    };
  }
  if (status === 404) {
    return { reason: 'recurso no encontrado (404)', status };
  }
  if (status && status >= 400 && status < 500) {
    const msg = ax.response?.data?.error || ax.response?.data?.message;
    return { reason: msg ? `HTTP ${status}: ${msg}` : `petición rechazada (HTTP ${status})`, status };
  }
  if (status && status >= 500) {
    return { reason: `error del servidor (HTTP ${status})`, status };
  }
  if (!navigator.onLine || ax?.code === 'ERR_NETWORK') {
    return { reason: 'sin red / timeout' };
  }
  return { reason: ax?.message || 'error de red' };
}

/**
 * Reproduce la cola IndexedDB en segundo plano SOLO del usuario actual.
 *
 * Reglas de conservación de evidencia (fotos):
 * - 2xx → elimina la petición y limpia sus fotos (ya entregadas).
 * - Cualquier fallo (red, 5xx, 4xx, sesión) NUNCA elimina la petición ni sus fotos:
 *   pasa a la BANDEJA de pendientes (parked) para reintento o descarte MANUAL.
 * - Los reintentos automáticos solo ocurren mientras quedan intentos (MAX); al llegar
 *   al límite la petición también se conserva en la bandeja (no se descarta).
 */
export async function syncOfflineQueue(): Promise<SyncResult> {
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    let synced = 0;
    let failed = 0;
    let parked = 0;
    const failures: SyncFailureReason[] = [];

    if (!navigator.onLine) {
      return { synced, failed, parked, failures };
    }

    const myRequests = scopeOfflineRequests(await getOfflineRequests(), getOfflineUserId());
    const requests = myRequests.filter((r) => !r.parked);

    for (const req of requests) {
      try {
        await replayRequest(req);
        await removeOfflineRequest(req.id);
        synced += 1;
      } catch (error: unknown) {
        const { reason, status } = reasonFromError(error);

        // Sesión (401/403): reintentar hasta el tope; después → bandeja (conservada).
        if (status === 401 || status === 403) {
          const nextRetries = (req.retries || 0) + 1;
          if (nextRetries >= MAX_OFFLINE_SYNC_RETRIES) {
            await parkOfflineRequest(
              req.id,
              `${reason} (tras ${nextRetries} intentos; conservado en pendientes — inicia sesión y reintenta)`
            );
            parked += 1;
            failures.push({
              id: req.id,
              method: req.method,
              url: req.url,
              reason: `${reason} (conservado en pendientes — inicia sesión y reintenta)`,
              status,
            });
          } else {
            await setOfflineRequestRetries(req.id, nextRetries);
            failed += 1;
            failures.push({
              id: req.id,
              method: req.method,
              url: req.url,
              reason: `${reason} (intento ${nextRetries}/${MAX_OFFLINE_SYNC_RETRIES})`,
              status,
            });
          }
          continue;
        }

        // 4xx (validación, conflicto, no encontrado): no reintentar en automático,
        // pero CONSERVAR en la bandeja (con fotos) para decisión manual.
        if (status && status >= 400 && status < 500) {
          await parkOfflineRequest(
            req.id,
            `${reason} (conservado en pendientes — revisa o descarta manualmente)`
          );
          parked += 1;
          failures.push({
            id: req.id,
            method: req.method,
            url: req.url,
            reason: `${reason} (conservado en pendientes, no se descartó)`,
            status,
          });
          console.warn(`[OfflineSync] En bandeja ${req.id} por HTTP ${status}: ${req.method} ${req.url}`);
          continue;
        }

        // Red / 5xx: reintentar hasta el tope; después → bandeja (conservada).
        const nextRetries = (req.retries || 0) + 1;
        if (nextRetries >= MAX_OFFLINE_SYNC_RETRIES) {
          await parkOfflineRequest(req.id, `${reason} (tras ${nextRetries} intentos; conservado en pendientes)`);
          parked += 1;
          failures.push({
            id: req.id,
            method: req.method,
            url: req.url,
            reason: `${reason} (conservado en pendientes tras ${nextRetries} intentos)`,
            status,
          });
          console.warn(`[OfflineSync] En bandeja ${req.id} tras ${nextRetries} intentos: ${req.method} ${req.url}`);
        } else {
          await setOfflineRequestRetries(req.id, nextRetries);
          failed += 1;
          failures.push({
            id: req.id,
            method: req.method,
            url: req.url,
            reason: `${reason} (reintento ${nextRetries}/${MAX_OFFLINE_SYNC_RETRIES})`,
            status,
          });
          console.error(`[OfflineSync] Falló ${req.id} (intento ${nextRetries})`, error);
        }
      }
    }

    const result = { synced, failed, parked, failures };
    notifySyncDone(result);
    return result;
  })().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

async function rebuildMultipart(body: {
  fields: Record<string, string>;
  files: Array<{ field: string; blobKey: string; name: string; type: string }>;
}): Promise<FormData> {
  const formData = new FormData();
  for (const [k, v] of Object.entries(body.fields || {})) {
    if (v != null && v !== '') formData.append(k, v);
  }
  for (const fileMeta of body.files) {
    const stored = await getOfflinePhotoBlob(fileMeta.blobKey);
    if (!stored) {
      throw Object.assign(new Error(`Foto offline no encontrada: ${fileMeta.blobKey}`), {
        response: { status: 400 },
      });
    }
    formData.append(
      fileMeta.field,
      new File([stored.blob], fileMeta.name || stored.name, {
        type: fileMeta.type || stored.type,
      })
    );
  }
  return formData;
}

async function replayRequest(req: QueuedItem) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { ...(req.headers || {}) };

  // Auth actual: el token guardado en la cola puede estar vencido.
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let data: unknown = req.body;
  let blobKeysToClean: string[] = [];

  if (isOfflineMultipartBody(req.body)) {
    data = await rebuildMultipart(req.body);
    blobKeysToClean = req.body.files.map((f) => f.blobKey);
    // Dejar que el navegador ponga multipart boundary.
    delete headers['Content-Type'];
    delete headers['content-type'];
  } else if (req.body && typeof req.body === 'object' && !(req.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  // Quitar cabeceras que Axios/navegador no deben reenviar tal cual.
  delete headers['Content-Length'];
  delete headers['content-length'];

  await bareAxios({
    url: req.url,
    method: req.method,
    headers,
    data,
    timeout: 120000,
    validateStatus: (s) => s >= 200 && s < 300,
  });

  if (blobKeysToClean.length > 0) {
    await removeOfflinePhotoBlobs(blobKeysToClean);
  }
}
