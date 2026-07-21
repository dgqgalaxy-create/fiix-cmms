import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Carpeta de staging en la raíz del repo: data/item-images/ */
export function getItemImagesDir(): string {
  return path.join(__dirname, '../../../data/item-images');
}

function getInventoryUploadDir(): string {
  return path.join(__dirname, '../../uploads/inventory');
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
  folderFound: boolean;
  folderPath: string;
  filesScanned: number;
}

/**
 * Escanea data/item-images/, copia cada foto al mismo formato que ItemModal
 * (uploads/inventory/image-{timestamp}-{random}.ext) y actualiza item.image_url.
 * No falla si la carpeta no existe o está vacía.
 */
export async function assignItemImagesFromFolder(): Promise<ItemImageImportResult> {
  const folderPath = getItemImagesDir();
  const result: ItemImageImportResult = {
    matched: 0,
    missing: 0,
    skipped: 0,
    folderFound: false,
    folderPath,
    filesScanned: 0,
  };

  if (!fs.existsSync(folderPath)) {
    return result;
  }
  result.folderFound = true;

  let entries: string[];
  try {
    entries = fs.readdirSync(folderPath);
  } catch {
    return result;
  }

  const imageFiles = entries.filter((f) => {
    if (f.startsWith('.')) return false;
    const full = path.join(folderPath, f);
    try {
      if (!fs.statSync(full).isFile()) return false;
    } catch {
      return false;
    }
    return IMAGE_EXTS.has(path.extname(f).toLowerCase());
  });

  result.filesScanned = imageFiles.length;
  if (imageFiles.length === 0) {
    return result;
  }

  const items = await prisma.item.findMany({
    select: { id: true, internal_code: true, name: true },
  });

  const byCode = new Map<string, { id: string; internal_code: string; name: string }>();
  const bySlug = new Map<string, { id: string; internal_code: string; name: string }>();
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

  const usedItemIds = new Set<string>();

  for (const file of imageFiles) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, path.extname(file));
    const key = base.toLowerCase();
    const slugKey = slugifyName(base);

    const item =
      byCode.get(key) ||
      (slugKey ? bySlug.get(slugKey) : undefined) ||
      bySlug.get(key);

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
    } catch (e) {
      console.error('Item image assign error', file, e);
      result.skipped++;
    }
  }

  return result;
}
