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
  rmTempDirSafe,
} from './googleDriveImport';

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
  workOrderImages?: PhotoImportSummary & {
    beforeAssigned: number;
    afterAssigned: number;
  };
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

export type ProcessCsvImportOptions = {
  /** Si false, no intenta data/Items_Images ni data/Formulario… cuando no hay zip. Default true. */
  includeLocalPhotoFolders?: boolean;
  /** Si true y hay API key + carpeta configurada, baja fotos de Drive cuando no hay zip. */
  useGoogleDrive?: boolean;
  /** Override opcional de carpeta (URL o ID); si falta usa GOOGLE_DRIVE_*_FOLDER. */
  driveItemsFolder?: string | null;
  driveWoFolder?: string | null;
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

/**
 * Motor compartido de importación CSV (upload o Sheets → temps).
 * Emite refresh de sockets al terminar con éxito.
 */
export async function processCsvImportFiles(
  files: ImportFileLike[],
  options: ProcessCsvImportOptions & {
    zipFile?: ImportFileLike | null;
    woZipFile?: ImportFileLike | null;
  } = {}
): Promise<CsvImportResults> {
  const includeLocalPhotoFolders = options.includeLocalPhotoFolders !== false;
  const useGoogleDrive = Boolean(options.useGoogleDrive);
  const zipFile = options.zipFile ?? null;
  const woZipFile = options.woZipFile ?? null;
  const driveApiKey = useGoogleDrive ? getDriveApiKey() : null;
  const itemsFolderId =
    extractDriveFolderId(options.driveItemsFolder) || (useGoogleDrive ? getDriveItemsFolderId() : null);
  const woFolderId =
    extractDriveFolderId(options.driveWoFolder) || (useGoogleDrive ? getDriveWoFolderId() : null);
  let driveItemsTemp: string | null = null;
  let driveWoTemp: string | null = null;

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

const results: {
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
  workOrderImages?: PhotoImportSummary & {
    beforeAssigned: number;
    afterAssigned: number;
  };
} = { categories: 0, locations: 0, vendors: 0, items: 0, users: 0, inventory: 0, orders: 0 };

const woPhotoMappings: WorkOrderPhotoMapping[] = [];

if (catFile) {
  const data = parse(readImportFileUtf8(catFile), { columns: true, skip_empty_lines: true });
  for (const row of data as any[]) {
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
    } catch (e) {}
  }
}

if (locFile) {
  const data = parse(readImportFileUtf8(locFile), { columns: true, skip_empty_lines: true });
  for (const row of data as any[]) {
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
    } catch (e) {}
  }
}

if (venFile) {
  const data = parse(readImportFileUtf8(venFile), { columns: true, skip_empty_lines: true });
  for (const row of data as any[]) {
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
    } catch (e) {}
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
    console.error('Error auto-creando UOMs:', uomError);
  }

  for (const row of data as any[]) {
    try {
      let uom = row['UOM'] ? row['UOM'].toUpperCase() : 'PIEZAS';
      
      let cost = row['Purchase Cost'] ? parseFloat(row['Purchase Cost'].replace(/[^0-9.-]+/g,"")) : 0;
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
          stock: stock,
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
    } catch (e) {}
  }

  // Ítems categoría ACTIVOS → módulo Activos (upsert por nombre / código).
  // No borra filas de inventario; sección queda null (CSV sin columna de sección).
  try {
    const assetSync = await syncAssetsFromActivosInventory();
    results.assets = {
      created: assetSync.created,
      updated: assetSync.updated,
      skipped: assetSync.skipped,
      zonesEnsured: assetSync.zonesEnsured,
    };
  } catch (assetErr) {
    console.error('Asset inventory sync error:', assetErr);
    results.assets = { created: 0, updated: 0, skipped: 0, zonesEnsured: [] };
  }
}

if (userFile) {
  const data = parse(readImportFileUtf8(userFile), { columns: true, skip_empty_lines: true });
  const defaultHash = await bcrypt.hash('CMMS2026*', 10);
  for (const row of data as any[]) {
    try {
      const email = row['Email'] ? row['Email'].trim() : null;
      if (!email) continue;
      
      let role: Role = Role.TECNICO;
      const csvRol = row['Rol'] ? row['Rol'].toUpperCase() : '';
      if (csvRol.includes('ADMINISTRADOR')) role = Role.ADMINISTRADOR;
      else if (csvRol.includes('GESTIONADOR')) role = Role.GESTIONADOR;

      const isActive = row['¿Active?'] === 'TRUE';

      await prisma.user.upsert({
        where: { email: email },
        update: {
          name: row['Name'],
          role: role,
          is_active: isActive
        },
        create: {
          name: row['Name'],
          email: email,
          password_hash: defaultHash,
          role: role,
          is_active: isActive,
          must_change_password: true,
        }
      });
      results.users++;
    } catch (e) {
      console.error('User import error', e);
    }
  }
}

if (invFile) {
  const data = parse(readImportFileUtf8(invFile), { columns: true, skip_empty_lines: true });
  const allUsers = await prisma.user.findMany();
  const allItems = await prisma.item.findMany();
  const userMap: Record<string, string> = Object.fromEntries(allUsers.map(u => [u.email, u.id]));
  const itemMap = Object.fromEntries(allItems.map(i => [i.internal_code, i.id]));

  // Auto-crear usuarios que aparecen en movimientos pero no vienen en Users.csv,
  // para no perder transacciones históricas de inventario.
  const invDefaultHash = await bcrypt.hash('CMMS2026*', 10);
  const missingEmails = new Set<string>();
  for (const row of data as any[]) {
    const email = row['User ID'] ? row['User ID'].trim() : '';
    if (email && !userMap[email]) missingEmails.add(email);
  }
  for (const email of missingEmails) {
    try {
      const created = await prisma.user.create({
        data: {
          name: email.split('@')[0],
          email,
          password_hash: invDefaultHash,
          role: Role.TECNICO,
          is_active: false,
          must_change_password: true,
        }
      });
      userMap[email] = created.id;
      results.users++;
    } catch (e) {
      console.error('Inventory user auto-create error', email, e);
    }
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "InventoryTransaction" CASCADE;`);
  
  const invCreates = [];
  for (const row of data as any[]) {
    const email = row['User ID'] ? row['User ID'].trim() : null;
    const itemCode = row['Item ID'] ? row['Item ID'].trim() : null;
    
    if (email && itemCode && userMap[email] && itemMap[itemCode]) {
      let date = parseSafeDate(row['DateTime']) || new Date();

      invCreates.push({
        item_id: itemMap[itemCode],
        user_id: userMap[email],
        amount: parseNumber(row['Amount']),
        reason: row['Reason'] || 'Sin motivo',
        created_at: date
      });
    }
  }
  await prisma.inventoryTransaction.createMany({ data: invCreates });
  results.inventory = invCreates.length;
}

if (woFile) {
  const data = parse(readImportFileUtf8(woFile), { columns: true, skip_empty_lines: true });
  const allUsers = await prisma.user.findMany();
  const adminUser = allUsers.find(u => u.role === 'ADMINISTRADOR') || allUsers[0];
  
  if (adminUser) {
    for (const row of data as any[]) {
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
        let completed_at = parseSafeDate(row['FECHA FINALIZACIÓN']);
        
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
             // Ignorar si hay problemas de concurrencia o duplicados raros
           }
        }

        let existingWO = await prisma.workOrder.findFirst({ where: { folio: folioCsv } });
        
        let resolutionNotes = row['ACTIVIDAD REALIZADA'];
        if (status === WorkOrderStatus.ANULADO && (!resolutionNotes || resolutionNotes.trim() === '')) {
           resolutionNotes = 'Anulada según registro histórico (CSV).';
        }

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
           accumulated_time_ms: Math.min(
             2147483647,
             Math.max(0, Math.floor(parseNumber(row['TIEMPO REPARACIÓN']) * 60000))
           ),
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
        console.error('Work order row error', e);
      }
    }

    // Fix sequence for folio
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"WorkOrder"', 'folio'), coalesce(max(folio), 0) + 1, false) FROM "WorkOrder";`);
  }
}

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
    const dl = await downloadPublicDriveFolderToTemp(itemsFolderId, driveApiKey, 'items');
    driveItemsTemp = dl.dir;
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
    const dl = await downloadPublicDriveFolderToTemp(woFolderId, driveApiKey, 'wo');
    driveWoTemp = dl.dir;
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
  rmTempDirSafe(driveItemsTemp);
  rmTempDirSafe(driveWoTemp);
}


  emitRefresh('refresh_work_orders');
  emitRefresh('refresh_inventory');
  emitRefresh('refresh_assets');
  return results;
}
