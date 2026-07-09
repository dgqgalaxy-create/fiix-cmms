import { Role } from '@prisma/client';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import prisma from './config/prisma';

const dataDir = path.join(__dirname, '../../data');

async function main() {
  console.log('Empezando importación de CSV...');

  // 1. Usuarios (Ignorar porque ya tenemos admin y tecs, o podemos intentar importarlos si no existen)
  // 2. Categorías
  const catRaw = fs.readFileSync(path.join(dataDir, 'Items - Categories.csv'), 'utf8');
  const catData = parse(catRaw, { columns: true, skip_empty_lines: true });
  for (const row of catData as any[]) {
    try {
      await prisma.itemCategory.upsert({
        where: { internal_id: row['ID'] },
        update: { name: row['Category'], icon_url: row['Icon'] },
        create: { internal_id: row['ID'], name: row['Category'], icon_url: row['Icon'] }
      });
    } catch (e) {
      console.log('Error insertando categoria', row['ID'], e);
    }
  }
  console.log(`Categorías importadas: ${catData.length}`);

  // 3. Ubicaciones
  const locRaw = fs.readFileSync(path.join(dataDir, 'Items - Location.csv'), 'utf8');
  const locData = parse(locRaw, { columns: true, skip_empty_lines: true });
  for (const row of locData as any[]) {
    try {
      await prisma.itemLocation.upsert({
        where: { internal_id: row['ID'] },
        update: { name: row['Location'], icon_url: row['Icon'] },
        create: { internal_id: row['ID'], name: row['Location'], icon_url: row['Icon'] }
      });
    } catch (e) {}
  }
  console.log(`Ubicaciones importadas: ${locData.length}`);

  // 4. Proveedores
  const venRaw = fs.readFileSync(path.join(dataDir, 'Items - Vendors.csv'), 'utf8');
  const venData = parse(venRaw, { columns: true, skip_empty_lines: true });
  for (const row of venData as any[]) {
    try {
      await prisma.vendor.upsert({
        where: { internal_id: row['ID'] },
        update: { 
          name: row['Name'], logo_url: row['Logo'], website_url: row['URL'],
          phone: row['Phone'], email: row['Email'], address: row['Address']
        },
        create: { 
          internal_id: row['ID'], name: row['Name'], logo_url: row['Logo'], website_url: row['URL'],
          phone: row['Phone'], email: row['Email'], address: row['Address']
        }
      });
    } catch (e) {}
  }
  console.log(`Proveedores importados: ${venData.length}`);

  // Helpers para buscar UUIDs
  const categories = await prisma.itemCategory.findMany();
  const locations = await prisma.itemLocation.findMany();
  const vendors = await prisma.vendor.findMany();
  
  const catMap = Object.fromEntries(categories.map(c => [c.internal_id, c.id]));
  const locMap = Object.fromEntries(locations.map(c => [c.internal_id, c.id]));
  const venMap = Object.fromEntries(vendors.map(c => [c.internal_id, c.id]));

  let unassignedLoc = locations.find(l => l.name === 'Sin Asignación');
  if (!unassignedLoc) {
    const count = await prisma.itemLocation.count();
    const fallbackId = `LOC-${String(count + 1000).padStart(3, '0')}`;
    unassignedLoc = await prisma.itemLocation.create({
      data: { name: 'Sin Asignación', internal_id: fallbackId }
    });
  }
  const unassignedLocId = unassignedLoc.id;

  // 5. Items (Repuestos)
  const itemRaw = fs.readFileSync(path.join(dataDir, 'Items - Items.csv'), 'utf8');
  const itemData = parse(itemRaw, { columns: true, skip_empty_lines: true });

  // Extraer y crear UOMs faltantes
  const uomSet = new Set<string>();
  for (const row of itemData as any[]) {
    if (row['UOM']) {
      uomSet.add(row['UOM'].toUpperCase());
    }
  }
  
  const existingUoms = await prisma.unitOfMeasure.findMany();
  const existingUomNames = new Set(existingUoms.map(u => u.name));
  const newUoms = Array.from(uomSet).filter(u => !existingUomNames.has(u));
  
  if (newUoms.length > 0) {
    await prisma.unitOfMeasure.createMany({
      data: newUoms.map(name => ({ name }))
    });
  }

  let itemsImported = 0;
  for (const row of itemData as any[]) {
    try {
      let uom = row['UOM'] ? row['UOM'].toUpperCase() : 'PIEZAS';
      
      let cost = row['Purchase Cost'] ? parseFloat(row['Purchase Cost'].replace(/[^0-9.-]+/g,"")) : 0;
      let stock = parseFloat(row['Stock']) || 0;
      let minStock = parseFloat(row['Minimum Inventory']) || 0;
      
      await prisma.item.upsert({
        where: { internal_code: row['Item ID'] },
        update: {
          name: row['Name'],
          description: row['Description'],
          image_url: row['Image'],
          category_id: catMap[row['Category']] || null,
          vendor_id: venMap[row['Vendor']] || null,
          location_id: locMap[row['Location']] || unassignedLocId,
          purchase_cost: cost,
          stock: stock,
          minimum_inventory: minStock,
          is_active: row['¿Discontinued?'] === 'FALSE',
          uom: uom
        },
        create: {
          internal_code: row['Item ID'],
          name: row['Name'] || 'Sin nombre',
          description: row['Description'],
          image_url: row['Image'],
          category_id: catMap[row['Category']] || null,
          vendor_id: venMap[row['Vendor']] || null,
          location_id: locMap[row['Location']] || unassignedLocId,
          purchase_cost: cost,
          stock: stock,
          minimum_inventory: minStock,
          is_active: row['¿Discontinued?'] === 'FALSE',
          uom: uom
        }
      });
      itemsImported++;
    } catch (e) {
      console.log('Error insertando item', row['Item ID'], e);
    }
  }
  console.log(`Repuestos importados/actualizados: ${itemsImported}`);

  // No vamos a importar las transacciones de inventario porque
  // apuntan a User IDs (emails) de fiix que no coinciden con la BD actual,
  // y re-crearíamos usuarios basura. O podemos meterlas a nombre de admin.
  // Pero con tener los repuestos y catálogos ya es bastante para pruebas.

  console.log('Importación terminada!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
