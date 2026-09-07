/**
 * Prueba de integración AISLADA del centro de calidad de datos (solo lectura).
 * Base temporal fiix_cmms_test_*; NUNCA toca la operativa.
 * Ejecutar desde backend/: bash scripts/run-data-quality-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { buildDataQualityReport, fixStockToLedger, fixItemPrice } from '../src/utils/dataQuality';

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  const admin = await prisma.user.create({
    data: { name: 'Admin', email: `admin-dq-${Date.now()}@test.local`, password_hash: 'x', role: 'ADMINISTRADOR' },
  });
  const zone = await prisma.zone.create({ data: { name: 'L1-DQ' } });
  const asset = await prisma.asset.create({
    data: { internal_code: 'DQ-ASSET', name: 'Activo DQ', brand: 'B', model: 'M', status: 'OPERATIVO', zone_id: zone.id },
  });
  const mkItem = (code: string, stock: number, purchaseCost?: number | null) =>
    prisma.item.create({
      data: {
        internal_code: code,
        name: code,
        uom: 'PZA',
        stock,
        purchase_cost: purchaseCost === undefined ? 10 : purchaseCost,
      },
    });

  // Sano: stock = saldo de movimientos.
  const okItem = await mkItem('DQ-OK', 0);
  await prisma.inventoryTransaction.create({ data: { item_id: okItem.id, user_id: admin.id, amount: 5, reason: 'IN' } });
  await prisma.item.update({ where: { id: okItem.id }, data: { stock: 5 } });

  // 1) Diferencia de inventario: stock sin movimientos.
  await mkItem('DQ-MISMATCH', 10);

  // 2) Sin precio pero con movimientos.
  const noPrice = await mkItem('DQ-NOPRICE', 0, null);
  await prisma.inventoryTransaction.create({ data: { item_id: noPrice.id, user_id: admin.id, amount: 3, reason: 'IN' } });
  await prisma.item.update({ where: { id: noPrice.id }, data: { stock: 3 } });

  // 3) Foto faltante: FINALIZADO sin foto «después».
  const woPhoto = await prisma.workOrder.create({
    data: {
      title: 'OT sin foto después',
      asset_id: asset.id,
      zone_id: zone.id,
      created_by_id: admin.id,
      status: 'FINALIZADO',
      completed_at: new Date(),
    },
  });

  // 4) Tiempo atípico: OT que tardó 40 días (con foto para no duplicar el caso 3).
  const longAgo = new Date(Date.now() - 40 * 86_400_000);
  await prisma.workOrder.create({
    data: {
      title: 'OT larga',
      asset_id: asset.id,
      zone_id: zone.id,
      created_by_id: admin.id,
      status: 'FINALIZADO',
      created_at: longAgo,
      completed_at: new Date(),
      after_image_url: '/uploads/after.jpg',
    },
  });

  const report = await buildDataQualityReport();

  // 1) Stock vs movimientos
  assert.ok(
    report.items.stockMismatches.some((r) => r.label.startsWith('DQ-MISMATCH')),
    'debe detectar el ítem con diferencia de inventario'
  );
  assert.ok(
    !report.items.stockMismatches.some((r) => r.label.startsWith('DQ-OK')),
    'el ítem sano no debe salir como diferencia'
  );

  // 2) Sin precio
  assert.ok(
    report.items.noPrice.some((r) => r.label.startsWith('DQ-NOPRICE')),
    'debe detectar el repuesto sin precio con movimientos'
  );

  // 3) Fotos faltantes
  assert.ok(
    report.items.photosMissing.some((r) => r.id === woPhoto.id),
    'debe detectar la OT finalizada sin foto «después»'
  );

  // 4) Tiempos atípicos (vida > 30 días)
  assert.ok(
    report.items.atypicalTimes.some((r) => r.label.includes('OT larga') && /días/.test(r.detail)),
    'debe detectar la OT con vida total atípica'
  );

  // ---- Correcciones (auditadas) ----
  const mismatchItem = await prisma.item.findUniqueOrThrow({ where: { internal_code: 'DQ-MISMATCH' } });
  const fixStock = await fixStockToLedger(mismatchItem.id, { reason: 'Ajuste de prueba' });
  assert.equal(fixStock.before, 10);
  assert.equal(fixStock.after, 0, 'el stock debe quedar igual al saldo (0 movimientos)');
  const fixPrice = await fixItemPrice(noPrice.id, 25.5, { reason: 'Precio de prueba' });
  assert.equal(fixPrice.before, null);
  assert.equal(fixPrice.after, 25.5);

  const after2 = await buildDataQualityReport();
  assert.ok(
    !after2.items.stockMismatches.some((r) => r.label.startsWith('DQ-MISMATCH')),
    'tras la corrección ya no debe aparecer la diferencia de inventario'
  );
  assert.ok(
    !after2.items.noPrice.some((r) => r.label.startsWith('DQ-NOPRICE')),
    'tras la corrección ya no debe aparecer el repuesto sin precio'
  );
  const audit = await prisma.auditLog.findMany({
    where: { action: { in: ['INVENTORY_STOCK_CORRECTION', 'ITEM_PRICE_CORRECTION'] } },
    orderBy: { created_at: 'desc' },
  });
  assert.equal(audit.length, 2, 'ambas correcciones deben quedar auditadas');
  const metas = audit.map((a) => (a.meta as { after?: number | null })?.after);
  assert.ok(metas.includes(25.5), 'el meta de la corrección de precio debe contener el nuevo precio');

  console.log(
    `  ✓ Calidad de datos: stock=${report.counts.stockMismatches}, sinPrecio=${report.counts.noPrice}, fotos=${report.counts.photosMissing}, tiempos=${report.counts.atypicalTimes}`
  );
  console.log('\nTodas las comprobaciones de calidad de datos pasaron ✔');
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
