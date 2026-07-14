import express, { Request, Response } from 'express';
import prisma from '../config/prisma';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { Role, AssetStatus, WorkOrderStatus, Priority, MaintenanceType, ProductionGroup } from '@prisma/client';
import bcrypt from 'bcrypt';

const router = express.Router();

// Multer in-memory storage for JSON uploads
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to verify the developer password
const verifyDevPassword = async (req: Request, res: Response, next: express.NextFunction): Promise<void> => {
  const password = req.headers['x-dev-password'] as string;

  if (!password) {
    res.status(401).json({ message: 'Se requiere contraseña.' });
    return;
  }

  try {
    // Master fallback to prevent lockout if DB is completely wiped
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
    const defaultPassword = await bcrypt.hash('password123', 10);
    await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin',
        password_hash: defaultPassword,
        role: 'ADMINISTRADOR',
        is_active: true
      }
    });

    res.json({ success: true, message: 'Database data has been deleted completely.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete database data.', error: error.message });
  }
});

router.get('/export', verifyDevPassword, async (req: Request, res: Response) => {
  try {
    const exportData = {
      User: await prisma.user.findMany(),
      Requester: await prisma.requester.findMany(),
      Zone: await prisma.zone.findMany(),
      KPIGoal: await prisma.kPIGoal.findMany(),
      RolePermission: await prisma.rolePermission.findMany(),
      ItemCategory: await prisma.itemCategory.findMany(),
      ItemLocation: await prisma.itemLocation.findMany(),
      Vendor: await prisma.vendor.findMany(),
      FailureProblem: await prisma.failureProblem.findMany(),
      FailureCause: await prisma.failureCause.findMany(),
      FailureRemedy: await prisma.failureRemedy.findMany(),
      Asset: await prisma.asset.findMany(),
      Item: await prisma.item.findMany(),
      MaintenancePlan: await prisma.maintenancePlan.findMany(),
      PlanItem: await prisma.planItem.findMany(),
      InventoryTransaction: await prisma.inventoryTransaction.findMany(),
      PurchaseOrder: await prisma.purchaseOrder.findMany(),
      PurchaseOrderItem: await prisma.purchaseOrderItem.findMany(),
      ChecklistActivity: await prisma.checklistActivity.findMany(),
      DailyChecklist: await prisma.dailyChecklist.findMany(),
      DailyChecklistRow: await prisma.dailyChecklistRow.findMany(),
      WorkOrder: await prisma.workOrder.findMany({
        include: { assigned_technicians: { select: { id: true } } }
      })
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=fiix-cmms-backup.json');
    res.json(exportData);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to export database.', error: error.message });
  }
});

router.post('/import', verifyDevPassword, upload.single('backupFile'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No backup file uploaded.' });
      return;
    }

    const data = JSON.parse(req.file.buffer.toString('utf-8'));

    // Truncate all tables first, EXCEPT ChecklistActivity to preserve the seed/base configuration.
    const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklist" CASCADE;`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklistRow" CASCADE;`);

    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations' && tablename !== 'ChecklistActivity') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      }
    }

    // Insert data in order of dependencies
    if (data.User) await prisma.user.createMany({ data: data.User });
    if (data.Requester) await prisma.requester.createMany({ data: data.Requester });
    if (data.Zone) await prisma.zone.createMany({ data: data.Zone });
    if (data.KPIGoal) await prisma.kPIGoal.createMany({ data: data.KPIGoal });
    if (data.RolePermission) await prisma.rolePermission.createMany({ data: data.RolePermission });
    if (data.ItemCategory) await prisma.itemCategory.createMany({ data: data.ItemCategory });
    if (data.ItemLocation) await prisma.itemLocation.createMany({ data: data.ItemLocation });
    if (data.Vendor) await prisma.vendor.createMany({ data: data.Vendor });
    if (data.FailureProblem) await prisma.failureProblem.createMany({ data: data.FailureProblem });
    if (data.FailureCause) await prisma.failureCause.createMany({ data: data.FailureCause });
    if (data.FailureRemedy) await prisma.failureRemedy.createMany({ data: data.FailureRemedy });
    if (data.Asset) await prisma.asset.createMany({ data: data.Asset });
    if (data.Item) await prisma.item.createMany({ data: data.Item });
    if (data.MaintenancePlan) await prisma.maintenancePlan.createMany({ data: data.MaintenancePlan });
    if (data.PlanItem) await prisma.planItem.createMany({ data: data.PlanItem });
    if (data.InventoryTransaction) await prisma.inventoryTransaction.createMany({ data: data.InventoryTransaction });
    if (data.PurchaseOrder) await prisma.purchaseOrder.createMany({ data: data.PurchaseOrder });
    if (data.PurchaseOrderItem) await prisma.purchaseOrderItem.createMany({ data: data.PurchaseOrderItem });

    // Restore Checklist data if available
    if (data.ChecklistActivity) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "ChecklistActivity" CASCADE;`);
      await prisma.checklistActivity.createMany({ data: data.ChecklistActivity });
    }
    if (data.DailyChecklist) await prisma.dailyChecklist.createMany({ data: data.DailyChecklist });
    if (data.DailyChecklistRow) await prisma.dailyChecklistRow.createMany({ data: data.DailyChecklistRow });

    // For WorkOrder, we handle the many-to-many relationship
    if (data.WorkOrder) {
      for (const wo of data.WorkOrder) {
        const { assigned_technicians, ...rest } = wo;
        await prisma.workOrder.create({
          data: {
            ...rest,
            assigned_technicians: assigned_technicians && assigned_technicians.length > 0 
              ? { connect: assigned_technicians } 
              : undefined
          }
        });
      }
    }

    res.json({ success: true, message: 'Database imported successfully.' });
  } catch (error: any) {
    console.error('Import error:', error);
    res.status(500).json({ message: 'Failed to import database.', error: error.message });
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

    const results = { categories: 0, locations: 0, vendors: 0, items: 0, users: 0, inventory: 0, orders: 0 };

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
              is_active: isActive
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
      const userMap = Object.fromEntries(allUsers.map(u => [u.email, u.id]));
      const itemMap = Object.fromEntries(allItems.map(i => [i.internal_code, i.id]));

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
            amount: parseFloat(row['Amount']) || 0,
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
            const folioCsvStr = row['FOLIO'] ? row['FOLIO'].replace('FOL-','') : '0';
            const folioCsv = parseInt(folioCsvStr, 10);
            if (!folioCsv || isNaN(folioCsv)) continue;

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
                     internal_code: 'EQ-' + Math.floor(Math.random()*100000),
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
               accumulated_time_ms: row['TIEMPO REPARACIÓN'] ? Math.floor(parseFloat(row['TIEMPO REPARACIÓN']) * 60000) : 0,
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

    res.json({ success: true, message: 'Archivos CSV importados con éxito.', results });
  } catch (error: any) {
    console.error('CSV Import error:', error);
    res.status(500).json({ message: 'Error procesando archivos CSV.', error: error.message });
  }
});

export default router;
