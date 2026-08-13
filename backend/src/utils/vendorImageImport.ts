import fs from 'fs';
import path from 'path';
import os from 'os';
import prisma from '../config/prisma';
import { extractZipToDir, slugifyName } from './itemImageImport';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Carpeta de staging: data/Vendors_Images/ (export Fiix). */
export function getVendorImagesDir(): string {
  return path.join(__dirname, '../../../data/Vendors_Images');
}

function getVendorsUploadDir(): string {
  return path.join(__dirname, '../../uploads/vendors');
}

/**
 * Extrae el Vendor ID / internal_id desde el nombre de archivo.
 * Patrones:
 *   83a52293.Logo.170018.png  → 83a52293
 *   PROV001.Logo.120000.jpg   → PROV001
 *   83a52293.jpg              → 83a52293
 */
export function extractVendorIdFromFilename(filename: string): string | null {
  let base = path.basename(filename, path.extname(filename));
  if (!base) return null;
  // Drive a veces antepone "Logo " o "Image ".
  base = base.replace(/^(Logo|Image)\s+/i, '').trim();
  if (!base) return null;

  const fiixMatch = base.match(/^(.+)\.Logo\.\d+$/i);
  if (fiixMatch?.[1]) {
    return fiixMatch[1].trim();
  }

  return base.trim() || null;
}

export interface VendorImageImportResult {
  matched: number;
  missing: number;
  skipped: number;
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
 * Localiza la carpeta con logos tras descomprimir un zip Fiix.
 * Soporta raíz plana o carpeta Vendors_Images/ (con o sin un nivel extra).
 */
export function resolveVendorImagesRoot(extractRoot: string): string | null {
  const candidates = [
    path.join(extractRoot, 'Vendors_Images'),
    extractRoot,
  ];

  try {
    for (const entry of fs.readdirSync(extractRoot)) {
      const full = path.join(extractRoot, entry);
      if (!fs.statSync(full).isDirectory()) continue;
      candidates.push(path.join(full, 'Vendors_Images'));
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
 * Escanea una carpeta de logos, copia a uploads/vendors/ y actualiza logo_url.
 * Empareja por internal_id (p. ej. 83a52293.Logo.170018.png).
 * No toca logos HTTPS si no hay archivo coincidente.
 * No falla si la carpeta no existe o está vacía.
 */
export async function assignVendorLogosFromFolder(
  folderPath: string = getVendorImagesDir()
): Promise<VendorImageImportResult> {
  const result: VendorImageImportResult = {
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

  const imageFiles = listImageFiles(folderPath);
  result.filesScanned = imageFiles.length;
  if (imageFiles.length === 0) {
    return result;
  }

  const vendors = await prisma.vendor.findMany({
    select: { id: true, internal_id: true, name: true },
  });

  type VendorRow = (typeof vendors)[number];
  const byId = new Map<string, VendorRow>();
  const bySlug = new Map<string, VendorRow>();
  for (const v of vendors) {
    byId.set(v.internal_id.toLowerCase(), v);
    const slug = slugifyName(v.name);
    if (slug && !bySlug.has(slug)) {
      bySlug.set(slug, v);
    }
  }

  const uploadDir = getVendorsUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const usedVendorIds = new Set<string>();

  for (const file of imageFiles) {
    const ext = path.extname(file).toLowerCase();
    const code = extractVendorIdFromFilename(file);
    const key = code ? code.toLowerCase() : '';
    const slugKey = code ? slugifyName(code) : '';

    const vendor =
      (key ? byId.get(key) : undefined) ||
      (slugKey ? bySlug.get(slugKey) : undefined);

    if (!vendor) {
      result.missing++;
      continue;
    }

    if (usedVendorIds.has(vendor.id)) {
      result.skipped++;
      continue;
    }

    try {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const destName = `logo-${uniqueSuffix}${ext}`;
      const src = path.join(folderPath, file);
      const dest = path.join(uploadDir, destName);
      fs.copyFileSync(src, dest);

      const logo_url = `/uploads/vendors/${destName}`;
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { logo_url },
      });

      usedVendorIds.add(vendor.id);
      result.matched++;
    } catch (e) {
      console.error('Vendor logo assign error', file, e);
      result.skipped++;
    }
  }

  return result;
}

/**
 * Descomprime un zip de logos (export Fiix), asigna y limpia el temp.
 * No rompe la importación CSV si el zip está vacío o no hay coincidencias.
 */
export async function assignVendorLogosFromZip(zipPath: string): Promise<VendorImageImportResult> {
  const empty: VendorImageImportResult = {
    matched: 0,
    missing: 0,
    skipped: 0,
    folderFound: false,
    folderPath: zipPath,
    filesScanned: 0,
  };

  if (!zipPath || !fs.existsSync(zipPath)) {
    return empty;
  }

  const extractDir = path.join(
    os.tmpdir(),
    `fiix-vendor-images-${Date.now()}-${Math.round(Math.random() * 1e9)}`
  );

  try {
    await extractZipToDir(zipPath, extractDir);
    const imagesRoot = resolveVendorImagesRoot(extractDir);
    if (!imagesRoot) {
      return { ...empty, folderPath: extractDir };
    }
    return await assignVendorLogosFromFolder(imagesRoot);
  } finally {
    rmRecursiveSafe(extractDir);
  }
}
