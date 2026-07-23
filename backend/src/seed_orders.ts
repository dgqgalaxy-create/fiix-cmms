import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import prisma from './config/prisma';
import bcrypt from 'bcrypt';
import { generateAssetInternalCode } from './utils/assetCodeGenerator';
import { AssetKind } from '@prisma/client';

import { parseCsvDate } from './utils/parseCsvDate';

const parseDate = parseCsvDate;

async function seedOrders() {
  const filePath = path.resolve(__dirname, '../../data/Ordenes_trabajo.csv');
  console.log('Leyendo archivo:', filePath);

  if (!fs.existsSync(filePath)) {
    console.error('El archivo no existe.');
    return;
  }

  // Get or create a default Admin to be the creator
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMINISTRADOR' } });
  if (!adminUser) {
    const hash = bcrypt.hashSync('Admin123', 10);
    adminUser = await prisma.user.create({
      data: {
        name: 'Administrador Sistema',
        email: 'admin@cmms.com',
        password_hash: hash,
        role: 'ADMINISTRADOR'
      }
    });
  }

  // Caching mechanism for Users, Zones and Assets to avoid slow loops
  const userCache = new Map<string, string>(); // email -> id
  const zoneCache = new Map<string, string>(); // name -> id
  const assetCache = new Map<string, string>(); // name -> id

  const hashPassword = bcrypt.hashSync('Temporal123', 10);

  const parser = fs.createReadStream(filePath).pipe(parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true // Very important for UTF-8 CSVs saved from Excel
  }));

  let processedCount = 0;
  let errorCount = 0;

  for await (const row of parser) {
    try {
      const folioRaw = row['FOLIO'] || '';
      const folioInt = parseInt(folioRaw.replace(/\D/g, ''), 10) || 0;
      if (folioInt === 0) continue; // Skip rows without valid folio

      // Check if order already exists to avoid duplicates
      const existingOrder = await prisma.workOrder.findFirst({ where: { folio: folioInt } });
      if (existingOrder) {
        console.log(`La orden FOL-${folioInt} ya existe. Ignorando.`);
        continue;
      }

      // 1. ZONA
      let zoneName = row['Zona:']?.trim() || 'SIN ZONA';
      let zoneId = zoneCache.get(zoneName);
      if (!zoneId) {
        let zone = await prisma.zone.findUnique({ where: { name: zoneName } });
        if (!zone) {
          zone = await prisma.zone.create({ data: { name: zoneName } });
        }
        zoneId = zone.id;
        zoneCache.set(zoneName, zoneId);
      }

      // 2. EQUIPO (ASSET)
      let assetName = row['Equipo:']?.trim() || 'EQUIPO NO ESPECIFICADO';
      let assetId = assetCache.get(assetName);
      if (!assetId) {
        let asset = await prisma.asset.findFirst({ where: { name: assetName } });
        if (!asset) {
          // Código MTTO-NNNN-S-DDD-T (sin código importado → se genera).
          const internal_code = await generateAssetInternalCode({
            name: assetName,
            zoneId,
            section: null,
            assetKind: AssetKind.FIJO,
          });
          asset = await prisma.asset.create({ 
            data: { 
              name: assetName,
              internal_code,
              brand: 'Desconocida',
              model: 'Desconocido',
              status: 'OPERATIVO',
              asset_kind: AssetKind.FIJO,
              zone_id: zoneId
            } 
          });
        }
        assetId = asset.id;
        assetCache.set(assetName, assetId);
      }

      // 3. TÉCNICOS ASIGNADOS
      const emailsRaw = row['EMAIL DEL TÉCNICO'] || '';
      const emailList = emailsRaw.split(',').map((e: string) => e.trim().toLowerCase()).filter((e: string) => e !== '');
      
      const assignedIds: string[] = [];
      for (const email of emailList) {
        let userId = userCache.get(email);
        if (!userId) {
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            // Create tech
            user = await prisma.user.create({
              data: {
                name: email.split('@')[0].toUpperCase(),
                email: email,
                password_hash: hashPassword,
                role: 'TECNICO'
              }
            });
          }
          userId = user.id;
          userCache.set(email, userId);
        }
        assignedIds.push(userId);
      }

      // 4. MAPEOS DIRECTOS
      const requester = row['Nombre del solicitante:'] || 'Desconocido';
      
      let groupStr = row['Grupo:']?.trim().toUpperCase() || 'NA';
      if (groupStr.includes('A')) groupStr = 'A';
      else if (groupStr.includes('B')) groupStr = 'B';
      else if (groupStr.includes('C')) groupStr = 'C';
      else if (groupStr.includes('D')) groupStr = 'D';
      else groupStr = 'NA';

      const machineStopped = row['¿Paró máquina por la falla?']?.toUpperCase() === 'SÍ' || row['¿Paró máquina por la falla?']?.toUpperCase() === 'SI';
      
      let maintType = 'CORRECTIVO';
      const mTypeRaw = row['Tipo de mantenimiento:']?.toUpperCase();
      if (mTypeRaw === 'SERVICIO' || mTypeRaw === 'PREVENTIVO' || mTypeRaw === 'CORRECTIVO') {
        maintType = mTypeRaw;
      }

      let priority = 'NORMAL';
      const prioRaw = row['Prioridad:']?.toUpperCase();
      if (prioRaw?.includes('URGENTE')) priority = 'URGENTE';
      else if (prioRaw?.includes('PROGRAMADO')) priority = 'BAJO'; // Requested mapping
      else if (prioRaw?.includes('BAJO')) priority = 'BAJO';

      let status = 'PENDIENTE';
      const statusRaw = row['ESTADO']?.toUpperCase();
      if (statusRaw === 'FINALIZADO') status = 'FINALIZADO';
      
      if (row['INVALIDA']?.toUpperCase() === 'TRUE') {
        status = 'ANULADO';
      }

      const startedAt = parseDate(row['FECHA INICIO']);
      const completedAt = parseDate(row['FECHA FINALIZACIÓN']);
      const createdAt = parseDate(row['Marca temporal']) || new Date();

      const timeMins = parseFloat(row['TIEMPO REPARACIÓN']);
      const accumulated_time_ms = !isNaN(timeMins) ? Math.round(timeMins * 60000) : 0;

      // Extract details
      const failureDesc = row['Descripción de la falla:'] || 'Sin descripción';
      let resNotes = row['ACTIVIDAD REALIZADA'] || '';
      
      // Append PDF link if exists
      const pdfLink = row['PDF LINK'];
      if (pdfLink && pdfLink.trim() !== '') {
        resNotes += `\n\nDocumento adjunto antiguo: ${pdfLink}`;
      }

      // CREATE THE ORDER
      await prisma.workOrder.create({
        data: {
          folio: folioInt,
          title: failureDesc.substring(0, 100), // Ensure title isn't infinitely long
          description: failureDesc,
          asset_id: assetId,
          zone_id: zoneId,
          priority: priority as any,
          maintenance_type: maintType as any,
          machine_stopped: machineStopped,
          requester_name: requester,
          production_group: groupStr as any,
          status: status as any,
          started_at: startedAt,
          completed_at: completedAt,
          accumulated_time_ms: accumulated_time_ms,
          resolution_notes: resNotes,
          request_image_url: row['FOTO ANTES'] || null,
          before_image_url: row['FOTO ANTES'] || null,
          after_image_url: row['FOTO DESPUÉS'] || null,
          signature_clean_area: row['FIRMA AREA LIMPIA'] || null,
          signature_delivery: row['FIRMA CONFORMIDAD'] || null,
          created_by_id: adminUser.id,
          created_at: createdAt,
          assigned_technicians: {
            connect: assignedIds.map(id => ({ id }))
          }
        }
      });

      processedCount++;
      if (processedCount % 50 === 0) console.log(`Procesadas ${processedCount} órdenes...`);
      
    } catch (err: any) {
      console.error(`Error procesando fila:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n=== IMPORTACIÓN FINALIZADA ===`);
  console.log(`Órdenes importadas con éxito: ${processedCount}`);
  console.log(`Errores: ${errorCount}`);
  console.log(`\nLas contraseñas para los nuevos técnicos creados es: Temporal123`);
}

seedOrders()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
