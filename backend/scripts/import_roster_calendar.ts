/**
 * One-off: carga el «Calendario Turno 2026.xlsx» de data/ en el módulo Horarios.
 * Crea los técnicos que falten (rol TECNICO) y reemplaza los turnos del rango del archivo.
 *
 * Uso (desde backend/):
 *   npx ts-node scripts/import_roster_calendar.ts
 *
 * Por seguridad, solo se ejecuta contra localhost salvo que ALLOW_REMOTE_DB=1.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';
import { parseRosterWorkbook, applyRosterImport } from '../src/utils/rosterImport';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!/localhost|127\.0\.0\.1/i.test(dbUrl) && process.env.ALLOW_REMOTE_DB !== '1') {
    throw new Error('Refusing to import: DATABASE_URL is not localhost (usa ALLOW_REMOTE_DB=1 para forzar).');
  }

  const filePath = path.resolve(__dirname, '../../data/Calendario Turno 2026.xlsx');
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró el archivo: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const parsed = parseRosterWorkbook(buffer);
  const summary = await applyRosterImport(parsed, { createMissing: true });

  console.log('Hoja:', parsed.sheetName, '| Año:', parsed.year);
  console.log('Resumen de la importación:');
  console.log('  - Celdas de turno leídas:', summary.totalRows);
  console.log('  - Técnicos asignados:', summary.matchedTechnicians);
  console.log('  - Técnicos creados:', summary.createdTechnicians);
  console.log('  - Turnos creados:', summary.createdShifts);
  console.log('  - Turnos previos reemplazados:', summary.deletedShifts);
  console.log('  - Rango:', summary.dateStart, '→', summary.dateEnd);
  if (summary.unmatched.length) console.log('  - Sin coincidencia:', summary.unmatched.join(', '));
  if (summary.unknownCodes.length) console.log('  - Códigos desconocidos:', summary.unknownCodes.join(', '));
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error importando calendario:', e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
