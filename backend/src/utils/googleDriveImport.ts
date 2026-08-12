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

export type DriveDownloadProgress = {
  stage: 'list' | 'download';
  label: string;
  listed: number;
  downloaded: number;
  total: number;
  skipped?: number;
  lastError?: string;
};

const LIST_TIMEOUT_MS = 90_000;
/** Si no hay datos en este tiempo, abortar (antes 180s dejaba la UI en 0/N mucho rato). */
const DOWNLOAD_TIMEOUT_MS = 60_000;
const DOWNLOAD_CONCURRENCY = 3;
/** Si los primeros N fallan seguidos, cortar: key/permisos/red mal — no quemar horas. */
const EARLY_ABORT_AFTER_FAILURES = 12;

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

function driveHttpsJson(url: string, timeoutMs = LIST_TIMEOUT_MS): Promise<any> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (err?: Error, data?: any) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(data);
    };
    const req = https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode && res.statusCode >= 400) {
          settle(new Error(`Drive API HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          return;
        }
        try {
          settle(undefined, JSON.parse(body));
        } catch (e) {
          settle(e instanceof Error ? e : new Error(String(e)));
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      settle(new Error(`Drive API timeout (${Math.round(timeoutMs / 1000)}s) al listar`));
    });
    req.on('error', (e) => settle(e instanceof Error ? e : new Error(String(e))));
  });
}

/**
 * Lista archivos (no carpetas) en una carpeta pública de Drive.
 * Requiere API key; la carpeta debe ser «Cualquiera con el enlace».
 */
export async function listPublicDriveFolderFiles(
  folderId: string,
  apiKey: string,
  onPage?: (listedSoFar: number) => void
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
    onPage?.(files.length);
    pageToken = data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

/** Quita prefijo "Image " que a veces aparece en nombres de Drive. */
export function normalizeDriveImageFilename(name: string): string {
  return name.replace(/^Image\s+/i, '').trim();
}

function downloadDriveFileToPath(fileId: string, apiKey: string, destPath: string): Promise<void> {
  const params = new URLSearchParams({
    alt: 'media',
    key: apiKey,
    supportsAllDrives: 'true',
    acknowledgeAbuse: 'true',
  });
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };

    const follow = (currentUrl: string, redirectsLeft: number) => {
      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        settle(new Error(`URL de descarga inválida: ${currentUrl.slice(0, 120)}`));
        return;
      }
      const lib = parsed.protocol === 'http:' ? http : https;
      const req = lib.get(parsed, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          req.setTimeout(0);
          res.resume();
          const next = new URL(res.headers.location, parsed).href;
          follow(next, redirectsLeft - 1);
          return;
        }
        if (!res.statusCode || res.statusCode >= 400) {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            settle(
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
          try {
            const st = fs.statSync(destPath);
            if (st.size <= 0) {
              settle(new Error('Archivo vacío tras descarga'));
              return;
            }
          } catch (e) {
            settle(e instanceof Error ? e : new Error(String(e)));
            return;
          }
          settle();
        });
        out.on('error', (e) => settle(e instanceof Error ? e : new Error(String(e))));
      });
      req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
        req.destroy();
        settle(new Error(`Download timeout (${Math.round(DOWNLOAD_TIMEOUT_MS / 1000)}s)`));
      });
      req.on('error', (e) => {
        if (settled) return;
        settle(e instanceof Error ? e : new Error(String(e)));
      });
    };
    follow(url, 8);
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
  label = 'drive',
  onProgress?: (p: DriveDownloadProgress) => void
): Promise<DriveDownloadResult> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fiix-${label}-`));
  const errors: string[] = [];
  let filesDownloaded = 0;
  let skipped = 0;
  let consecutiveFailures = 0;
  let lastEmit = 0;
  let lastStage: 'list' | 'download' | null = null;
  let lastError: string | undefined;
  let abortAll: Error | null = null;

  const emit = (
    stage: 'list' | 'download',
    listed: number,
    downloaded: number,
    total: number,
    force = false
  ) => {
    const now = Date.now();
    const stageChanged = lastStage !== stage;
    if (!force && !stageChanged && stage === 'download' && downloaded < total && now - lastEmit < 400) {
      return;
    }
    lastStage = stage;
    lastEmit = now;
    onProgress?.({
      stage,
      label,
      listed,
      downloaded,
      total,
      skipped,
      lastError,
    });
  };

  emit('list', 0, 0, 0, true);
  const listed = await listPublicDriveFolderFiles(folderId, apiKey, (n) => {
    emit('list', n, 0, 0);
  });
  const imageLike = listed.filter((f) => {
    const n = normalizeDriveImageFilename(f.name);
    return /\.(jpe?g|png|webp|gif)$/i.test(n);
  });
  emit('download', listed.length, 0, imageLike.length, true);
  console.log(
    `[Drive] ${label}: listados=${listed.length}, imágenes=${imageLike.length}, inicio descarga → ${dir}`
  );

  if (imageLike.length > 0) {
    // Prueba rápida del primer archivo (falla clara en <60s si key/redirect están mal).
    const probe = imageLike[0];
    const probeName = normalizeDriveImageFilename(probe.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const probeDest = path.join(dir, probeName || `probe-${probe.id}.bin`);
    try {
      await downloadDriveFileToPath(probe.id, apiKey, probeDest);
      filesDownloaded++;
      consecutiveFailures = 0;
      emit('download', listed.length, filesDownloaded, imageLike.length, true);
      console.log(`[Drive] ${label}: sonda OK → ${probeName}`);
    } catch (e: any) {
      skipped++;
      consecutiveFailures++;
      lastError = e?.message || String(e);
      errors.push(`${probeName}: ${lastError}`);
      try {
        fs.unlinkSync(probeDest);
      } catch {
        /* ignore */
      }
      emit('download', listed.length, filesDownloaded, imageLike.length, true);
      throw new Error(
        `Drive (${label}): no se pudo descargar ni la primera foto (${lastError}). ` +
          `Revisa API key, que la carpeta sea pública y supportsAllDrives.`
      );
    }
  }

  const rest = imageLike.slice(filesDownloaded > 0 ? 1 : 0);

  await mapPool(rest, DOWNLOAD_CONCURRENCY, async (file) => {
    if (abortAll) return;
    const safeName = normalizeDriveImageFilename(file.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    if (!safeName) {
      skipped++;
      return;
    }
    const dest = path.join(dir, safeName);
    try {
      await downloadDriveFileToPath(file.id, apiKey, dest);
      filesDownloaded++;
      consecutiveFailures = 0;
      emit('download', listed.length, filesDownloaded, imageLike.length);
    } catch (e: any) {
      skipped++;
      consecutiveFailures++;
      lastError = e?.message || String(e);
      errors.push(`${safeName}: ${lastError}`);
      try {
        fs.unlinkSync(dest);
      } catch {
        /* ignore */
      }
      emit('download', listed.length, filesDownloaded, imageLike.length, true);
      if (filesDownloaded === 0 && consecutiveFailures >= EARLY_ABORT_AFTER_FAILURES) {
        abortAll = new Error(
          `Drive (${label}): ${consecutiveFailures} descargas fallidas seguidas sin éxito. Último: ${lastError}`
        );
      }
    }
  });

  if (abortAll) {
    throw abortAll;
  }

  emit('download', listed.length, filesDownloaded, imageLike.length, true);
  console.log(
    `[Drive] ${label}: fin descarga downloaded=${filesDownloaded} skipped=${skipped} errors=${errors.length}`
  );

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
