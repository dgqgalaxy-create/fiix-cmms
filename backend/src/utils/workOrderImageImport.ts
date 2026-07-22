import fs from 'fs';
import path from 'path';
import os from 'os';
import prisma from '../config/prisma';
import { extractZipToDir } from './itemImageImport';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function getWorkOrderImagesDir(): string {
  return path.join(__dirname, '../../../data/Formulario Solicitudes_Images');
}

function getUploadsDir(): string {
  return path.join(__dirname, '../../uploads');
}

/** Clave comparable: minúsculas + sin acentos (DESPUÉS ≈ DESPUES). */
export function foldName(name: string): string {
  return name
    .normalize('NFC')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isSignatureFilename(name: string): boolean {
  return /firma/i.test(name);
}

/**
 * Ruta usable de FOTO ANTES / FOTO DESPUÉS del CSV.
 * Ignora firmas, celdas vacías y errores de export («Unable to load…»).
 */
export function sanitizeWorkOrderPhotoPath(raw?: string | null): string | null {
  if (!raw) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (/unable to load/i.test(t)) return null;
  if (isSignatureFilename(t)) return null;
  const normalized = t.replace(/\\/g, '/');
  const base = path.basename(normalized);
  if (!IMAGE_EXTS.has(path.extname(base).toLowerCase())) return null;
  return normalized;
}

export interface WorkOrderPhotoMapping {
  folio: number;
  beforePath?: string | null;
  afterPath?: string | null;
}

export interface WorkOrderImageImportResult {
  matched: number;
  missing: number;
  skipped: number;
  folderFound: boolean;
  folderPath: string;
  filesScanned: number;
  beforeAssigned: number;
  afterAssigned: number;
}

function listImageFilesRecursive(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const full = path.join(dir, entry);
      let st: fs.Stats;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!st.isFile()) continue;
      if (!IMAGE_EXTS.has(path.extname(entry).toLowerCase())) continue;
      out.push(full);
    }
  };
  walk(root);
  return out;
}

/**
 * Localiza la carpeta Formulario Solicitudes_Images tras descomprimir el zip.
 */
export function resolveWorkOrderImagesRoot(extractRoot: string): string | null {
  const candidates = [
    path.join(extractRoot, 'Formulario Solicitudes_Images'),
    extractRoot,
  ];

  try {
    for (const entry of fs.readdirSync(extractRoot)) {
      const full = path.join(extractRoot, entry);
      if (!fs.statSync(full).isDirectory()) continue;
      candidates.push(path.join(full, 'Formulario Solicitudes_Images'));
      candidates.push(full);
    }
  } catch {
    /* ignore */
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && listImageFilesRecursive(candidate).length > 0) {
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

function buildBasenameIndex(imageFiles: string[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const full of imageFiles) {
    const base = path.basename(full);
    if (isSignatureFilename(base)) continue;
    const key = foldName(base);
    if (!index.has(key)) {
      index.set(key, full);
    }
  }
  return index;
}

function resolveMappedFile(
  relPath: string | null | undefined,
  index: Map<string, string>
): string | null {
  const clean = sanitizeWorkOrderPhotoPath(relPath);
  if (!clean) return null;
  const key = foldName(path.basename(clean));
  return index.get(key) || null;
}

function copyToUploads(src: string, kind: 'before' | 'after'): string {
  const uploadDir = getUploadsDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const ext = path.extname(src).toLowerCase() || '.jpg';
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const destName = `${kind}-${uniqueSuffix}${ext}`;
  const dest = path.join(uploadDir, destName);
  fs.copyFileSync(src, dest);
  return `/uploads/${destName}`;
}

/**
 * Asigna FOTO ANTES / FOTO DESPUÉS a OTs por folio usando archivos ya en disco.
 * Ignora firmas. No falla si faltan coincidencias.
 */
export async function assignWorkOrderImagesFromFolder(
  folderPath: string,
  mappings: WorkOrderPhotoMapping[]
): Promise<WorkOrderImageImportResult> {
  const result: WorkOrderImageImportResult = {
    matched: 0,
    missing: 0,
    skipped: 0,
    folderFound: false,
    folderPath,
    filesScanned: 0,
    beforeAssigned: 0,
    afterAssigned: 0,
  };

  if (!folderPath || !fs.existsSync(folderPath)) {
    return result;
  }
  result.folderFound = true;

  const imageFiles = listImageFilesRecursive(folderPath);
  result.filesScanned = imageFiles.length;
  // Contar firmas en el zip/carpeta como skipped informativo
  result.skipped = imageFiles.filter((f) => isSignatureFilename(path.basename(f))).length;

  if (imageFiles.length === 0 || mappings.length === 0) {
    return result;
  }

  const index = buildBasenameIndex(imageFiles);
  const folios = [...new Set(mappings.map((m) => m.folio))];
  const orders = await prisma.workOrder.findMany({
    where: { folio: { in: folios } },
    select: { id: true, folio: true },
  });
  const byFolio = new Map(orders.map((o) => [o.folio, o.id]));

  for (const mapping of mappings) {
    const woId = byFolio.get(mapping.folio);
    if (!woId) {
      if (sanitizeWorkOrderPhotoPath(mapping.beforePath)) result.missing++;
      if (sanitizeWorkOrderPhotoPath(mapping.afterPath)) result.missing++;
      continue;
    }

    const updateData: { before_image_url?: string; after_image_url?: string } = {};

    const beforeSrc = resolveMappedFile(mapping.beforePath, index);
    if (sanitizeWorkOrderPhotoPath(mapping.beforePath)) {
      if (beforeSrc) {
        try {
          updateData.before_image_url = copyToUploads(beforeSrc, 'before');
          result.beforeAssigned++;
          result.matched++;
        } catch (err) {
          console.error(`WO photo before copy folio ${mapping.folio}:`, err);
          result.missing++;
        }
      } else {
        result.missing++;
      }
    }

    const afterSrc = resolveMappedFile(mapping.afterPath, index);
    if (sanitizeWorkOrderPhotoPath(mapping.afterPath)) {
      if (afterSrc) {
        try {
          updateData.after_image_url = copyToUploads(afterSrc, 'after');
          result.afterAssigned++;
          result.matched++;
        } catch (err) {
          console.error(`WO photo after copy folio ${mapping.folio}:`, err);
          result.missing++;
        }
      } else {
        result.missing++;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.workOrder.update({
        where: { id: woId },
        data: updateData,
      });
    }
  }

  return result;
}

/**
 * Descomprime zip de evidencias de solicitudes, asigna antes/después y limpia temp.
 */
export async function assignWorkOrderImagesFromZip(
  zipPath: string,
  mappings: WorkOrderPhotoMapping[]
): Promise<WorkOrderImageImportResult> {
  const empty: WorkOrderImageImportResult = {
    matched: 0,
    missing: 0,
    skipped: 0,
    folderFound: false,
    folderPath: zipPath,
    filesScanned: 0,
    beforeAssigned: 0,
    afterAssigned: 0,
  };

  if (!zipPath || !fs.existsSync(zipPath)) {
    return empty;
  }

  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fiix-wo-images-'));
  try {
    await extractZipToDir(zipPath, extractDir);
    const root = resolveWorkOrderImagesRoot(extractDir);
    if (!root) {
      return { ...empty, folderPath: extractDir };
    }
    return await assignWorkOrderImagesFromFolder(root, mappings);
  } finally {
    rmRecursiveSafe(extractDir);
  }
}
