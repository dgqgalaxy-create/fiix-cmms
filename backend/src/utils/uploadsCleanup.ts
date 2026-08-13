import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const ORPHAN_LIST_LIMIT = 200;

export type UploadFileEntry = {
  relativePath: string;
  absPath: string;
  size: number;
};

export type OrphanPreview = {
  referencedCount: number;
  fileCount: number;
  orphanCount: number;
  orphanBytes: number;
  orphans: string[];
};

export type OrphanCleanupResult = {
  deletedCount: number;
  freedBytes: number;
  errors?: string[];
};

export type EmptyUploadsResult = {
  deletedCount: number;
  freedBytes: number;
  errors?: string[];
};

/** Raíz de archivos subidos: backend/uploads (igual que multer / static). */
export function getUploadsRoot(): string {
  return path.join(__dirname, '../../uploads');
}

/**
 * Normaliza una URL de BD a ruta relativa bajo uploads/ (forward slashes).
 * Acepta `/uploads/foo.jpg`, `uploads/foo`, o URLs http(s) que contengan `/uploads/...`.
 * Devuelve null si no es una ruta de uploads local.
 */
export function urlToRelativeUploadPath(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;

  let candidate = trimmed;

  // URL absoluta: quedarse con el pathname
  if (/^https?:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).pathname;
    } catch {
      const idx = candidate.toLowerCase().indexOf('/uploads/');
      if (idx === -1) return null;
      candidate = candidate.slice(idx);
    }
  }

  const uploadsIdx = candidate.toLowerCase().indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    candidate = candidate.slice(uploadsIdx + '/uploads/'.length);
  } else if (/^uploads\//i.test(candidate)) {
    candidate = candidate.replace(/^uploads\//i, '');
  } else {
    return null;
  }

  // Normalizar separadores y quitar ./ y segmentos vacíos; rechazar escape
  const parts = candidate
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.');
  if (parts.length === 0 || parts.some((p) => p === '..')) return null;

  return parts.join('/');
}

function addIfUpload(set: Set<string>, url: string | null | undefined): void {
  const rel = urlToRelativeUploadPath(url);
  if (rel) set.add(rel);
}

/** Rutas relativas referenciadas en la BD (forward slashes). */
export async function collectReferencedUploadPaths(
  prisma: PrismaClient
): Promise<Set<string>> {
  const referenced = new Set<string>();

  const [assets, workOrders, items, categories, locations, vendors] = await Promise.all([
    prisma.asset.findMany({ select: { image_url: true, document_url: true } }),
    prisma.workOrder.findMany({
      select: {
        request_image_url: true,
        before_image_url: true,
        after_image_url: true,
      },
    }),
    prisma.item.findMany({ select: { image_url: true } }),
    prisma.itemCategory.findMany({ select: { icon_url: true } }),
    prisma.itemLocation.findMany({ select: { icon_url: true } }),
    prisma.vendor.findMany({ select: { logo_url: true } }),
  ]);

  for (const a of assets) {
    addIfUpload(referenced, a.image_url);
    addIfUpload(referenced, a.document_url);
  }
  for (const wo of workOrders) {
    addIfUpload(referenced, wo.request_image_url);
    addIfUpload(referenced, wo.before_image_url);
    addIfUpload(referenced, wo.after_image_url);
  }
  for (const item of items) {
    addIfUpload(referenced, item.image_url);
  }
  // Solo cuentan como uploads locales si el valor contiene /uploads/
  for (const c of categories) {
    if (c.icon_url && c.icon_url.includes('/uploads/')) addIfUpload(referenced, c.icon_url);
  }
  for (const loc of locations) {
    if (loc.icon_url && loc.icon_url.includes('/uploads/')) addIfUpload(referenced, loc.icon_url);
  }
  for (const v of vendors) {
    if (v.logo_url && v.logo_url.includes('/uploads/')) addIfUpload(referenced, v.logo_url);
  }

  return referenced;
}

/** True si absPath está estrictamente dentro de root (sin escapar). */
export function isSafePathInsideUploads(absPath: string, root?: string): boolean {
  const uploadsRoot = path.resolve(root ?? getUploadsRoot());
  const resolved = path.resolve(absPath);
  const relative = path.relative(uploadsRoot, resolved);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** Lista recursiva de archivos bajo uploads/ (omite directorios). */
export async function listUploadFiles(root?: string): Promise<UploadFileEntry[]> {
  const uploadsRoot = path.resolve(root ?? getUploadsRoot());
  const results: UploadFileEntry[] = [];

  if (!fs.existsSync(uploadsRoot)) {
    return results;
  }

  async function walk(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (!isSafePathInsideUploads(abs, uploadsRoot)) continue;
      if (entry.isDirectory()) {
        await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      let size = 0;
      try {
        const st = await fs.promises.stat(abs);
        size = st.size;
      } catch {
        continue;
      }
      const relativePath = path.relative(uploadsRoot, abs).split(path.sep).join('/');
      results.push({ relativePath, absPath: abs, size });
    }
  }

  await walk(uploadsRoot);
  return results;
}

export async function previewOrphanUploads(prisma: PrismaClient): Promise<OrphanPreview> {
  const referenced = await collectReferencedUploadPaths(prisma);
  const files = await listUploadFiles();
  const orphans = files.filter((f) => !referenced.has(f.relativePath));
  const orphanBytes = orphans.reduce((sum, f) => sum + f.size, 0);

  return {
    referencedCount: referenced.size,
    fileCount: files.length,
    orphanCount: orphans.length,
    orphanBytes,
    orphans: orphans.slice(0, ORPHAN_LIST_LIMIT).map((f) => f.relativePath),
  };
}

export async function cleanupOrphanUploads(prisma: PrismaClient): Promise<OrphanCleanupResult> {
  const uploadsRoot = path.resolve(getUploadsRoot());
  const referenced = await collectReferencedUploadPaths(prisma);
  const files = await listUploadFiles(uploadsRoot);
  const orphans = files.filter((f) => !referenced.has(f.relativePath));

  let deletedCount = 0;
  let freedBytes = 0;
  const errors: string[] = [];

  for (const file of orphans) {
    if (!isSafePathInsideUploads(file.absPath, uploadsRoot)) {
      errors.push(`Ruta insegura omitida: ${file.relativePath}`);
      continue;
    }
    try {
      await fs.promises.unlink(file.absPath);
      deletedCount += 1;
      freedBytes += file.size;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${file.relativePath}: ${msg}`);
    }
  }

  const result: OrphanCleanupResult = { deletedCount, freedBytes };
  if (errors.length > 0) result.errors = errors;
  return result;
}

/**
 * Vacía el contenido de uploads/ (mantiene la carpeta).
 * Recrea uploads/inventory/ y uploads/vendors/ vacíos para subidas.
 */
export async function emptyUploadsDirectory(): Promise<EmptyUploadsResult> {
  const uploadsRoot = path.resolve(getUploadsRoot());
  let deletedCount = 0;
  let freedBytes = 0;
  const errors: string[] = [];

  if (!fs.existsSync(uploadsRoot)) {
    await fs.promises.mkdir(uploadsRoot, { recursive: true });
    await fs.promises.mkdir(path.join(uploadsRoot, 'inventory'), { recursive: true });
    await fs.promises.mkdir(path.join(uploadsRoot, 'vendors'), { recursive: true });
    return { deletedCount: 0, freedBytes: 0 };
  }

  async function removeEntry(abs: string): Promise<void> {
    if (!isSafePathInsideUploads(abs, uploadsRoot) && path.resolve(abs) !== uploadsRoot) {
      errors.push(`Ruta insegura omitida: ${abs}`);
      return;
    }
    let st: fs.Stats;
    try {
      st = await fs.promises.lstat(abs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${abs}: ${msg}`);
      return;
    }

    if (st.isDirectory()) {
      let children: string[];
      try {
        children = await fs.promises.readdir(abs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${abs}: ${msg}`);
        return;
      }
      for (const name of children) {
        await removeEntry(path.join(abs, name));
      }
      // No borrar la raíz uploads/; sí subdirectorios
      if (path.resolve(abs) !== uploadsRoot) {
        try {
          await fs.promises.rmdir(abs);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${abs}: ${msg}`);
        }
      }
      return;
    }

    try {
      freedBytes += st.size;
      await fs.promises.unlink(abs);
      deletedCount += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${abs}: ${msg}`);
    }
  }

  const top = await fs.promises.readdir(uploadsRoot);
  for (const name of top) {
    await removeEntry(path.join(uploadsRoot, name));
  }

  try {
    await fs.promises.mkdir(path.join(uploadsRoot, 'inventory'), { recursive: true });
    await fs.promises.mkdir(path.join(uploadsRoot, 'vendors'), { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`No se pudo recrear inventory/vendors/: ${msg}`);
  }

  const result: EmptyUploadsResult = { deletedCount, freedBytes };
  if (errors.length > 0) result.errors = errors;
  return result;
}
