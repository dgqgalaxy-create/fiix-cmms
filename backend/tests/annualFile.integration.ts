/**
 * Prueba de integración AISLADA del expediente anual (solo lectura).
 * Base temporal fiix_cmms_test_*; NUNCA toca la operativa.
 * Ejecutar desde backend/: bash scripts/run-annual-file-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { buildAnnualFileData } from '../src/utils/annualFile';
import { plantDateParts, plantWallClockToDate } from '../src/utils/plantTimezone';

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  const admin = await prisma.user.create({
    data: { name: 'Admin', email: `admin-ann-${Date.now()}@test.local`, password_hash: 'x', role: 'ADMINISTRADOR' },
  });
  const zone = await prisma.zone.create({ data: { name: 'L1-ANNUAL' } });
  const asset = await prisma.asset.create({
    data: { internal_code: 'MTTO-ANN-1', name: 'Activo anual', brand: 'B', model: 'M', status: 'OPERATIVO', zone_id: zone.id },
  });
  const item = await prisma.item.create({
    data: { internal_code: 'MTTO-REF-ANUAL', name: 'Refacción anual', uom: 'PZA' },
  });
  const year = plantDateParts(new Date()).year;

  const wo = await prisma.workOrder.create({
    data: {
      title: 'OT expediente anual',
      description: 'Prueba',
      asset_id: asset.id,
      zone_id: zone.id,
      created_by_id: admin.id,
      status: 'FINALIZADO',
      completed_at: new Date(),
      resolution_notes: 'Notas del expediente',
      before_image_url: '/uploads/before.jpg',
      after_image_url: '/uploads/after.jpg',
      request_image_url: '/uploads/request.jpg',
    },
  });
  await prisma.inventoryTransaction.create({
    data: {
      item_id: item.id,
      user_id: admin.id,
      work_order_id: wo.id,
      amount: -3,
      unit_cost: 12.5,
      reason: `Consumo OT FOL-${String(wo.folio).padStart(4, '0')}`,
    },
  });

  const data = await buildAnnualFileData(year);

  assert.ok(data.period.start && data.period.end, 'periodo definido');
  assert.equal(data.counts.orders, 1, `esperaba 1 orden, hay ${data.counts.orders}`);
  assert.equal(data.orders[0].folio, wo.folio);
  assert.equal(data.orders[0].photo_before, '/uploads/before.jpg');
  assert.equal(data.orders[0].resolution_notes, 'Notas del expediente');
  assert.equal(data.counts.photos, 3, 'fotos (request, before, after)');
  assert.ok(
    data.consumptions.some((c) => c.item_code === 'MTTO-REF-ANUAL' && c.amount === 3 && c.unit_cost === 12.5),
    'consumo presente con cantidad y costo'
  );

  // El expediente de OTRO año debe salir vacío (año 2000 → sin datos).
  const empty = await buildAnnualFileData(2000);
  assert.equal(empty.counts.orders, 0);
  assert.equal(empty.orders.length, 0);

  // Límites: el inicio del año coincide con la medianoche de planta del 1 de enero.
  const expectedStart = plantWallClockToDate(year, 1, 1);
  assert.equal(new Date(data.period.start).getTime(), expectedStart!.getTime());

  console.log(`  ✓ Expediente anual ${year}: 1 orden, 1 consumo, 3 fotos; año 2000 vacío; límites en hora de planta`);
  console.log('\nTodas las comprobaciones del expediente anual pasaron ✔');
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
