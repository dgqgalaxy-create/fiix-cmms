/**
 * Prueba de integración AISLADA: ediciones con bitácora de valores anteriores/nuevos.
 *  - updateItem → ITEM_UPDATE con meta.changes (nombre, precio antes → después).
 *  - updateWorkOrder (edición sin transición) → UPDATE_WORK_ORDER con meta.changes.
 * Base temporal fiix_cmms_test_*; NUNCA toca la operativa.
 * Ejecutar desde backend/: bash scripts/run-audit-changes-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { updateItem } from '../src/controllers/inventoryController';
import { updateWorkOrder } from '../src/controllers/workOrderController';

function makeRes() {
  const res: any = { _status: 0, _body: undefined };
  res.status = (code: number) => {
    res._status = code;
    return res;
  };
  res.json = (body: unknown) => {
    if (res._status === 0) res._status = 200;
    res._body = body;
    return res;
  };
  return res;
}

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  const admin = await prisma.user.create({
    data: { name: 'Admin', email: `admin-diff-${Date.now()}@test.local`, password_hash: 'x', role: 'ADMINISTRADOR' },
  });
  const asset = await prisma.asset.create({
    data: { internal_code: 'DIFF-ASSET', name: 'Activo diff', brand: 'B', model: 'M', status: 'OPERATIVO' },
  });

  // ---- 1) Edición de repuesto: ITEM_UPDATE con antes/después ----
  const item = await prisma.item.create({
    data: { internal_code: 'DIFF-ITEM', name: 'Nombre original', uom: 'PZA', purchase_cost: 10, stock: 2 },
  });
  {
    const res = makeRes();
    await updateItem(
      {
        params: { id: item.id },
        body: { name: 'Nombre nuevo', purchase_cost: '12.5' },
        files: {},
        user: { userId: admin.id, role: 'ADMINISTRADOR' },
      } as any,
      res as any
    );
    assert.equal(res._status, 200, `updateItem respondió ${res._status}`);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'ITEM_UPDATE', entity_id: item.id },
      orderBy: { created_at: 'desc' },
    });
    const changes = (log.meta as { changes?: Array<{ campo: string; antes: unknown; despues: unknown }> })
      ?.changes ?? [];
    const byName = Object.fromEntries(changes.map((c) => [c.campo, c]));
    assert.equal(byName['nombre']?.antes, 'Nombre original');
    assert.equal(byName['nombre']?.despues, 'Nombre nuevo');
    assert.equal(byName['precio']?.antes, 10);
    assert.equal(byName['precio']?.despues, 12.5);
    console.log('  ✓ ITEM_UPDATE registra cambios (nombre y precio, antes → después)');
  }

  // ---- 2) Edición de OT sin transición: UPDATE_WORK_ORDER con cambios ----
  const wo = await prisma.workOrder.create({
    data: { title: 'OT diff', asset_id: asset.id, created_by_id: admin.id, status: 'EN_PROCESO', resolution_notes: 'nota vieja' },
  });
  {
    const res = makeRes();
    await updateWorkOrder(
      {
        params: { id: wo.id },
        body: { status: 'EN_PROCESO', resolution_notes: 'nota nueva' },
        files: {},
        user: { userId: admin.id, role: 'ADMINISTRADOR' },
      } as any,
      res as any
    );
    assert.equal(res._status, 200, `updateWorkOrder respondió ${res._status}`);
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'UPDATE_WORK_ORDER', entity_id: wo.id },
      orderBy: { created_at: 'desc' },
    });
    const changes = (log.meta as { changes?: Array<{ campo: string; antes: unknown; despues: unknown }> })
      ?.changes ?? [];
    const byName = Object.fromEntries(changes.map((c) => [c.campo, c]));
    assert.equal(byName['notas de resolución']?.antes, 'nota vieja');
    assert.equal(byName['notas de resolución']?.despues, 'nota nueva');
    console.log('  ✓ UPDATE_WORK_ORDER registra cambios (notas de resolución antes → después)');
  }

  console.log('\nTodas las comprobaciones de auditoría con valores anteriores/nuevos pasaron ✔');
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
