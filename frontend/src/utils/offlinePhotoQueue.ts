import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'fiix-offline-photos';
const STORE_NAME = 'photo-blobs';
const DB_VERSION = 1;

export type OfflinePhotoBlob = {
  key: string;
  blob: Blob;
  name: string;
  type: string;
  createdAt: string;
};

interface FiixOfflinePhotosDB extends DBSchema {
  'photo-blobs': {
    key: string;
    value: OfflinePhotoBlob;
  };
}

let dbPromise: Promise<IDBPDatabase<FiixOfflinePhotosDB>> | null = null;

async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FiixOfflinePhotosDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function putOfflinePhotoBlob(
  key: string,
  file: File | Blob,
  name: string,
  type: string
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, {
    key,
    blob: file,
    name,
    type: type || (file as File).type || 'application/octet-stream',
    createdAt: new Date().toISOString(),
  });
}

export async function getOfflinePhotoBlob(key: string): Promise<OfflinePhotoBlob | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, key);
}

export async function removeOfflinePhotoBlob(key: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, key);
}

export async function removeOfflinePhotoBlobs(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => removeOfflinePhotoBlob(k)));
}

/** Marcador en la cola JSON para reconstruir FormData al sincronizar. */
export type OfflineMultipartBody = {
  __fiixMultipart: true;
  fields: Record<string, string>;
  files: Array<{ field: string; blobKey: string; name: string; type: string }>;
};

export function isOfflineMultipartBody(body: unknown): body is OfflineMultipartBody {
  return (
    !!body &&
    typeof body === 'object' &&
    (body as OfflineMultipartBody).__fiixMultipart === true &&
    Array.isArray((body as OfflineMultipartBody).files)
  );
}
