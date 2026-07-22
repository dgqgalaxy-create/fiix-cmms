/**
 * Smoke test: empareja CSV de solicitudes vs zip sin tocar la BD.
 * Uso: npx tsx scripts/test-wo-photo-match.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { extractZipToDir } from '../src/utils/itemImageImport';
import {
  resolveWorkOrderImagesRoot,
  sanitizeWorkOrderPhotoPath,
  foldName,
  isSignatureFilename,
} from '../src/utils/workOrderImageImport';

async function main() {
  const rootRepo = path.join(__dirname, '../..');
  const zip = path.join(rootRepo, 'data', 'Formulario Solicitudes_Images.zip');
  const csvPath = path.join(
    rootRepo,
    'data',
    'Solicitudes Mantenimiento 2026 - Formulario Solicitudes.csv'
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fiix-wo-test-'));
  try {
    await extractZipToDir(zip, tmp);
    const imagesRoot = resolveWorkOrderImagesRoot(tmp);
    if (!imagesRoot) throw new Error('No se encontró carpeta de imágenes en el zip');

    const files = fs.readdirSync(imagesRoot);
    const index = new Map<string, string>();
    let sig = 0;
    let photos = 0;
    for (const f of files) {
      if (isSignatureFilename(f)) {
        sig++;
        continue;
      }
      photos++;
      index.set(foldName(f), f);
    }

    const rows = parse(fs.readFileSync(csvPath, 'utf8'), {
      columns: true,
      skip_empty_lines: true,
    }) as Record<string, string>[];

    let before = 0;
    let after = 0;
    let missB = 0;
    let missA = 0;
    for (const row of rows) {
      const b = sanitizeWorkOrderPhotoPath(row['FOTO ANTES']);
      const a = sanitizeWorkOrderPhotoPath(row['FOTO DESPUÉS']);
      if (b) {
        if (index.has(foldName(path.basename(b)))) before++;
        else missB++;
      }
      if (a) {
        if (index.has(foldName(path.basename(a)))) after++;
        else missA++;
      }
    }

    console.log({
      imagesRoot,
      photos,
      signaturesIgnoredInZip: sig,
      beforeMatched: before,
      afterMatched: after,
      beforeMissing: missB,
      afterMissing: missA,
      csvRows: rows.length,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
