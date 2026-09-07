/**
 * Prueba de integración AISLADA de protección del stock y compras.
 *
 * Verifica:
 *  A) Salidas manuales simultáneas nunca dejan stock negativo (una sola triunfa).
 *  B) Borrar una ENTRADA ya consumida queda bloqueado (evita stock negativo).
 *  C) Borrar una ENTRADA no consumida se permite (revierte el stock).
 *  D) Borrar una SALIDA revierte su efecto (stock vuelve a subir).
 *  E) Borrar un consumo ligado a una OT queda bloqueado (trazabilidad).
 *  F) Un Técnico NO puede cancelar una orden de compra; Gestionador sí.
 *  G) Dos recepciones simultáneas de la misma OC: una sola suma stock (anti-duplicado).
 *
 * Base temporal fiix_cmms_test_*; NUNCA toca la operativa.
 * Ejecutar desde backend/: bash scripts/run-stock-purchase-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { createTransaction, deleteTransaction } from '../src/controllers/inventoryController';
import { updatePurchaseOrderStatus } from '../src/controllers/purchaseOrderController';

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
  res.send = () => {
    if (res._status === 0) res._status = 200;
    return res;
  };
  return res;
}

async function registerMovement(params: {
  actorId: string;
  body: Record<string, unknown>;
}) {
  const res = makeRes();
  const req: any = { body: params.body, user: { userId: params.actorId } };
  await createTransaction(req as any, res);
  return res;
}

async function removeMovement(params: { id: string }) {
  const res = makeRes();
  const req: any = { params: { id: params.id } };
  await deleteTransaction(req as any, res);
  return res;
}

async function changePoStatus(params: {
  id: string;
  status: string;
  actorId: string;
  role: 'ADMINISTRADOR' | 'GESTIONADOR' | 'TECNICO';
  receivedItems?: Array<{ id: string; received_quantity: number }>;
}) {
  const res = makeRes();
  const req: any = {
    params: { id: params.id },
    body: { status: params.status, ...(params.receivedItems ? { received_items: params.receivedItems } : {}) },
    user: { userId: params.actorId, role: params.role },
  };
  await updatePurchaseOrderStatus(req as any, res);
  return res;
}

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  const admin = await prisma.user.create({
    data: { name: 'Admin', email: `admin-stock-${Date.now()}@test.local`, password_hash: 'x', role: 'ADMINISTRADOR' },
  });
  const tech = await prisma.user.create({
    data: { name: 'Tecnico', email: `tec-stock-${Date.now()}@test.local`, password_hash: 'x', role: 'TECNICO' },
  });
  const manager = await prisma.user.create({
    data: { name: 'Manager', email: `man-stock-${Date.now()}@test.local`, password_hash: 'x', role: 'GESTIONADOR' },
  });

  const makeItem = (code: string, stock: number) =>
    prisma.item.create({
      data: { internal_code: code, name: code, uom: 'PZA', stock },
    });

  // ---- A: salidas simultáneas nunca negativas ----
  {
    const item = await makeItem('STK-A-CONC', 5);
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        registerMovement({ actorId: tech.id, body: { item_id: item.id, amount: -3, reason: 'Salida A' } })
      )
    );
    const ok = attempts.filter((r) => r._status === 201).length;
    const rejected = attempts.filter((r) => r._status === 400).length;
    assert.equal(ok, 1, `solo una salida debe triunfar (ok=${ok})`);
    assert.equal(rejected, 5, `el resto debe rechazarse (400=${rejected})`);
    const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(after.stock, 2, 'stock 5 - 3 = 2 (nunca negativo)');
    const rows = await prisma.inventoryTransaction.count({ where: { item_id: item.id } });
    assert.equal(rows, 1, 'solo un movimiento de salida');
    console.log('  ✓ A: 6 salidas simultáneas → 1 triunfa, stock nunca negativo');
  }

  // ---- B: borrar ENTRADA ya consumida queda bloqueado ----
  {
    const item = await makeItem('STK-B-ENTRADA', 0);
    const inRes = await registerMovement({ actorId: tech.id, body: { item_id: item.id, amount: 5, reason: 'Entrada B' } });
    assert.equal(inRes._status, 201);
    const outRes = await registerMovement({ actorId: tech.id, body: { item_id: item.id, amount: -3, reason: 'Consumo B' } });
    assert.equal(outRes._status, 201);
    const inTx = await prisma.inventoryTransaction.findFirstOrThrow({ where: { item_id: item.id, amount: 5 } });
    const del = await removeMovement({ id: inTx.id });
    assert.equal(del._status, 400, 'borrar entrada consumida debe rechazarse');
    assert.match(del._body.error, /consumid/i);
    const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(after.stock, 2, 'stock intacto tras el rechazo');
    assert.equal(await prisma.inventoryTransaction.count({ where: { item_id: item.id } }), 2);
    console.log('  ✓ B: entrada consumida no se puede borrar (evita stock negativo)');
  }

  // ---- C: borrar ENTRADA no consumida se permite ----
  {
    const item = await makeItem('STK-C-ENTRADA', 0);
    const inRes = await registerMovement({ actorId: tech.id, body: { item_id: item.id, amount: 5, reason: 'Entrada C' } });
    const inTx = await prisma.inventoryTransaction.findFirstOrThrow({ where: { item_id: item.id, amount: 5 } });
    const del = await removeMovement({ id: inTx.id });
    assert.equal(del._status, 204);
    const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(after.stock, 0);
    console.log('  ✓ C: entrada no consumida se elimina revirtiendo el stock');
  }

  // ---- D: borrar SALIDA revierte su efecto ----
  {
    const item = await makeItem('STK-D-SALIDA', 10);
    const out = await registerMovement({ actorId: tech.id, body: { item_id: item.id, amount: -3, reason: 'Salida D' } });
    assert.equal(out._status, 201);
    const afterOut = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(afterOut.stock, 7);
    const outTx = await prisma.inventoryTransaction.findFirstOrThrow({ where: { item_id: item.id, amount: -3 } });
    const del = await removeMovement({ id: outTx.id });
    assert.equal(del._status, 204);
    const afterDel = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(afterDel.stock, 10, 'el stock vuelve a 10');
    console.log('  ✓ D: borrar salida devuelve el stock');
  }

  // ---- E: consumo ligado a OT no se puede borrar ----
  {
    const item = await makeItem('STK-E-OT', 20);
    const asset = await prisma.asset.create({
      data: { internal_code: 'STK-ASSET', name: 'Activo stock', brand: 'B', model: 'M', status: 'OPERATIVO' },
    });
    const wo = await prisma.workOrder.create({
      data: { title: 'OT stock', asset_id: asset.id, created_by_id: admin.id, status: 'FINALIZADO' },
    });
    const tx = await prisma.inventoryTransaction.create({
      data: {
        item_id: item.id,
        user_id: tech.id,
        work_order_id: wo.id,
        amount: -2,
        reason: 'Consumo OT FOL-1',
      },
    });
    await prisma.item.update({ where: { id: item.id }, data: { stock: { decrement: 2 } } });
    const del = await removeMovement({ id: tx.id });
    assert.equal(del._status, 400);
    assert.match(del._body.error, /orden de trabajo/i);
    const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(after.stock, 18);
    console.log('  ✓ E: consumo ligado a OT no se borra (trazabilidad)');
  }

  // ---- F: Técnico no cancela OC; Gestionador sí ----
  {
    const vendor = await prisma.vendor.create({ data: { internal_id: 'PROV-STK', name: 'Proveedor Stock' } });
    const po = await prisma.purchaseOrder.create({
      data: { vendor_id: vendor.id, status: 'APROBADA', created_by_id: admin.id },
    });
    const forbidden = await changePoStatus({ id: po.id, status: 'CANCELADA', actorId: tech.id, role: 'TECNICO' });
    assert.equal(forbidden._status, 403, `Técnico debe recibir 403, recibió ${forbidden._status}`);
    const still = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    assert.equal(still.status, 'APROBADA');
    const allowed = await changePoStatus({ id: po.id, status: 'CANCELADA', actorId: manager.id, role: 'GESTIONADOR' });
    assert.equal(allowed._status, 200, `Gestionador debe poder cancelar, recibió ${allowed._status}`);
    const after = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    assert.equal(after.status, 'CANCELADA');
    console.log('  ✓ F: Técnico no cancela OC; Gestionador sí');
  }

  // ---- G: dos recepciones simultáneas → una sola suma stock ----
  {
    const vendor = await prisma.vendor.create({ data: { internal_id: 'PROV-STKG', name: 'Proveedor Stock G' } });
    const item = await makeItem('STK-G-OC', 0);
    const po = await prisma.purchaseOrder.create({
      data: {
        vendor_id: vendor.id,
        status: 'APROBADA',
        created_by_id: admin.id,
        items: { create: { item_id: item.id, quantity: 10, unit_cost: 5 } },
      },
      include: { items: true },
    });
    const lineId = po.items[0].id;
    const attempts = await Promise.all([
      changePoStatus({ id: po.id, status: 'RECIBIDA', actorId: admin.id, role: 'ADMINISTRADOR', receivedItems: [{ id: lineId, received_quantity: 10 }] }),
      changePoStatus({ id: po.id, status: 'RECIBIDA', actorId: admin.id, role: 'ADMINISTRADOR', receivedItems: [{ id: lineId, received_quantity: 10 }] }),
    ]);
    const ok = attempts.filter((r) => r._status === 200).length;
    assert.equal(ok, 1, `una sola recepción debe triunfar (status=${attempts.map((r) => r._status).join(',')})`);
    const after = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(after.stock, 10, 'el stock suma una sola vez');
    const movs = await prisma.inventoryTransaction.count({ where: { item_id: item.id, amount: { gt: 0 } } });
    assert.equal(movs, 1, 'un solo movimiento de recepción');
    console.log('  ✓ G: recepciones simultáneas → una sola suma stock (anti-duplicado)');
  }

  console.log('\nTodas las comprobaciones de stock y compras pasaron ✔');
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
