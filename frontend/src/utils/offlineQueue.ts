import { jwtDecode } from 'jwt-decode';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { clearAllOfflinePhotoBlobs, isOfflineMultipartBody, removeOfflinePhotoBlobs } from './offlinePhotoQueue';

const DB_NAME = 'fiix-offline-db';
const STORE_NAME = 'requests-queue';
const DB_VERSION = 3;

export type OfflineQueuedRequest = {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: string;
  retries: number;
  /** Id del usuario que creó la petición (separación por usuario en bandeja y sync). */
  userId?: string;
  /**
   * true = en la BANDEJA de pendientes: falló y se conserva (con sus fotos) para
   * reintento/descartes manuales. Nunca se borra automáticamente.
   */
  parked?: boolean;
  /** Último motivo de fallo (visible en la bandeja). */
  lastError?: string;
};

interface FiixOfflineDB extends DBSchema {
  'requests-queue': {
    key: number;
    value: OfflineQueuedRequest;
    indexes: Record<string, never>;
  };
}

let dbPromise: Promise<IDBPDatabase<FiixOfflineDB>> | null = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FiixOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

/** Id del usuario autenticado para etiquetar/separar la cola offline. */
export function getOfflineUserId(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  try {
    const decoded = jwtDecode<{ userId?: string }>(token);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

function normalize(entry: OfflineQueuedRequest): OfflineQueuedRequest & { id: number } {
  return {
    ...entry,
    id: entry.id as number,
    retries: typeof entry.retries === 'number' ? entry.retries : 0,
    headers: entry.headers && typeof entry.headers === 'object' ? entry.headers : {},
    userId: typeof entry.userId === 'string' ? entry.userId : undefined,
    parked: entry.parked === true,
    lastError: typeof entry.lastError === 'string' ? entry.lastError : undefined,
  };
}

export async function addOfflineRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: unknown
) {
  const db = await getDB();
  await db.add(STORE_NAME, {
    url,
    method: method.toUpperCase(),
    headers: headers || {},
    body,
    timestamp: new Date().toISOString(),
    retries: 0,
    userId: getOfflineUserId() ?? undefined,
    parked: false,
    lastError: undefined,
  });
}

export async function getOfflineRequests(): Promise<Array<OfflineQueuedRequest & { id: number }>> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.map(normalize);
}

export async function removeOfflineRequest(id: number) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function setOfflineRequestRetries(id: number, retries: number) {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) return;
  await db.put(STORE_NAME, { ...normalize(existing), retries });
}

/** Guarda en BANDEJA una petición que falló: se conserva (con fotos) para acción manual. */
export async function parkOfflineRequest(id: number, lastError: string) {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) return;
  await db.put(STORE_NAME, {
    ...normalize(existing),
    parked: true,
    lastError: lastError.slice(0, 500),
  });
}

/** Saca de la bandeja una petición (reintento manual): vuelve a intentarse en el próximo sync. */
export async function unparkOfflineRequest(id: number) {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (!existing) return;
  await db.put(STORE_NAME, { ...normalize(existing), parked: false, retries: 0, lastError: undefined });
}

/** Descarte EXPLÍCITO (botón de la bandeja): elimina la petición y sus fotos asociadas. */
export async function discardOfflineRequest(id: number) {
  const db = await getDB();
  const existing = await db.get(STORE_NAME, id);
  if (existing && isOfflineMultipartBody(existing.body)) {
    await removeOfflinePhotoBlobs(existing.body.files.map((f) => f.blobKey));
  }
  await db.delete(STORE_NAME, id);
}

/** Solo peticiones de este usuario (o heredadas sin dueño) para no mezclar dispositivos compartidos. */
export function scopeOfflineRequests(
  list: Array<OfflineQueuedRequest & { id: number }>,
  userId: string | null
): Array<OfflineQueuedRequest & { id: number }> {
  if (!userId) return [];
  return list.filter((r) => !r.userId || r.userId === userId);
}

/** Bandeja de pendientes: peticiones fallidas conservadas para revisión/reintento manual. */
export function filterParked(list: Array<OfflineQueuedRequest & { id: number }>) {
  return list.filter((r) => r.parked === true);
}

export type OfflineOverview = {
  /** Cambios del usuario listos para reintento automático. */
  pending: number;
  /** Cambios del usuario conservados en la bandeja (fallaron; requieren decisión). */
  parked: number;
  /** De los conservados, cuántos llevan fotos (evidencia recuperable). */
  parkedWithPhotos: number;
};

/** Resumen de la cola del usuario actual (separación por usuario). */
export async function getOfflineOverview(): Promise<OfflineOverview> {
  const my = scopeOfflineRequests(await getOfflineRequests(), getOfflineUserId());
  const parkedArr = my.filter((r) => r.parked === true);
  const parkedWithPhotos = parkedArr.filter((r) => isOfflineMultipartBody(r.body)).length;
  return {
    pending: my.length - parkedArr.length,
    parked: parkedArr.length,
    parkedWithPhotos,
  };
}

/** Bandeja del usuario actual con sus fotos (para la UI de pendientes). */
export async function getMyParkedRequests(): Promise<Array<OfflineQueuedRequest & { id: number }>> {
  const my = scopeOfflineRequests(await getOfflineRequests(), getOfflineUserId());
  return my.filter((r) => r.parked === true);
}

/** Vacía toda la cola offline (IndexedDB) y limpia blobs de fotos asociados (acción explícita). */
export async function clearOfflineQueue(): Promise<number> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  const count = all.length;
  for (const entry of all) {
    if (isOfflineMultipartBody(entry.body)) {
      await removeOfflinePhotoBlobs(entry.body.files.map((f) => f.blobKey));
    }
  }
  await db.clear(STORE_NAME);
  // Seguridad: limpia cualquier blob huérfano restante.
  await clearAllOfflinePhotoBlobs();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fiix-offline-sync-done'));
  }
  return count;
}
