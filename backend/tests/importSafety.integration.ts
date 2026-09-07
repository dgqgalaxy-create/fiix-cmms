/**
 * Prueba de integración AISLADA del import seguro de movimientos de inventario.
 *
 * Verifica que reimportar `Items - Inventory.csv`:
 *  - NO borra el historial capturado en la app (antes: TRUNCATE + recargar todo);
 *  - no duplica filas ya existentes (dedupe por Inventory ID y por tupla);
 *  - reporta (fila + motivo) las filas que no se pueden importar.
 *
 * Base temporal `fiix_cmms_test_*`; NUNCA toca la base operativa.
 * Ejecutar desde backend/: bash scripts/run-import-safety-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { importInventoryTransactionsFile } from '../src/utils/inventoryCsvImport';
import { parseCsvDate } from '../src/utils/parseCsvDate';

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  const tech = await prisma.user.create({
    data: { name: 'Tecnico', email: `tec-imp-${Date.now()}@test.local`, password_hash: 'x', role: 'TECNICO' },
  });
  const techEmail = tech.email;
  const item = await prisma.item.create({
    data: { internal_code: 'MTTO-IMPTEST', name: 'MTTO-IMPTEST', uom: 'PZA', stock: 100 },
  });

  // Movimiento "capturado en la app" que un re-import NO debe borrar.
  const liveDate = parseCsvDate('1/1/2026 8:00:00') ?? new Date();
  await prisma.inventoryTransaction.create({
    data: {
      item_id: item.id,
      user_id: tech.id,
      amount: -1,
      reason: 'Capturado en app',
      created_at: liveDate,
    },
  });

  // Línea a línea para armar el CSV de prueba.
  const rows: string[] = [];
  rows.push('INV-1001,MTTO-IMPTEST,1/1/2026 8:30:00,-2,' + techEmail + ',Consumo OT X'); // nueva
  rows.push('INV-1001,MTTO-IMPTEST,1/1/2026 8:30:00,-2,' + techEmail + ',Consumo OT X'); // duplicada en archivo
  rows.push('INV-2001,MTTO-NOEXISTE,1/1/2026 9:00:00,-1,' + techEmail + ',Algo'); // repuesto inexistente
  rows.push(',MTTO-IMPTEST,1/1/2026 8:00:00,-1,' + techEmail + ',Capturado en app'); // tupla = movimiento de la app
  rows.push('INV-3001,MTTO-IMPTEST,1/1/2026 9:30:00,-1,ghost-import@test.local,Razon'); // usuario inexistente → auto-crear
  rows.push(',,1/1/2026 10:00:00,-1,' + techEmail + ',Roto'); // fila incompleta
  const buffer = Buffer.from(['Inventory ID,Item ID,DateTime,Amount,User ID,Reason', ...rows].join('\n'), 'utf8');

  // 0) Vista previa (dry-run): calcula lo mismo SIN escribir nada.
  const preview = await importInventoryTransactionsFile(
    { originalname: 'Items - Inventory.csv', buffer },
    { dryRun: true }
  );
  assert.equal(preview.created, 2, 'preview: creados');
  assert.equal(preview.skippedExisting, 2, 'preview: omitidos');
  assert.equal(preview.autoCreatedUsers, 1, 'preview: usuarios que se crearían');
  assert.equal(preview.ignored.length, 2, 'preview: ignorados');
  assert.equal(
    await prisma.inventoryTransaction.count(),
    1,
    'la vista previa NO debe escribir nada (solo el movimiento de la app)'
  );
  assert.equal(await prisma.user.count({ where: { email: 'ghost-import@test.local' } }), 0);
  console.log('  ✓ Vista previa: calcula sin escribir (crea 2, omite 2, ignora 2, crearía 1 usuario)');

  const details = await importInventoryTransactionsFile({ originalname: 'Items - Inventory.csv', buffer });

  console.log('Detalles del import:', JSON.stringify(details, null, 2));

  // 1) El movimiento de la app sigue existiendo y sin duplicarse.
  const liveRows = await prisma.inventoryTransaction.findMany({
    where: { item_id: item.id, user_id: tech.id, reason: 'Capturado en app' },
  });
  assert.equal(liveRows.length, 1, 'el movimiento capturado en la app debe sobrevivir una sola vez');

  // 2) El total = 1 (app) + 2 creados (INV-1001 e INV-3001).
  const total = await prisma.inventoryTransaction.count();
  assert.equal(total, 3, `total esperado 3, hay ${total}`);

  // 3) El creado con Inventory ID conserva su external_id.
  const created1001 = await prisma.inventoryTransaction.findUnique({ where: { external_id: 'INV:INV-1001' } });
  assert.ok(created1001, 'debe existir el movimiento con external_id INV:INV-1001');
  assert.equal(created1001!.amount, -2);

  // 4) Conteos del detalle.
  assert.equal(details.created, 2, 'creados');
  assert.equal(details.skippedExisting, 2, 'omitidos (duplicado en archivo + tupla de la app)');
  assert.equal(details.autoCreatedUsers, 1, 'usuario fantasma auto-creado');
  assert.equal(details.ignored.length, 2, 'ignorados');
  const reasons = details.ignored.map((i) => i.reason).join(' | ');
  assert.ok(reasons.includes('Repuesto inexistente'), `falta motivo repuesto: ${reasons}`);
  assert.ok(reasons.includes('Fila incompleta'), `falta motivo fila incompleta: ${reasons}`);

  console.log('  ✓ Import seguro: conserva historial de la app, sin duplicados y con reporte por fila');
  console.log('\nTodas las comprobaciones del import seguro pasaron ✔');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
