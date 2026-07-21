import express, { Request, Response } from 'express';
import prisma from '../config/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { Role, AssetStatus, WorkOrderStatus, Priority, MaintenanceType, ProductionGroup } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateInventoryCode } from '../utils/codeGenerator';
import { parseWorkOrderFolio } from '../utils/folio';
import { runBackup, listBackups, runRestore } from '../utils/backupService';
import { assignItemImagesFromFolder } from '../utils/itemImageImport';

const router = express.Router();

// Multer in-memory storage for CSV imports
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to verify the developer password
const verifyDevPassword = async (req: Request, res: Response, next: express.NextFunction): Promise<void> => {
  const password = req.headers['x-dev-password'] as string;

  if (!password) {
    res.status(401).json({ message: 'Se requiere contraseña.' });
    return;
  }

  try {
    // 1) Contraseña maestra personalizada guardada en BD (cambiable desde la app)
    const settings = await prisma.systemSettings.findFirst();
    if (settings?.dev_menu_password_hash) {
      const matchesCustomHash = await bcrypt.compare(password, settings.dev_menu_password_hash);
      if (matchesCustomHash) {
        next();
        return;
      }
    }

    // 2) Fallback a variable de entorno (o clave de emergencia) para prevenir bloqueo si la BD se vacía
    const envPassword = process.env.DEV_MENU_PASSWORD || 'DavidG.Q.1991';
    if (password === envPassword) {
      next();
      return;
    }

    const admins = await prisma.user.findMany({
      where: { role: 'ADMINISTRADOR', is_active: true }
    });

    let isValid = false;
    for (const admin of admins) {
      if (!admin.password_hash) continue;
      const match = await bcrypt.compare(password, admin.password_hash);
      // DEV VERIFY
      if (match) {
        isValid = true;
        break;
      }
    }

    if (!isValid) {
      // DEV VERIFY Invalid
      res.status(401).json({ message: 'Contraseña de administrador incorrecta.' });
      return;
    }

    next();
  } catch (error) {
    console.error(`[DEV VERIFY] Error:`, error);
    res.status(500).json({ message: 'Error verificando credenciales.' });
  }
};

router.post('/verify', verifyDevPassword, (req: Request, res: Response) => {
  res.json({ success: true, message: 'Password is valid.' });
});

router.get('/settings', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          email_enabled: false,
        },
      });
    }
    res.json({
      telegram_bot_token: settings.telegram_bot_token || '',
      telegram_chat_id: settings.telegram_chat_id || ''
    });
  } catch (error) {
    console.error('Error fetching dev settings:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

router.post('/settings', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const { telegram_bot_token, telegram_chat_id } = req.body;
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          telegram_bot_token,
          telegram_chat_id,
        },
      });
    } else {
      await prisma.systemSettings.update({
        where: { id: settings.id },
        data: {
          telegram_bot_token,
          telegram_chat_id,
        },
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating dev settings:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// Cambia la contraseña maestra de Opciones de Desarrollador. Protegida por la
// contraseña ACTUAL (header x-dev-password, validada por verifyDevPassword);
// el body solo confirma cuál es esa contraseña actual para el registro/UX.
router.post('/change-password', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const { newPassword } = req.body as { currentPassword?: string; newPassword?: string };

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    let settings = await prisma.systemSettings.findFirst();

    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          telegram_enabled: true,
          email_enabled: false,
          dev_menu_password_hash: newHash,
        },
      });
    } else {
      settings = await prisma.systemSettings.update({
        where: { id: settings.id },
        data: { dev_menu_password_hash: newHash },
      });
    }

    // Best-effort: refleja también en backend/.env para servidores que aún lean DEV_MENU_PASSWORD.
    // La BD (hash) es la fuente de verdad; si esto falla no se interrumpe la operación.
    try {
      const envPath = path.join(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf-8');
        const escaped = newPassword.replace(/"/g, '\\"');
        if (/^DEV_MENU_PASSWORD=.*$/m.test(content)) {
          content = content.replace(/^DEV_MENU_PASSWORD=.*$/m, `DEV_MENU_PASSWORD="${escaped}"`);
        } else {
          content += `${content.endsWith('\n') ? '' : '\n'}DEV_MENU_PASSWORD="${escaped}"\n`;
        }
        fs.writeFileSync(envPath, content, 'utf-8');
      }
    } catch (envError) {
      console.warn('[DEV] No se pudo actualizar backend/.env con la nueva contraseña (no crítico):', envError);
    }

    res.json({ success: true, message: 'Contraseña maestra actualizada con éxito.' });
  } catch (error: any) {
    console.error('Error changing dev password:', error);
    res.status(500).json({ message: 'Error al cambiar la contraseña.', error: error.message });
  }
});

// Respaldo manual (BD + uploads) disparado desde Opciones de Desarrollador.
router.post('/backup', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await runBackup();
    res.json(result);
  } catch (error: any) {
    console.error('Error running manual backup:', error);
    res.status(500).json({ success: false, message: 'Error al generar el respaldo.', error: error.message });
  }
});

// Lista respaldos recientes en BACKUP_DIR (fiix_*.sql.gz).
router.get('/backups', verifyDevPassword, async (_req: Request, res: Response): Promise<void> => {
  try {
    const backups = listBackups();
    res.json({ backups, backupDir: process.env.BACKUP_DIR || undefined });
  } catch (error: any) {
    console.error('Error listing backups:', error);
    res.status(500).json({ message: 'Error al listar respaldos.', error: error.message });
  }
});

// Restaura un fiix_*.sql.gz (+ uploads opcional). Destructivo: requiere confirmación en el cliente.
router.post('/restore', verifyDevPassword, async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, restoreUploads = true, confirm } = req.body || {};
    if (!file || typeof file !== 'string') {
      res.status(400).json({ success: false, message: 'Indica el archivo a restaurar (file: fiix_….sql.gz).' });
      return;
    }
    if (confirm !== 'RESTAURAR' && confirm !== true) {
      res.status(400).json({
        success: false,
        message: 'Confirmación requerida. Envía confirm: "RESTAURAR" (esto borra los datos actuales).',
      });
      return;
    }
    const result = await runRestore(file, Boolean(restoreUploads));
    if (!result.success) {
      res.status(500).json(result);
      return;
    }
    res.json(result);
  } catch (error: any) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ success: false, message: 'Error al restaurar el respaldo.', error: error.message });
  }
});

router.post('/delete', verifyDevPassword, async (req: Request, res: Response) => {
  try {
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    
    // Explicitly delete checklist records just in case
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklist" CASCADE;`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklistRow" CASCADE;`);

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations' && tablename !== 'ChecklistActivity') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      }
    }

    // Inyectar usuario administrador por defecto para evitar perder acceso
    // Credenciales alineadas con seed y hint de Login.tsx
    const defaultPassword = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@fiix.com',
        password_hash: defaultPassword,
        role: 'ADMINISTRADOR',
        is_active: true,
        must_change_password: true,
      }
    });

    res.json({ success: true, message: 'Database data has been deleted completely.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete database data.', error: error.message });
  }
});

router.post('/import-csv', verifyDevPassword, upload.array('csvFiles'), async (req: Request, res: Response): Promise<void> => {
  try {
    const parseSafeDate = (dString: string) => {
       if (!dString) return null;
       let d = new Date(dString);
       if (!isNaN(d.getTime())) return d;
       const parts = dString.split(' ');
       if (parts.length === 2) {
          const dateParts = parts[0].split('/');
          if (dateParts.length === 3) {
             let timeStr = parts[1];
             if (timeStr.length === 7 || timeStr.length === 4) timeStr = '0' + timeStr;
             d = new Date(`${dateParts[2]}-${dateParts[1].padStart(2,'0')}-${dateParts[0].padStart(2,'0')}T${timeStr}Z`);
             if (!isNaN(d.getTime())) return d;
          }
       }
       return null;
    };

    // Parseo robusto de números que pueden venir con coma como separador de miles
    // (ej. "2,140.22" -> 2140.22). Sin esto parseFloat corta en la coma y devuelve 2.
    const parseNumber = (val: any): number => {
      if (val === null || val === undefined) return 0;
      const cleaned = String(val).replace(/,/g, '').trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? 0 : n;
    };

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ message: 'No se subieron archivos CSV.' });
      return;
    }

    const catFile = files.find(f => f.originalname.includes('Categories'));
    const locFile = files.find(f => f.originalname.includes('Location'));
    const venFile = files.find(f => f.originalname.includes('Vendors'));
    const itemFile = files.find(f => f.originalname.includes('Items') && !f.originalname.includes('Categories') && !f.originalname.includes('Location') && !f.originalname.includes('Vendors') && !f.originalname.includes('Inventory') && !f.originalname.includes('Users'));
    const userFile = files.find(f => f.originalname.includes('Users'));
    const invFile = files.find(f => f.originalname.includes('Inventory'));
    const woFile = files.find(f => f.originalname.includes('Solicitudes Mantenimiento'));

    const assignItemImages =
      req.body?.assignItemImages === 'true' ||
      req.body?.assignItemImages === true ||
      req.body?.assignItemImages === '1';

    const results: {
      categories: number;
      locations: number;
      vendors: number;
      items: number;
      users: number;
      inventory: number;
      orders: number;
      itemImages?: {
        matched: number;
        missing: number;
        skipped: number;
        folderFound: boolean;
        filesScanned: number;
      };
    } = { categories: 0, locations: 0, vendors: 0, items: 0, users: 0, inventory: 0, orders: 0 };

    if (catFile) {
      const data = parse(catFile.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
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
      const data = parse(locFile.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
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
      const data = parse(venFile.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
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

      const data = parse(itemFile.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });

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
    }

    if (userFile) {
      const data = parse(userFile.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
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
      const data = parse(invFile.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
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
      const data = parse(woFile.buffer.toString('utf8'), { columns: true, skip_empty_lines: true });
      const allUsers = await prisma.user.findMany();
      const adminUser = allUsers.find(u => u.role === 'ADMINISTRADOR') || allUsers[0];
      
      if (adminUser) {
        for (const row of data as any[]) {
          try {
            const folioCsv = parseWorkOrderFolio(row['FOLIO']);
            if (!folioCsv) continue;

            let zoneName = row['Zona:'] ? row['Zona:'].trim() : 'Sin Zona';
            if(zoneName === 'N/A' || !zoneName) zoneName = 'Sin Zona';
            let zone = await prisma.zone.findUnique({ where: { name: zoneName } });
            if (!zone) {
               zone = await prisma.zone.create({ data: { name: zoneName } });
            }

            let assetName = row['Equipo:'] ? row['Equipo:'].trim() : 'Sin Equipo';
            if(assetName === 'N/A' || !assetName) assetName = 'Sin Equipo';
            let asset = await prisma.asset.findFirst({ where: { name: assetName } });
            if (!asset) {
               asset = await prisma.asset.create({
                  data: {
                     internal_code: await generateInventoryCode('Asset', 'ACT-', 4),
                     name: assetName,
                     brand: 'N/A',
                     model: 'N/A',
                     status: AssetStatus.OPERATIVO,
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
               accumulated_time_ms: Math.floor(parseNumber(row['TIEMPO REPARACIÓN']) * 60000),
               assigned_technicians: { connect: assignedUserIds }
            };

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

    // Fotos de repuestos desde data/Items_Images/ (opcional; no rompe si la carpeta está vacía)
    if (assignItemImages) {
      try {
        const photoResult = await assignItemImagesFromFolder();
        results.itemImages = {
          matched: photoResult.matched,
          missing: photoResult.missing,
          skipped: photoResult.skipped,
          folderFound: photoResult.folderFound,
          filesScanned: photoResult.filesScanned,
        };
      } catch (photoErr) {
        console.error('Item images import error:', photoErr);
        results.itemImages = {
          matched: 0,
          missing: 0,
          skipped: 0,
          folderFound: false,
          filesScanned: 0,
        };
      }
    }

    res.json({ success: true, message: 'Archivos CSV importados con éxito.', results });
  } catch (error: any) {
    console.error('CSV Import error:', error);
    res.status(500).json({ message: 'Error procesando archivos CSV.', error: error.message });
  }
});

export default router;
