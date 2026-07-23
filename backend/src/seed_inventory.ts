import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import prisma from './config/prisma';
import bcrypt from 'bcrypt';
import { parseCsvDate } from './utils/parseCsvDate';

const parseCost = (costStr: string) => {
  if (!costStr) return 0;
  const cleaned = costStr.replace('$', '').replace(/,/g, '').trim();
  return parseFloat(cleaned) || 0;
};

const parseDate = parseCsvDate;

async function readCSV(filePath: string): Promise<any[]> {
  const absolutePath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(absolutePath)) {
    console.warn(`Archivo no encontrado: ${absolutePath}`);
    return [];
  }

  return new Promise((resolve, reject) => {
    const records: any[] = [];
    fs.createReadStream(absolutePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, bom: true }))
      .on('data', (record) => records.push(record))
      .on('end', () => resolve(records))
      .on('error', (err) => reject(err));
  });
}

async function seedInventory() {
  console.log('=== INICIANDO MIGRACIÓN DE INVENTARIO ===');

  // 1. IMPORT CATEGORIES
  const categories = await readCSV('../../data/Items - Categories.csv');
  console.log(`Procesando ${categories.length} categorías...`);
  for (const row of categories) {
    if (!row.ID || !row.Category) continue;
    await prisma.itemCategory.upsert({
      where: { internal_id: row.ID },
      update: { name: row.Category, icon_url: row.Icon },
      create: { internal_id: row.ID, name: row.Category, icon_url: row.Icon }
    });
  }

  // 2. IMPORT LOCATIONS
  const locations = await readCSV('../../data/Items - Location.csv');
  console.log(`Procesando ${locations.length} ubicaciones...`);
  for (const row of locations) {
    if (!row.ID || !row.Location) continue;
    await prisma.itemLocation.upsert({
      where: { internal_id: row.ID },
      update: { name: row.Location, icon_url: row.Icon },
      create: { internal_id: row.ID, name: row.Location, icon_url: row.Icon }
    });
  }

  // 3. IMPORT VENDORS
  const vendors = await readCSV('../../data/Items - Vendors.csv');
  console.log(`Procesando ${vendors.length} proveedores...`);
  for (const row of vendors) {
    if (!row.ID || !row.Name) continue;
    await prisma.vendor.upsert({
      where: { internal_id: row.ID },
      update: { 
        name: row.Name,
        logo_url: row.Logo || null,
        website_url: row.URL || null,
        phone: row.Phone || null,
        email: row.Email || null,
        address: row.Address || null
      },
      create: { 
        internal_id: row.ID,
        name: row.Name,
        logo_url: row.Logo || null,
        website_url: row.URL || null,
        phone: row.Phone || null,
        email: row.Email || null,
        address: row.Address || null
      }
    });
  }

  // Build maps for items
  const catMap = new Map((await prisma.itemCategory.findMany()).map(c => [c.internal_id, c.id]));
  const locMap = new Map((await prisma.itemLocation.findMany()).map(l => [l.internal_id, l.id]));
  const venMap = new Map((await prisma.vendor.findMany()).map(v => [v.internal_id, v.id]));

  // 4. IMPORT ITEMS
  const items = await readCSV('../../data/Items - Items.csv');
  console.log(`Procesando ${items.length} refacciones...`);
  let itemCounter = 0;
  for (const row of items) {
    if (!row['Item ID'] || !row['Name']) continue;

    let uomStr = row['UOM']?.toUpperCase() || 'PIEZAS';
    if (!['PIEZAS', 'METROS', 'LITROS', 'KILOGRAMOS', 'CAJAS', 'KITS'].includes(uomStr)) {
      uomStr = 'PIEZAS';
    }

    const isActive = row['¿Discontinued?']?.toUpperCase() !== 'TRUE';
    const purchaseCost = parseCost(row['Purchase Cost']);
    const stock = parseFloat(row['Stock']) || 0;
    const minInv = parseFloat(row['Minimum Inventory']) || 0;

    await prisma.item.upsert({
      where: { internal_code: row['Item ID'] },
      update: {
        name: row['Name'],
        description: row['Description'] || null,
        image_url: row['Image'] || null,
        category_id: catMap.get(row['Category']) || null,
        vendor_id: venMap.get(row['Vendor']) || null,
        location_id: locMap.get(row['Location']) || null,
        purchase_cost: purchaseCost,
        stock: stock,
        minimum_inventory: minInv,
        is_active: isActive,
        uom: uomStr as any
      },
      create: {
        internal_code: row['Item ID'],
        name: row['Name'],
        description: row['Description'] || null,
        image_url: row['Image'] || null,
        category_id: catMap.get(row['Category']) || null,
        vendor_id: venMap.get(row['Vendor']) || null,
        location_id: locMap.get(row['Location']) || null,
        purchase_cost: purchaseCost,
        stock: stock,
        minimum_inventory: minInv,
        is_active: isActive,
        uom: uomStr as any
      }
    });
    itemCounter++;
    if (itemCounter % 200 === 0) console.log(`  Importadas ${itemCounter} piezas...`);
  }

  // 5. IMPORT INVENTORY TRANSACTIONS
  const transactions = await readCSV('../../data/Items - Inventory.csv');
  console.log(`Procesando ${transactions.length} transacciones de inventario...`);
  
  // Cache items and users
  const itemMap = new Map((await prisma.item.findMany()).map(i => [i.internal_code, i.id]));
  const userMap = new Map((await prisma.user.findMany()).map(u => [u.email, u.id]));
  const defaultPassword = bcrypt.hashSync('Temporal123', 10);

  let transCounter = 0;
  for (const row of transactions) {
    if (!row['Item ID'] || !row['Amount']) continue;
    
    const itemDbId = itemMap.get(row['Item ID']);
    if (!itemDbId) continue; // Item doesn't exist

    let email = row['User ID']?.trim().toLowerCase() || 'sistema@cmms.com';
    let userId = userMap.get(email);
    if (!userId) {
      const newUser = await prisma.user.create({
        data: {
          name: email.split('@')[0].toUpperCase(),
          email: email,
          password_hash: defaultPassword,
          role: 'TECNICO'
        }
      });
      userId = newUser.id;
      userMap.set(email, userId);
    }

    const dateStr = row['DateTime'];
    let txDate = parseDate(dateStr);
    if (!txDate) {
      // Si la fecha es inválida, se creará con la fecha de hoy, pero no queremos fallar
      txDate = new Date();
    }
    
    // Evitar transacciones duplicadas basándonos en la fecha, item y cantidad (simplificado)
    const existingTx = await prisma.inventoryTransaction.findFirst({
      where: {
        item_id: itemDbId,
        user_id: userId,
        amount: parseFloat(row['Amount'])
      }
    });

    if (!existingTx) {
      await prisma.inventoryTransaction.create({
        data: {
          item_id: itemDbId,
          user_id: userId,
          amount: parseFloat(row['Amount']),
          reason: row['Reason'] || 'Sin motivo',
          created_at: txDate,
        }
      });
    }

    transCounter++;
    if (transCounter % 500 === 0) console.log(`  Importadas ${transCounter} transacciones...`);
  }

  console.log('=== MIGRACIÓN FINALIZADA CON ÉXITO ===');
  console.log(`- Categorías: ${categories.length}`);
  console.log(`- Ubicaciones: ${locations.length}`);
  console.log(`- Proveedores: ${vendors.length}`);
  console.log(`- Piezas de inventario: ${itemCounter}`);
  console.log(`- Transacciones: ${transCounter}`);
}

seedInventory()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
