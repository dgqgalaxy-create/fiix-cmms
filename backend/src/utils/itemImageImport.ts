import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import prisma from '../config/prisma';
import { isActivosCategoryName } from './inventoryLocationToZone';

const execFileAsync = promisify(execFile);

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Carpeta de staging en la raíz del repo: data/Items_Images/ (casing exacto del export Fiix). */
export function getItemImagesDir(): string {
  return path.join(__dirname, '../../../data/Items_Images');
}

function getInventoryUploadDir(): string {
  return path.join(__dirname, '../../uploads/inventory');
}

function getAssetsUploadDir(): string {
  return path.join(__dirname, '../../uploads/assets');
}

/**
 * Extrae el Item ID / internal_code desde el nombre de archivo real.
 * Patrones soportados (export Fiix y simplificado):
 *   MTTO-0001.Image.163526.png  → MTTO-0001
 *   E2-0.Image.120000.jpg       → E2-0
 *   MTTO-0001.jpg               → MTTO-0001
 */
export function extractItemCodeFromFilename(filename: string): string | null {
  let base = path.basename(filename, path.extname(filename));
  if (!base) return null;
  // Drive a veces antepone "Image " al nombre del export Fiix.
  base = base.replace(/^Image\s+/i, '').trim();
  if (!base) return null;

  const fiixMatch = base.match(/^(.+)\.Image\.\d+$/i);
  if (fiixMatch?.[1]) {
    return fiixMatch[1].trim();
  }

  return base.trim() || null;
}

/** Normaliza un nombre para comparar con el slug del archivo (fallback). */
export function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ItemImageImportResult {
  matched: number;
  missing: number;
  skipped: number;
  /** Fotos también copiadas a uploads/assets/ y ligadas a Asset (categoría ACTIVOS). */
  assetsMatched: number;
  folderFound: boolean;
  folderPath: string;
  filesScanned: number;
}

function listImageFiles(folderPath: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(folderPath);
  } catch {
    return [];
  }

  return entries.filter((f) => {
    if (f.startsWith('.')) return false;
    const full = path.join(folderPath, f);
    try {
      if (!fs.statSync(full).isFile()) return false;
    } catch {
      return false;
    }
    return IMAGE_EXTS.has(path.extname(f).toLowerCase());
  });
}

/**
 * Localiza la carpeta con fotos tras descomprimir un zip Fiix.
 * Soporta raíz plana o carpeta Items_Images/ (con o sin un nivel extra).
 */
export function resolveItemImagesRoot(extractRoot: string): string | null {
  const candidates = [
    path.join(extractRoot, 'Items_Images'),
    extractRoot,
  ];

  try {
    for (const entry of fs.readdirSync(extractRoot)) {
      const full = path.join(extractRoot, entry);
      if (!fs.statSync(full).isDirectory()) continue;
      candidates.push(path.join(full, 'Items_Images'));
      candidates.push(full);
    }
  } catch {
    /* ignore */
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && listImageFiles(candidate).length > 0) {
      return candidate;
    }
  }
  return null;
}

function rmRecursiveSafe(target: string): void {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/**
 * Extrae un zip a disco sin cargarlo en memoria (tar en Windows 10+/Linux;
 * fallback unzip / Expand-Archive).
 */
export async function extractZipToDir(zipPath: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true });

  try {
    await execFileAsync('tar', ['-xf', zipPath, '-C', destDir], {
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    });
    return;
  } catch (tarErr) {
    console.warn('tar extract failed, trying fallback:', (tarErr as Error).message);
  }

  if (process.platform === 'win32') {
    const ps = [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
    ];
    await execFileAsync('powershell', ps, { windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
    return;
  }

  await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', destDir], {
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
}

/**
 * Escanea una carpeta de fotos, copia cada una a uploads/inventory/
 * (mismo formato que ItemModal) y actualiza item.image_url.
 * Empareja por el Item ID embebido en el nombre (p. ej. MTTO-0001.Image.163526.png).
 * Si el ítem es categoría ACTIVOS/ACTIVO y existe un Asset con el mismo nombre,
 * copia también a uploads/assets/ y actualiza Asset.image_url (UI de Activos).
 * No falla si la carpeta no existe o está vacía.
 */
export async function assignItemImagesFromFolder(
  folderPath: string = getItemImagesDir()
): Promise<ItemImageImportResult> {
  const result: ItemImageImportResult = {
    matched: 0,
    missing: 0,
    skipped: 0,
    assetsMatched: 0,
    folderFound: false,
    folderPath,
    filesScanned: 0,
  };

  if (!fs.existsSync(folderPath)) {
    return result;
  }
  result.folderFound = true;

  const imageFiles = listImageFiles(folderPath);
  result.filesScanned = imageFiles.length;
  if (imageFiles.length === 0) {
    return result;
  }

  const items = await prisma.item.findMany({
    select: {
      id: true,
      internal_code: true,
      name: true,
      category: { select: { name: true } },
    },
  });

  type ItemRow = (typeof items)[number];
  const byCode = new Map<string, ItemRow>();
  const bySlug = new Map<string, ItemRow>();
  for (const item of items) {
    byCode.set(item.internal_code.toLowerCase(), item);
    const slug = slugifyName(item.name);
    if (slug && !bySlug.has(slug)) {
      bySlug.set(slug, item);
    }
  }

  const uploadDir = getInventoryUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const assetsUploadDir = getAssetsUploadDir();
  if (!fs.existsSync(assetsUploadDir)) {
    fs.mkdirSync(assetsUploadDir, { recursive: true });
  }

  const usedItemIds = new Set<string>();

  for (const file of imageFiles) {
    const ext = path.extname(file).toLowerCase();
    const code = extractItemCodeFromFilename(file);
    const key = code ? code.toLowerCase() : '';
    const slugKey = code ? slugifyName(code) : '';

    const item =
      (key ? byCode.get(key) : undefined) ||
      (slugKey ? bySlug.get(slugKey) : undefined);

    if (!item) {
      result.missing++;
      continue;
    }

    if (usedItemIds.has(item.id)) {
      result.skipped++;
      continue;
    }

    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const destName = `image-${uniqueSuffix}${ext}`;
      const src = path.join(folderPath, file);
      const dest = path.join(uploadDir, destName);
      fs.copyFileSync(src, dest);

      const image_url = `/uploads/inventory/${destName}`;
      await prisma.item.update({
        where: { id: item.id },
        data: { image_url },
      });

      usedItemIds.add(item.id);
      result.matched++;

      // Categoría Activo → también en módulo Activos (ruta uploads/assets/).
      if (isActivosCategoryName(item.category?.name)) {
        const assetName = (item.name || '').trim();
        if (assetName) {
          const asset = await prisma.asset.findFirst({ where: { name: assetName } });
          if (asset) {
            const assetDestName = `image-${uniqueSuffix}${ext}`;
            fs.copyFileSync(src, path.join(assetsUploadDir, assetDestName));
            await prisma.asset.update({
              where: { id: asset.id },
              data: { image_url: `/uploads/assets/${assetDestName}` },
            });
            result.assetsMatched++;
          }
        }
      }
    } catch (e) {
      console.error('Item image assign error', file, e);
      result.skipped++;
    }
  }

  return result;
}

/**
 * Descomprime un zip de fotos (export Fiix), asigna imágenes y limpia el temp.
 * No rompe la importación CSV si el zip está vacío o no hay coincidencias.
 */
export async function assignItemImagesFromZip(zipPath: string): Promise<ItemImageImportResult> {
  const empty: ItemImageImportResult = {
    matched: 0,
    missing: 0,
    skipped: 0,
    assetsMatched: 0,
    folderFound: false,
    folderPath: zipPath,
    filesScanned: 0,
  };

  if (!zipPath || !fs.existsSync(zipPath)) {
    return empty;
  }

  const extractDir = path.join(
    os.tmpdir(),
    `fiix-item-images-${Date.now()}-${Math.round(Math.random() * 1e9)}`
  );

  try {
    await extractZipToDir(zipPath, extractDir);
    const imagesRoot = resolveItemImagesRoot(extractDir);
    if (!imagesRoot) {
      return { ...empty, folderPath: extractDir };
    }
    return await assignItemImagesFromFolder(imagesRoot);
  } finally {
    rmRecursiveSafe(extractDir);
  }
}
