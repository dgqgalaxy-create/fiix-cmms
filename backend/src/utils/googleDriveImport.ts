import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType?: string;
}

export interface DriveDownloadResult {
  dir: string;
  filesDownloaded: number;
  filesListed: number;
  skipped: number;
  errors: string[];
}

/** Extrae el ID de carpeta desde URL de Drive o devuelve el string si ya es un ID. */
export function extractDriveFolderId(raw?: string | null): string | null {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t) return null;
  const fromUrl = t.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(t)) return t;
  return null;
}

export function getDriveApiKey(): string | null {
  const k = process.env.GOOGLE_DRIVE_API_KEY?.trim();
  return k || null;
}

export function getDriveItemsFolderId(): string | null {
  return extractDriveFolderId(process.env.GOOGLE_DRIVE_ITEMS_FOLDER);
}

export function getDriveWoFolderId(): string | null {
  return extractDriveFolderId(process.env.GOOGLE_DRIVE_WO_FOLDER);
}

function driveHttpsJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Drive API HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

/**
 * Lista archivos (no carpetas) en una carpeta pública de Drive.
 * Requiere API key; la carpeta debe ser «Cualquiera con el enlace».
 */
export async function listPublicDriveFolderFiles(
  folderId: string,
  apiKey: string
): Promise<DriveFileMeta[]> {
  const files: DriveFileMeta[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
      key: apiKey,
      pageSize: '1000',
      fields: 'nextPageToken, files(id, name, mimeType)',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const data = await driveHttpsJson(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`
    );
    for (const f of data.files || []) {
      if (!f?.id || !f?.name) continue;
      files.push({ id: f.id, name: f.name, mimeType: f.mimeType });
    }
    pageToken = data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

/** Quita prefijo "Image " que a veces aparece en nombres de Drive. */
export function normalizeDriveImageFilename(name: string): string {
  return name.replace(/^Image\s+/i, '').trim();
}

function downloadDriveFileToPath(fileId: string, apiKey: string, destPath: string): Promise<void> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;

  return new Promise((resolve, reject) => {
    const follow = (currentUrl: string, redirectsLeft: number) => {
      const lib = currentUrl.startsWith('http://') ? http : https;
      lib
        .get(currentUrl, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            follow(res.headers.location, redirectsLeft - 1);
            return;
          }
          if (!res.statusCode || res.statusCode >= 400) {
            const chunks: Buffer[] = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
              reject(
                new Error(
                  `Download HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`
                )
              );
            });
            return;
          }
          const out = fs.createWriteStream(destPath);
          res.pipe(out);
          out.on('finish', () => {
            out.close();
            resolve();
          });
          out.on('error', reject);
        })
        .on('error', reject);
    };
    follow(url, 5);
  });
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Descarga todas las imágenes de una carpeta pública de Drive a un directorio temporal.
 * El caller debe borrar `dir` al terminar (rm recursive).
 */
export async function downloadPublicDriveFolderToTemp(
  folderId: string,
  apiKey: string,
  label = 'drive'
): Promise<DriveDownloadResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fiix-${label}-`));
  const errors: string[] = [];
  let filesDownloaded = 0;
  let skipped = 0;

  const listed = await listPublicDriveFolderFiles(folderId, apiKey);
  const imageLike = listed.filter((f) => {
    const n = normalizeDriveImageFilename(f.name);
    return /\.(jpe?g|png|webp|gif)$/i.test(n);
  });

  await mapPool(imageLike, 4, async (file) => {
    const safeName = normalizeDriveImageFilename(file.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    if (!safeName) {
      skipped++;
      return;
    }
    const dest = path.join(dir, safeName);
    try {
      await downloadDriveFileToPath(file.id, apiKey, dest);
      filesDownloaded++;
    } catch (e: any) {
      skipped++;
      errors.push(`${safeName}: ${e?.message || e}`);
      try {
        fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
    }
  });

  return {
    dir,
    filesDownloaded,
    filesListed: listed.length,
    skipped,
    errors: errors.slice(0, 20),
  };
}

export function rmTempDirSafe(dir: string | null | undefined): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
