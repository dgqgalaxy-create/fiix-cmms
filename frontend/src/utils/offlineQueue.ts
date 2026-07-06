import { openDB } from 'idb';

const DB_NAME = 'fiix-offline-db';
const STORE_NAME = 'requests-queue';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function addOfflineRequest(url: string, method: string, headers: any, body: any) {
  const db = await getDB();
  await db.add(STORE_NAME, {
    url,
    method,
    headers,
    body,
    timestamp: new Date().toISOString(),
  });
}

export async function getOfflineRequests() {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function removeOfflineRequest(id: number) {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
