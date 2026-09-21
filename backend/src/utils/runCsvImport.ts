import fs from 'fs';
import { parse } from 'csv-parse/sync';
import {
  Role,
  AssetStatus,
  AssetKind,
  WorkOrderStatus,
  Priority,
  MaintenanceType,
  ProductionGroup,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { generateAssetInternalCode } from './assetCodeGenerator';
import { parseWorkOrderFolio } from './folio';
import {
  assignItemImagesFromFolder,
  assignItemImagesFromZip,
} from './itemImageImport';
import {
  assignVendorLogosFromFolder,
  assignVendorLogosFromZip,
} from './vendorImageImport';
import {
  assignWorkOrderImagesFromFolder,
  assignWorkOrderImagesFromZip,
  getWorkOrderImagesDir,
  sanitizeWorkOrderPhotoPath,
  type WorkOrderPhotoMapping,
} from './workOrderImageImport';
import { parseCsvDate } from './parseCsvDate';
import { syncAssetsFromActivosInventory } from './assetInventoryImport';
import { emitRefresh } from './socket';
import {
  downloadPublicDriveFolderToTemp,
  extractDriveFolderId,
  getDriveApiKey,
  getDriveItemsFolderId,
  getDriveWoFolderId,
  getDriveVendorsFolderId,
  rmTempDirSafe,
  type DriveDownloadProgress,
} from './googleDriveImport';
import { setImportProgress } from './importProgress';
import { importInventoryTransactionsFile } from './inventoryCsvImport';

export class CsvImportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'CsvImportError';
    this.status = status;
  }
}

/** Archivo CSV o zip compatible con Multer (path en disco) o buffer. */
export type ImportFileLike = {
  originalname: string;
  path?: string;
  buffer?: Buffer;
};

export type CsvImportResults = {
  categories: number;
  locations: number;
  vendors: number;
  items: number;
  users: number;
  inventory: number;
  orders: number;
  assets?: {
    created: number;
    updated: number;
    skipped: number;
    zonesEnsured: string[];
  };
  itemImages?: PhotoImportSummary & { assetsMatched?: number };
  vendorImages?: PhotoImportSummary;
  workOrderImages?: PhotoImportSummary & {
    beforeAssigned: number;
    afterAssigned: number;
  };
  /** Detalle del import de movimientos (por fila) cuando hubo omisiones/errores. */
  inventoryDetails?: {
    created: number;
    skippedExisting: number;
    ignoredTotal: number;
    ignored: Array<{ row: number; reason: string }>;
  };
  /** Órdenes que no se pudieron importar (fila CSV + motivo), tope de 100. */
  workOrderWarnings?: string[];
  /** Filas con error en catálogos/movimientos de otras secciones (tope 100). */
  importRowWarnings?: string[];
};

export type PhotoSource = 'zip' | 'google_drive' | 'data_folder';

export type PhotoImportSummary = {
  matched: number;
  missing: number;
  skipped: number;
  folderFound: boolean;
  filesScanned: number;
  source?: PhotoSource;
  driveListed?: number;
  driveDownloaded?: number;
  driveErrors?: string[];
  error?: string;
};

/** Texto legible del resumen de import (UI toast + bitácora). */
export function formatImportResultsMessage(
  results: CsvImportResults,
  prefix: string
): string {
  let msg = `${prefix}: ${results.categories} Categorías, ${results.locations} Ubicaciones, ${results.vendors} Proveedores, ${results.items} Repuestos, ${results.users} Usuarios, ${results.inventory} Movimientos, ${results.orders} Órdenes.`;
  if (results.inventoryDetails) {
    const d = results.inventoryDetails;
    msg += ` Movimientos: ${d.created} creados, ${d.skippedExisting} ya existentes (omitidos)`;
    if (d.ignoredTotal > 0) {
      msg += `, ${d.ignoredTotal} sin importar`;
    }
    msg += '.';
  }
  if (results.workOrderWarnings && results.workOrderWarnings.length > 0) {
    msg += ` ${results.workOrderWarnings.length} órdene(s) sin importar por error de fila.`;
  }
  if (results.importRowWarnings && results.importRowWarnings.length > 0) {
    msg += ` ${results.importRowWarnings.length} fila(s) con error en catálogos/movimientos (ver bitácora).`;
  }
  if (results.assets) {
    msg += ` Activos (desde inventario ACTIVOS): ${results.assets.created} creados, ${results.assets.updated} actualizados`;
    if (results.assets.skipped > 0) {
      msg += `, ${results.assets.skipped} omitidos`;
    }
    msg += '.';
  }
  if (results.itemImages) {
    const src =
      results.itemImages.source === 'google_drive'
        ? 'Drive'
        : results.itemImages.source === 'zip'
          ? 'zip'
          : 'data/';
    msg += ` Fotos repuestos (${src}): ${results.itemImages.matched}`;
    if (results.itemImages.assetsMatched && results.itemImages.assetsMatched > 0) {
      msg += ` (también en Activos: ${results.itemImages.assetsMatched})`;
    }
    if (results.itemImages.missing > 0) {
      msg += ` (${results.itemImages.missing} sin ítem coincidente)`;
    }
    if (results.itemImages.driveDownloaded != null) {
      msg += `; descargadas Drive: ${results.itemImages.driveDownloaded}`;
    }
    if (results.itemImages.error) {
      msg += ` — error Drive: ${results.itemImages.error}`;
    }
    msg += '.';
  }
  if (results.vendorImages) {
    const src =
      results.vendorImages.source === 'google_drive'
        ? 'Drive'
        : results.vendorImages.source === 'zip'
          ? 'zip'
          : 'data/';
    msg += ` Logos proveedores (${src}): ${results.vendorImages.matched}`;
    if (results.vendorImages.missing > 0) {
      msg += ` (${results.vendorImages.missing} sin proveedor coincidente)`;
    }
    if (results.vendorImages.driveDownloaded != null) {
      msg += `; descargadas Drive: ${results.vendorImages.driveDownloaded}`;
    }
    if (results.vendorImages.error) {
      msg += ` — error Drive: ${results.vendorImages.error}`;
    }
    msg += '.';
  }
  if (results.workOrderImages) {
    const src =
      results.workOrderImages.source === 'google_drive'
        ? 'Drive'
        : results.workOrderImages.source === 'zip'
          ? 'zip'
          : 'data/';
    msg += ` Fotos OT (${src}): ${results.workOrderImages.matched} (antes ${results.workOrderImages.beforeAssigned}, después ${results.workOrderImages.afterAssigned})`;
    if (results.workOrderImages.driveDownloaded != null) {
      msg += `; descargadas Drive: ${results.workOrderImages.driveDownloaded}`;
    }
    if (results.workOrderImages.error) {
      msg += ` — error Drive: ${results.workOrderImages.error}`;
    }
    msg += '.';
  }
  return msg;
}

export type ProcessCsvImportOptions = {
  /** Si false, no intenta data/Items_Images, data/Vendors_Images ni data/Formulario… cuando no hay zip. Default true. */
  includeLocalPhotoFolders?: boolean;
  /** Si true y hay API key + carpeta configurada, baja fotos de Drive cuando no hay zip. */
  useGoogleDrive?: boolean;
  /** Override opcional de carpeta (URL o ID); si falta usa GOOGLE_DRIVE_*_FOLDER. */
  driveItemsFolder?: string | null;
  driveWoFolder?: string | null;
  driveVendorsFolder?: string | null;
  /** Si true, NO crea ni actualiza activos desde los ítems de categoría Activo/Activos. */
  skipAssets?: boolean;
};

function readImportFileUtf8(file: ImportFileLike): string {
  if (file.buffer && file.buffer.length > 0) {
    return file.buffer.toString('utf8');
  }
  if (file.path && fs.existsSync(file.path)) {
    return fs.readFileSync(file.path, 'utf8');
  }
  throw new CsvImportError(`No se pudo leer el archivo: ${file.originalname}`);
}

function reportDriveProgress(p: DriveDownloadProgress, basePercent: number, span: number): void {
  const nice = p.label === 'items' ? 'inventario' : p.label === 'wo' ? 'órdenes' : p.label;
  if (p.stage === 'list') {
    setImportProgress(
      'drive_list',
      basePercent,
      `Listando Google Drive (${nice}): ${p.listed} archivos…`,
      { listed: p.listed, label: p.label, downloaded: 0, total: 0 }
    );
    return;
  }
  const frac = p.total > 0 ? p.downloaded / p.total : 0;
  let msg =
    p.downloaded === 0 && p.total > 0
      ? `Listado OK (${p.listed}). Iniciando descarga ${nice}: 0 / ${p.total}…`
      : `Descargando fotos ${nice}: ${p.downloaded} / ${p.total}`;
  if ((p.skipped ?? 0) > 0) {
    msg += ` · omitidas ${p.skipped}`;
  }
  if (p.lastError && p.downloaded === 0) {
    msg += ` — ${p.lastError.slice(0, 100)}`;
  }
  setImportProgress('drive_download', basePercent + Math.round(frac * span), msg, {
    downloaded: p.downloaded,
    total: p.total,
    listed: p.listed,
    label: p.label,
  });
}

/**
 * Motor compartido de importación CSV (upload o Sheets → temps).
 * Emite refresh de sockets al terminar con éxito.
 */
export async function processCsvImportFiles(
  files: ImportFileLike[],
  options: ProcessCsvImportOptions & {
    zipFile?: ImportFileLike | null;
    vendorZipFile?: ImportFileLike | null;
    woZipFile?: ImportFileLike | null;
  } = {}
): Promise<CsvImportResults> {
  const includeLocalPhotoFolders = options.includeLocalPhotoFolders !== false;
  const useGoogleDrive = Boolean(options.useGoogleDrive);
  const skipAssets = Boolean(options.skipAssets);
  const zipFile = options.zipFile ?? null;
  const vendorZipFile = options.vendorZipFile ?? null;
  const woZipFile = options.woZipFile ?? null;
  const driveApiKey = useGoogleDrive ? getDriveApiKey() : null;
  const itemsFolderId =
    extractDriveFolderId(options.driveItemsFolder) || (useGoogleDrive ? getDriveItemsFolderId() : null);
  const vendorsFolderId =
    extractDriveFolderId(options.driveVendorsFolder) ||
    (useGoogleDrive ? getDriveVendorsFolderId() : null);
  const woFolderId =
    extractDriveFolderId(options.driveWoFolder) || (useGoogleDrive ? getDriveWoFolderId() : null);
  let driveItemsTemp: string | null = null;
  let driveVendorsTemp: string | null = null;
  let driveWoTemp: string | null = null;

  setImportProgress('csv', 22, 'Importando datos a la base (puede tardar)…');

// Fechas Fiix CSV: dd/mm/yyyy (ver parseCsvDate). No usar new Date('05/07/…') (mm/dd US).
const parseSafeDate = parseCsvDate;

// Parseo robusto de números que pueden venir con coma como separador de miles
// (ej. "2,140.22" -> 2140.22). Sin esto parseFloat corta en la coma y devuelve 2.
const parseNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

if (!files || files.length === 0) {
  throw new CsvImportError('No se subieron archivos CSV.', 400);
}

const catFile = files.find(f => f.originalname.includes('Categories'));
const locFile = files.find(f => f.originalname.includes('Location'));
const venFile = files.find(f => f.originalname.includes('Vendors'));
const itemFile = files.find(f => f.originalname.includes('Items') && !f.originalname.includes('Categories') && !f.originalname.includes('Location') && !f.originalname.includes('Vendors') && !f.originalname.includes('Inventory') && !f.originalname.includes('Users'));
const userFile = files.find(f => f.originalname.includes('Users'));
const invFile = files.find(f => f.originalname.includes('Inventory'));
const woFile = files.find(f => f.originalname.includes('Solicitudes Mantenimiento'));

// Validar sintaxis de TODO el lote antes de empezar a escribir.
for (const file of files) {
  try { parse(readImportFileUtf8(file), { columns: true, skip_empty_lines: true }); }
  catch (e) { throw new CsvImportError(`${file.originalname}: CSV inválido. ${e instanceof Error ? e.message : e}`); }
}

const results: CsvImportResults = {
  categories: 0,
  locations: 0,
  vendors: 0,
  items: 0,
  users: 0,
  inventory: 0,
  orders: 0,
};

/** Registra una fila que falló (para que el lote no quede incompleto en silencio). */
const pushImportRowWarning = (kind: string, line: number, error: unknown): never => {
  throw new CsvImportError(`${kind}, fila ${line}: ${error instanceof Error ? error.message : error}. El lote de datos se revirtió.`);
};

const woPhotoMappings: WorkOrderPhotoMapping[] = [];

await prisma.$transaction(async (prisma) => {
  // Protege también invocaciones del motor fuera de las rutas HTTP.
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(16310, 2)`;
if (catFile) {
  const data = parse(readImportFileUtf8(catFile), { columns: true, skip_empty_lines: true });
  for (let _i = 0; _i < data.length; _i++) {
    const row = data[_i] as any;
    const csvLine = _i + 2; // la fila 1 es el encabezado
    try {
      const id = (row['ID'] || '').trim();
      const name = (row['Category'] || '').trim();
      if (!id || !name) continue;
      await prisma.itemCategory.upsert({
        where: { internal_id: id },
        update: { name: name, icon_url: row['Icon'] },
        create: { internal_id: id, name: name, icon_url: row['Icon'] }
      });
      results.categories++;
    } catch (e) {
      pushImportRowWarning('Categorías', csvLine, e);
    }
  }
}

if (locFile) {
  const data = parse(readImportFileUtf8(locFile), { columns: true, skip_empty_lines: true });
  for (let _i = 0; _i < data.length; _i++) {
    const row = data[_i] as any;
    const csvLine = _i + 2; // la fila 1 es el encabezado
    try {
      const id = (row['ID'] || '').trim();
      const name = (row['Location'] || '').trim();
      if (!id || !name) continue;
      await prisma.itemLocation.upsert({
        where: { internal_id: id },
        update: { name: name, icon_url: row['Icon'] },
        create: { internal_id: id, name: name, icon_url: row['Icon'] }
      });
      results.locations++;
    } catch (e) {
      pushImportRowWarning('Ubicaciones', csvLine, e);
    }
  }
}

if (venFile) {
  const data = parse(readImportFileUtf8(venFile), { columns: true, skip_empty_lines: true });
  for (let _i = 0; _i < data.length; _i++) {
    const row = data[_i] as any;
    const csvLine = _i + 2; // la fila 1 es el encabezado
    try {
      const id = (row['ID'] || '').trim();
      const name = (row['Name'] || '').trim();
      if (!id || !name) continue;
      await prisma.vendor.upsert({
        where: { internal_id: id },
        update: { 
          name: name, logo_url: row['Logo'], website_url: row['URL'],
          phone: row['Phone'], email: row['Email'], address: row['Address']
        },
        create: { 
          internal_id: id, name: name, logo_url: row['Logo'], website_url: row['URL'],
          phone: row['Phone'], email: row['Email'], address: row['Address']
        }
      });
      results.vendors++;
    } catch (e) {
      pushImportRowWarning('Proveedores', csvLine, e);
    }
  }
}

if (itemFile) {
  const categories = await prisma.itemCategory.findMany();
  const locations = await prisma.itemLocation.findMany();
  const vendors = await prisma.vendor.findMany();
  
  const catMap = Object.fromEntries(categories.map(c => [c.internal_id, c.id]));
  const locMap = Object.fromEntries(locations.map(c => [c.internal_id, c.id]));
  const venMap = Object.fromEntries(vendors.map(c => [c.internal_id, c.id]));
  
  let unassignedLoc = locations.find(l => l.name === 'Sin Asignación');
  if (!unassignedLoc) {
    // Generar un ID aleatorio usando el helper o manual
    const count = await prisma.itemLocation.count();
    const fallbackId = `LOC-${String(count + 1000).padStart(3, '0')}`;
    unassignedLoc = await prisma.itemLocation.create({
      data: { name: 'Sin Asignación', internal_id: fallbackId }
    });
  }
  const unassignedLocId = unassignedLoc.id;

  const data = parse(readImportFileUtf8(itemFile), { columns: true, skip_empty_lines: true });

  // Extraer y crear UOMs faltantes
  try {
    const uomSet = new Set<string>();
    for (const row of data as any[]) {
      if (row['UOM']) {
        uomSet.add(row['UOM'].toUpperCase());
      }
    }
    
    const existingUoms = await prisma.unitOfMeasure.findMany();
    const existingUomNames = new Set(existingUoms.map(u => u.name));
    const newUoms = Array.from(uomSet).filter(u => !existingUomNames.has(u));
    
    if (newUoms.length > 0) {
      await prisma.unitOfMeasure.createMany({
        data: newUoms.map(name => ({ name })),
        skipDuplicates: true
      });
    }
  } catch (uomError) {
    throw uomError;
  }

  for (let _i = 0; _i < data.length; _i++) {
    const row = data[_i] as any;
    const csvLine = _i + 2; // la fila 1 es el encabezado
    try {
      let uom = row['UOM'] ? row['UOM'].toUpperCase() : 'PIEZAS';
      
      const rawCost = (row['Purchase Cost'] || '').toString().trim();
      let cost: number | null = rawCost
        ? parseFloat(rawCost.replace(/[^0-9.-]+/g, ''))
        : null;
      if (cost !== null && !Number.isFinite(cost)) cost = null;
      let stock = parseFloat(row['Stock']) || 0;
      let minStock = parseFloat(row['Minimum Inventory']) || 0;
      
      // Compatibilidad con archivos que tienen error de encoding en la pregunta inicial "¿Discontinued?"
      const isDiscontinued = row['¿Discontinued?'] === 'TRUE' || row['Discontinued?'] === 'TRUE';
      
      const id = (row['Item ID'] || '').trim();
      const name = (row['Name'] || '').trim();
      if (!id) continue;
      
      await prisma.item.upsert({
        where: { internal_code: id },
        update: {
          name: name || 'Sin nombre',
          description: row['Description'],
          image_url: row['Image'],
          category_id: catMap[(row['Category'] || '').trim()] || null,
          vendor_id: venMap[(row['Vendor'] || '').trim()] || null,
          location_id: locMap[(row['Location'] || '').trim()] || unassignedLocId,
          purchase_cost: cost,
          minimum_inventory: minStock,
          is_active: !isDiscontinued,
          uom: uom
        },
        create: {
          internal_code: id,
          name: name || 'Sin nombre',
          description: row['Description'],
          image_url: row['Image'],
          category_id: catMap[(row['Category'] || '').trim()] || null,
          vendor_id: venMap[(row['Vendor'] || '').trim()] || null,
          location_id: locMap[(row['Location'] || '').trim()] || unassignedLocId,
          purchase_cost: cost,
          stock: stock,
          minimum_inventory: minStock,
          is_active: !isDiscontinued,
          uom: uom
        }
      });
      results.items++;
    } catch (e) {
      pushImportRowWarning('Repuestos', csvLine, e);
    }
  }

  // Ítems categoría ACTIVOS → módulo Activos (upsert por nombre / código).
  // No borra filas de inventario; sección queda null (CSV sin columna de sección).
  if (skipAssets) {
    results.assets = { created: 0, updated: 0, skipped: 0, zonesEnsured: [] };
  } else {
    try {
      const assetSync = await syncAssetsFromActivosInventory(prisma);
      results.assets = {
        created: assetSync.created,
        updated: assetSync.updated,
        skipped: assetSync.skipped,
        zonesEnsured: assetSync.zonesEnsured,
      };
    } catch (assetErr) {
      throw assetErr;
    }
  }
}

if (userFile) {
  const data = parse(readImportFileUtf8(userFile), { columns: true, skip_empty_lines: true });
  const defaultHash = await bcrypt.hash('CMMS2026*', 10);

  // Normaliza nombres para emparejar (evita duplicados por mayúsculas/acentos).
  const normalizeUserName = (name: unknown): string =>
    String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  // Mapas de usuarios existentes por email y por nombre normalizado.
  const allUsers = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
  const userByEmail = new Map<string, { id: string; name: string; email: string }>();
  const userByNormName = new Map<string, { id: string; name: string; email: string }>();
  for (const u of allUsers) {
    userByEmail.set((u.email || '').toLowerCase(), u);
    const key = normalizeUserName(u.name);
    if (key && !userByNormName.has(key)) userByNormName.set(key, u);
  }

  for (let _i = 0; _i < data.length; _i++) {
    const row = data[_i] as any;
    const csvLine = _i + 2; // la fila 1 es el encabezado
    try {
      const email = row['Email'] ? String(row['Email']).trim() : '';
      if (!email) continue;

      const name = row['Name'] ? String(row['Name']).trim() : '';

      let role: Role = Role.TECNICO;
      const csvRol = row['Rol'] ? String(row['Rol']).toUpperCase() : '';
      if (csvRol.includes('ADMINISTRADOR')) role = Role.ADMINISTRADOR;
      else if (csvRol.includes('GESTIONADOR')) role = Role.GESTIONADOR;

      const isActive = row['¿Active?'] === 'TRUE';
      const emailKey = email.toLowerCase();
      const nameKey = normalizeUserName(name);

      // 1) Si ya existe por email, actualízalo.
      const byEmail = userByEmail.get(emailKey);
      if (byEmail) {
        await prisma.user.update({
          where: { id: byEmail.id },
          data: { name: name || byEmail.name, role, is_active: isActive },
        });
        userByEmail.set(emailKey, { ...byEmail, name: name || byEmail.name });
        results.users++;
        continue;
      }

      // 2) Si ya existe por nombre (p. ej. creado por el calendario con @fiix.com),
      //    reutilízalo y actualiza su email en vez de duplicar.
      const byName = nameKey ? userByNormName.get(nameKey) : undefined;
      if (byName) {
        await prisma.user.update({
          where: { id: byName.id },
          data: { name: name || byName.name, email, role, is_active: isActive },
        });
        userByEmail.set(emailKey, { ...byName, email, name: name || byName.name });
        userByNormName.set(nameKey, { ...byName, email, name: name || byName.name });
        results.users++;
        continue;
      }

      // 3) No existe: créalo.
      const created = await prisma.user.create({
        data: {
          name,
          email,
          password_hash: defaultHash,
          role,
          is_active: isActive,
          must_change_password: true,
        },
      });
      userByEmail.set(emailKey, { id: created.id, name: created.name, email: created.email });
      if (nameKey) userByNormName.set(nameKey, { id: created.id, name: created.name, email: created.email });
      results.users++;
    } catch (e) {
      throw new CsvImportError(`Usuarios: ${e instanceof Error ? e.message : e}. Lote revertido.`);
      pushImportRowWarning('Usuarios', csvLine, e);
    }
  }
}

if (invFile) {
  // Importe seguro de movimientos: SIN truncar el historial. Solo crea filas que
  // no existan (dedupe por Inventory ID / tupla) y reporta filas ignoradas.
  const inv = await importInventoryTransactionsFile(invFile, { client: prisma, strict: true });
  results.inventory = inv.created;
  results.users += inv.autoCreatedUsers;
  if (inv.skippedExisting > 0 || inv.ignored.length > 0) {
    results.inventoryDetails = {
      created: inv.created,
      skippedExisting: inv.skippedExisting,
      ignoredTotal: inv.ignored.length,
      ignored: inv.ignored.slice(0, 200),
    };
  }
}

if (woFile) {
  const data = parse(readImportFileUtf8(woFile), { columns: true, skip_empty_lines: true });
  const allUsers = await prisma.user.findMany();
  const adminUser = allUsers.find(u => u.role === 'ADMINISTRADOR') || allUsers[0];
  
  if (adminUser) {
    let csvRowNum = 1; // la fila 1 es el encabezado
    for (const row of data as any[]) {
      csvRowNum++;
      try {
        const folioCsv = parseWorkOrderFolio(row['FOLIO']);
        if (!folioCsv) continue;

        // Misma lógica histórica: Zona: / Equipo: por nombre. El CSV de Solicitudes
        // no trae columna de sección → activos quedan sin sección (zone_section_id null).
        // No inventar secciones A–E ni exigir columnas nuevas.
        let zoneName = row['Zona:'] ? row['Zona:'].trim() : 'Sin Zona';
        if(zoneName === 'N/A' || !zoneName) zoneName = 'Sin Zona';
        let zone = await prisma.zone.findUnique({ where: { name: zoneName } });
        if (!zone) {
           zone = await prisma.zone.create({
             data: { name: zoneName, has_sections: false },
           });
        }

        let assetName = row['Equipo:'] ? row['Equipo:'].trim() : 'Sin Equipo';
        if(assetName === 'N/A' || !assetName) assetName = 'Sin Equipo';
        let asset = await prisma.asset.findFirst({ where: { name: assetName } });
        if (!asset) {
           // Sin código en el CSV de OT → esquema MTTO; si hubiera código importado se conservaría.
           // section / zone_section_id explícitamente null (= «Sin sección»), como antes.
           asset = await prisma.asset.create({
              data: {
                 internal_code: await generateAssetInternalCode({
                   name: assetName,
                   zoneId: zone.id,
                   section: null,
                   assetKind: AssetKind.FIJO,
                   tx: prisma,
                 }),
                 name: assetName,
                 brand: 'N/A',
                 model: 'N/A',
                 status: AssetStatus.OPERATIVO,
                 asset_kind: AssetKind.FIJO,
                 section: null,
                 zone_section_id: null,
                 zone_id: zone.id
              }
           });
        }

        let priority: Priority = Priority.NORMAL;
        if (row['Prioridad:']) {
          const pStr = row['Prioridad:'].toUpperCase();
          if (pStr.includes('1') || pStr.includes('URGENTE')) priority = Priority.URGENTE;
          else if (pStr.includes('2') || pStr.includes('NORMAL')) priority = Priority.NORMAL;
          else if (pStr.includes('3') || pStr.includes('PROGRAMA') || pStr.includes('BAJO')) priority = Priority.BAJO;
        }

        let type: MaintenanceType = MaintenanceType.CORRECTIVO;
        if (row['Tipo de mantenimiento:']) {
          const tStr = row['Tipo de mantenimiento:'].toUpperCase();
          if (tStr.includes('SERVICIO')) type = MaintenanceType.SERVICIO;
          else if (tStr.includes('PREVENTIVO')) type = MaintenanceType.PREVENTIVO;
        }

        let status: WorkOrderStatus = WorkOrderStatus.PENDIENTE;
        if (row['ESTADO']) {
           const st = row['ESTADO'].toUpperCase();
           if (st.includes('FINALIZADO')) status = WorkOrderStatus.FINALIZADO;
           else if (st.includes('PROCESO')) status = WorkOrderStatus.EN_PROCESO;
           else if (st.includes('ESPERA') || st.includes('PAUSAD')) status = WorkOrderStatus.EN_ESPERA;
           else if (st.includes('ANULADO')) status = WorkOrderStatus.ANULADO;
        }

        if (row['INVALIDA'] && (row['INVALIDA'].toUpperCase() === 'TRUE' || row['INVALIDA'].toUpperCase() === 'SI' || row['INVALIDA'].toUpperCase() === 'SÍ')) {
           status = WorkOrderStatus.ANULADO;
        }

        let techEmails = row['EMAIL DEL TÉCNICO'] ? row['EMAIL DEL TÉCNICO'].split(',').map((e: string) => e.trim()) : [];
        let assignedUserIds = allUsers.filter(u => techEmails.includes(u.email)).map(u => ({ id: u.id }));

        let created_at = parseSafeDate(row['Marca temporal']) || new Date();
        let started_at = parseSafeDate(row['FECHA INICIO']);
        let completed_at = parseSafeDate(row['FECHA FINALIZACIÓN'] || row['FECHA FINALIZACION']);
        
        const machine_stopped = row['¿Paró máquina por la falla?']?.toUpperCase() === 'SI' || row['¿Paró máquina por la falla?']?.toUpperCase() === 'SÍ';
        
        let pGroup: ProductionGroup = ProductionGroup.NA;
        if (row['Grupo:']) {
           const gStr = row['Grupo:'].toUpperCase();
           if (gStr.includes('A')) pGroup = ProductionGroup.A;
           if (gStr.includes('B')) pGroup = ProductionGroup.B;
           if (gStr.includes('C')) pGroup = ProductionGroup.C;
           if (gStr.includes('D')) pGroup = ProductionGroup.D;
        }

        const rawRequesterName = row['Nombre del solicitante:'];
        const requester_name = rawRequesterName ? rawRequesterName.trim() : 'Desconocido';

        if (requester_name !== 'Desconocido' && requester_name !== '') {
           try {
             await prisma.requester.upsert({
               where: { name: requester_name },
               update: {},
               create: { name: requester_name }
             });
           } catch(e) {
             throw e;
           }
        }

        let existingWO = await prisma.workOrder.findFirst({ where: { folio: folioCsv } });
        
        let resolutionNotes = row['ACTIVIDAD REALIZADA'];
        if (status === WorkOrderStatus.ANULADO && (!resolutionNotes || resolutionNotes.trim() === '')) {
           resolutionNotes = 'Anulada según registro histórico (CSV).';
        }

        // Columna accumulated_time_ms es int64 (BigInt) desde v1.57: sin recorte,
        // el tiempo histórico se conserva completo (antes se limitaba a ~24.8 días).
        const repairMs = Math.max(0, Math.floor(parseNumber(row['TIEMPO REPARACIÓN']) * 60000));

        const woData = {
           title: row['Descripción de la falla:']?.substring(0, 100) || 'Sin título',
           description: row['Descripción de la falla:'],
           asset_id: asset.id,
           zone_id: zone.id,
           priority,
           maintenance_type: type,
           machine_stopped,
           requester_name,
           production_group: pGroup,
           status,
           hold_reason: row['RAZON PAUSA'] || null,
           resolution_notes: resolutionNotes,
           created_by_id: adminUser.id,
           created_at,
           started_at,
           paused_at: parseSafeDate(row['HORA PAUSA']) || null,
           completed_at: status === WorkOrderStatus.ANULADO && !completed_at ? new Date() : completed_at,
           accumulated_time_ms: repairMs,
           assigned_technicians: { connect: assignedUserIds }
        };

        // Mapear fotos aunque el upsert falle después (p. ej. datos raros).
        const beforePath = sanitizeWorkOrderPhotoPath(row['FOTO ANTES']);
        const afterPath = sanitizeWorkOrderPhotoPath(row['FOTO DESPUÉS']);
        if (beforePath || afterPath) {
          woPhotoMappings.push({ folio: folioCsv, beforePath, afterPath });
        }

        if (existingWO) {
           await prisma.workOrder.update({
              where: { id: existingWO.id },
              data: woData
           });
        } else {
           await prisma.workOrder.create({
              data: { ...woData, folio: folioCsv }
           });
        }
        results.orders++;
      } catch(e) {
        throw new CsvImportError(`Órdenes, fila ${csvRowNum}: ${e instanceof Error ? e.message : e}. Lote revertido.`);
      }
    }

    // Fix sequence for folio
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"WorkOrder"', 'folio'), coalesce(max(folio), 0) + 1, false) FROM "WorkOrder";`);
  }
}

}, { maxWait: 10000, timeout: 600000 });
// Las fotos son un paso independiente y recuperable; no bloquean la transacción de datos.

// Fotos de repuestos: zip > Google Drive (carpeta pública) > data/Items_Images/
try {
if (zipFile?.path) {
  try {
    const photoResult = await assignItemImagesFromZip(zipFile.path);
    results.itemImages = {
      matched: photoResult.matched,
      missing: photoResult.missing,
      skipped: photoResult.skipped,
      assetsMatched: photoResult.assetsMatched,
      folderFound: photoResult.folderFound,
      filesScanned: photoResult.filesScanned,
      source: 'zip',
    };
  } catch (photoErr) {
    console.error('Item images import error:', photoErr);
    results.itemImages = {
      matched: 0,
      missing: 0,
      skipped: 0,
      assetsMatched: 0,
      folderFound: false,
      filesScanned: 0,
      source: 'zip',
    };
  }
} else if (useGoogleDrive && driveApiKey && itemsFolderId) {
  try {
    const dl = await downloadPublicDriveFolderToTemp(
      itemsFolderId,
      driveApiKey,
      'items',
      (p) => reportDriveProgress(p, 55, 18)
    );
    driveItemsTemp = dl.dir;
    setImportProgress('assign_photos', 74, 'Asignando fotos de inventario…', {
      downloaded: dl.filesDownloaded,
      total: dl.filesDownloaded,
      listed: dl.filesListed,
      label: 'items',
    });
    const photoResult = await assignItemImagesFromFolder(dl.dir);
    results.itemImages = {
      matched: photoResult.matched,
      missing: photoResult.missing,
      skipped: photoResult.skipped + dl.skipped,
      assetsMatched: photoResult.assetsMatched,
      folderFound: photoResult.folderFound,
      filesScanned: photoResult.filesScanned || dl.filesDownloaded,
      source: 'google_drive',
      driveListed: dl.filesListed,
      driveDownloaded: dl.filesDownloaded,
      driveErrors: dl.errors,
    };
  } catch (photoErr: any) {
    console.error('Item images Drive import error:', photoErr);
    results.itemImages = {
      matched: 0,
      missing: 0,
      skipped: 0,
      assetsMatched: 0,
      folderFound: false,
      filesScanned: 0,
      source: 'google_drive',
      error: photoErr?.message || String(photoErr),
    };
  }
} else if (includeLocalPhotoFolders) {
  try {
    const photoResult = await assignItemImagesFromFolder();
    if (photoResult.folderFound && photoResult.filesScanned > 0) {
      results.itemImages = {
        matched: photoResult.matched,
        missing: photoResult.missing,
        skipped: photoResult.skipped,
        assetsMatched: photoResult.assetsMatched,
        folderFound: photoResult.folderFound,
        filesScanned: photoResult.filesScanned,
        source: 'data_folder',
      };
    }
  } catch (photoErr) {
    console.error('Item images folder import error:', photoErr);
  }
}

// Logos de proveedores: zip > Google Drive > data/Vendors_Images/
try {
if (vendorZipFile?.path) {
  try {
    const logoResult = await assignVendorLogosFromZip(vendorZipFile.path);
    results.vendorImages = {
      matched: logoResult.matched,
      missing: logoResult.missing,
      skipped: logoResult.skipped,
      folderFound: logoResult.folderFound,
      filesScanned: logoResult.filesScanned,
      source: 'zip',
    };
  } catch (logoErr) {
    console.error('Vendor logos import error:', logoErr);
    results.vendorImages = {
      matched: 0,
      missing: 0,
      skipped: 0,
      folderFound: false,
      filesScanned: 0,
      source: 'zip',
    };
  }
} else if (useGoogleDrive && driveApiKey && vendorsFolderId) {
  try {
    const dl = await downloadPublicDriveFolderToTemp(
      vendorsFolderId,
      driveApiKey,
      'vendors',
      (p) => reportDriveProgress(p, 72, 6)
    );
    driveVendorsTemp = dl.dir;
    setImportProgress('assign_photos', 78, 'Asignando logos de proveedores…', {
      downloaded: dl.filesDownloaded,
      total: dl.filesDownloaded,
      listed: dl.filesListed,
      label: 'vendors',
    });
    const logoResult = await assignVendorLogosFromFolder(dl.dir);
    results.vendorImages = {
      matched: logoResult.matched,
      missing: logoResult.missing,
      skipped: logoResult.skipped + dl.skipped,
      folderFound: logoResult.folderFound,
      filesScanned: logoResult.filesScanned || dl.filesDownloaded,
      source: 'google_drive',
      driveListed: dl.filesListed,
      driveDownloaded: dl.filesDownloaded,
      driveErrors: dl.errors,
    };
  } catch (logoErr: any) {
    console.error('Vendor logos Drive import error:', logoErr);
    results.vendorImages = {
      matched: 0,
      missing: 0,
      skipped: 0,
      folderFound: false,
      filesScanned: 0,
      source: 'google_drive',
      error: logoErr?.message || String(logoErr),
    };
  }
} else if (includeLocalPhotoFolders) {
  try {
    const logoResult = await assignVendorLogosFromFolder();
    if (logoResult.folderFound && logoResult.filesScanned > 0) {
      results.vendorImages = {
        matched: logoResult.matched,
        missing: logoResult.missing,
        skipped: logoResult.skipped,
        folderFound: logoResult.folderFound,
        filesScanned: logoResult.filesScanned,
        source: 'data_folder',
      };
    }
  } catch (logoErr) {
    console.error('Vendor logos folder import error:', logoErr);
  }
}
} catch (vendorPhotosOuterErr) {
  console.error('Vendor logos block error:', vendorPhotosOuterErr);
}

// Fotos antes/después de OT: zip > Google Drive > data/Formulario Solicitudes_Images/
if (woZipFile?.path && woPhotoMappings.length > 0) {
  try {
    const woPhotoResult = await assignWorkOrderImagesFromZip(woZipFile.path, woPhotoMappings);
    results.workOrderImages = {
      matched: woPhotoResult.matched,
      missing: woPhotoResult.missing,
      skipped: woPhotoResult.skipped,
      folderFound: woPhotoResult.folderFound,
      filesScanned: woPhotoResult.filesScanned,
      beforeAssigned: woPhotoResult.beforeAssigned,
      afterAssigned: woPhotoResult.afterAssigned,
      source: 'zip',
    };
  } catch (woPhotoErr) {
    console.error('Work order images import error:', woPhotoErr);
    results.workOrderImages = {
      matched: 0,
      missing: 0,
      skipped: 0,
      folderFound: false,
      filesScanned: 0,
      beforeAssigned: 0,
      afterAssigned: 0,
      source: 'zip',
    };
  }
} else if (woPhotoMappings.length > 0 && !woZipFile && useGoogleDrive && driveApiKey && woFolderId) {
  try {
    const dl = await downloadPublicDriveFolderToTemp(
      woFolderId,
      driveApiKey,
      'wo',
      (p) => reportDriveProgress(p, 76, 18)
    );
    driveWoTemp = dl.dir;
    setImportProgress('assign_photos', 95, 'Asignando fotos de órdenes…', {
      downloaded: dl.filesDownloaded,
      total: dl.filesDownloaded,
      listed: dl.filesListed,
      label: 'wo',
    });
    const woPhotoResult = await assignWorkOrderImagesFromFolder(dl.dir, woPhotoMappings);
    results.workOrderImages = {
      matched: woPhotoResult.matched,
      missing: woPhotoResult.missing,
      skipped: woPhotoResult.skipped + dl.skipped,
      folderFound: woPhotoResult.folderFound,
      filesScanned: woPhotoResult.filesScanned || dl.filesDownloaded,
      beforeAssigned: woPhotoResult.beforeAssigned,
      afterAssigned: woPhotoResult.afterAssigned,
      source: 'google_drive',
      driveListed: dl.filesListed,
      driveDownloaded: dl.filesDownloaded,
      driveErrors: dl.errors,
    };
  } catch (woPhotoErr: any) {
    console.error('Work order images Drive import error:', woPhotoErr);
    results.workOrderImages = {
      matched: 0,
      missing: woPhotoMappings.length,
      skipped: 0,
      folderFound: false,
      filesScanned: 0,
      beforeAssigned: 0,
      afterAssigned: 0,
      source: 'google_drive',
      error: woPhotoErr?.message || String(woPhotoErr),
    };
  }
} else if (woPhotoMappings.length > 0 && !woZipFile && includeLocalPhotoFolders) {
  try {
    const woPhotoResult = await assignWorkOrderImagesFromFolder(
      getWorkOrderImagesDir(),
      woPhotoMappings
    );
    if (woPhotoResult.folderFound && woPhotoResult.filesScanned > 0) {
      results.workOrderImages = {
        matched: woPhotoResult.matched,
        missing: woPhotoResult.missing,
        skipped: woPhotoResult.skipped,
        folderFound: woPhotoResult.folderFound,
        filesScanned: woPhotoResult.filesScanned,
        beforeAssigned: woPhotoResult.beforeAssigned,
        afterAssigned: woPhotoResult.afterAssigned,
        source: 'data_folder',
      };
    } else {
      results.workOrderImages = {
        matched: 0,
        missing: woPhotoMappings.length,
        skipped: 0,
        folderFound: woPhotoResult.folderFound,
        filesScanned: woPhotoResult.filesScanned,
        beforeAssigned: 0,
        afterAssigned: 0,
        source: 'data_folder',
      };
    }
  } catch (woPhotoErr) {
    console.error('Work order images folder import error:', woPhotoErr);
    results.workOrderImages = {
      matched: 0,
      missing: woPhotoMappings.length,
      skipped: 0,
      folderFound: false,
      filesScanned: 0,
      beforeAssigned: 0,
      afterAssigned: 0,
      source: 'data_folder',
    };
  }
} else if (woZipFile && woPhotoMappings.length === 0) {
  results.workOrderImages = {
    matched: 0,
    missing: 0,
    skipped: 0,
    folderFound: true,
    filesScanned: 0,
    beforeAssigned: 0,
    afterAssigned: 0,
    source: 'zip',
  };
}
} finally {
  // La limpieza de /tmp puede tardar minutos con miles de fotos; no bloquear
  // el «done» ni la respuesta HTTP (el modal del cliente se quedaba colgado).
  const itemsTmp = driveItemsTemp;
  const vendorsTmp = driveVendorsTemp;
  const woTmp = driveWoTemp;
  setImmediate(() => {
    rmTempDirSafe(itemsTmp);
    rmTempDirSafe(vendorsTmp);
    rmTempDirSafe(woTmp);
  });
}

  emitRefresh('refresh_work_orders');
  emitRefresh('refresh_inventory');
  emitRefresh('refresh_assets');
  setImportProgress('done', 100, 'Importación terminada', { active: false });
  return results;
}
