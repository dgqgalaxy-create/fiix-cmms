import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { clearAllOfflinePhotoBlobs, isOfflineMultipartBody, removeOfflinePhotoBlobs } from './offlinePhotoQueue';

const DB_NAME = 'fiix-offline-db';
const STORE_NAME = 'requests-queue';
const DB_VERSION = 2;

export type OfflineQueuedRequest = {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: string;
  retries: number;
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

function normalize(entry: OfflineQueuedRequest): OfflineQueuedRequest & { id: number } {
  return {
    ...entry,
    id: entry.id as number,
    retries: typeof entry.retries === 'number' ? entry.retries : 0,
    headers: entry.headers && typeof entry.headers === 'object' ? entry.headers : {},
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

/** Vacía toda la cola offline (IndexedDB) y limpia blobs de fotos asociados. */
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
