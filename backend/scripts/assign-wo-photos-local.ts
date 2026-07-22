/**
 * Asigna fotos OT desde data/Formulario Solicitudes_Images.zip + CSV local.
 * Uso: npx tsx scripts/assign-wo-photos-local.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import {
  assignWorkOrderImagesFromZip,
  sanitizeWorkOrderPhotoPath,
  type WorkOrderPhotoMapping,
} from '../src/utils/workOrderImageImport';
import { parseWorkOrderFolio } from '../src/utils/folio';
import prisma from '../src/config/prisma';

async function main() {
  const root = path.join(__dirname, '../..');
  const zip = path.join(root, 'data', 'Formulario Solicitudes_Images.zip');
  const csvPath = path.join(
    root,
    'data',
    'Solicitudes Mantenimiento 2026 - Formulario Solicitudes.csv'
  );

  if (!fs.existsSync(zip)) throw new Error(`Falta zip: ${zip}`);
  if (!fs.existsSync(csvPath)) throw new Error(`Falta CSV: ${csvPath}`);

  const rows = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const mappings: WorkOrderPhotoMapping[] = [];
  for (const row of rows) {
    const folio = parseWorkOrderFolio(row['FOLIO']);
    if (!folio) continue;
    const beforePath = sanitizeWorkOrderPhotoPath(row['FOTO ANTES']);
    const afterPath = sanitizeWorkOrderPhotoPath(row['FOTO DESPUÉS']);
    if (beforePath || afterPath) {
      mappings.push({ folio, beforePath, afterPath });
    }
  }

  console.log(`Mappings: ${mappings.length}; zip: ${zip}`);
  const result = await assignWorkOrderImagesFromZip(zip, mappings);
  console.log(result);

  const withBefore = await prisma.workOrder.count({
    where: { before_image_url: { not: null } },
  });
  const withAfter = await prisma.workOrder.count({
    where: { after_image_url: { not: null } },
  });
  console.log({ withBefore, withAfter });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
