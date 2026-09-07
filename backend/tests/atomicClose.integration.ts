/**
 * Prueba de integración AISLADA del cierre de OT + consumo de repuestos (todo-o-nada).
 *
 * Corre contra una base temporal (fiix_cmms_test_*), NUNCA contra la operativa.
 * Ejecutar desde backend/ con:
 *   bash scripts/run-atomic-close-test.sh
 *
 * Escenarios:
 *  1) Cierre exitoso descuenta repuestos y crea movimientos ligados a la OT.
 *  2) Cierre rechazado por stock insuficiente → NO cambia estado NI descuenta nada
 *     (aunque un repuesto anterior de la misma lista sí alcanzara).
 *  3) Cierres concurrentes de la misma OT → se descuenta UNA sola vez (antes se
 *     descontaba en cada intento que alcanzaba a leer EN_PROCESO, incluso si su
 *     cierre terminaba rechazado con 409).
 *  4) Reintento de cierre sobre OT ya FINALIZADO (replay offline) → no descuenta 2 veces.
 *  5) Lista de repuestos mal formada → 400 sin tocar nada.
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { updateWorkOrder } from '../src/controllers/workOrderController';

type Actor = { id: string; role: 'TECNICO' | 'ADMINISTRADOR' | 'GESTIONADOR' };

function makeRes() {
  const res: any = { _status: 0, _body: undefined };
  res.status = (code: number) => {
    res._status = code;
    return res;
  };
  res.json = (body: unknown) => {
    if (res._status === 0) res._status = 200; // Express: res.json() implica 200
    res._body = body;
    return res;
  };
  return res;
}

async function callUpdate(params: {
  workOrderId: string;
  actor: Actor;
  status: string;
  usedItems?: unknown;
  usedItemsAsString?: boolean;
  resolutionNotes?: string;
}) {
  const res = makeRes();
  const req: any = {
    params: { id: params.workOrderId },
    body: {
      status: params.status,
      resolution_notes: params.resolutionNotes ?? 'Notas de resolución de prueba',
      used_items:
        params.usedItems === undefined
          ? undefined
          : params.usedItemsAsString
            ? JSON.stringify(params.usedItems)
            : params.usedItems,
    },
    user: { userId: params.actor.id, role: params.actor.role },
    files: {},
  };
  await updateWorkOrder(req, res);
  return res;
}

async function seedBase() {
  const admin = await prisma.user.create({
    data: {
      name: 'Admin Prueba',
      email: `admin-atomic-${Date.now()}@test.local`,
      password_hash: 'x',
      role: 'ADMINISTRADOR',
    },
  });
  const tech = await prisma.user.create({
    data: {
      name: 'Tecnico Prueba',
      email: `tec-atomic-${Date.now()}@test.local`,
      password_hash: 'x',
      role: 'TECNICO',
    },
  });
  const asset = await prisma.asset.create({
    data: {
      internal_code: `TEST-ASSET-${Date.now()}`,
      name: 'Activo de prueba',
      brand: 'Brand',
      model: 'Model',
      status: 'OPERATIVO',
      asset_kind: 'FIJO',
    },
  });
  const makeItem = (code: string, stock: number, uom = 'PZA', qty_mode: 'INTEGER' | 'DECIMAL' = 'INTEGER') => {
    const unique = `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return prisma.item.create({
      data: {
        internal_code: unique,
        name: unique,
        uom,
        qty_mode,
        stock,
        purchase_cost: 10,
      },
    });
  };
  return { admin, tech, asset, makeItem };
}

async function makeOpenOrder(params: {
  title: string;
  assetId: string;
  createdById: string;
  assignedTechId?: string;
  status?: 'PENDIENTE' | 'EN_PROCESO' | 'EN_ESPERA';
}) {
  return prisma.workOrder.create({
    data: {
      title: params.title,
      asset_id: params.assetId,
      created_by_id: params.createdById,
      status: params.status ?? 'EN_PROCESO',
      ...(params.assignedTechId
        ? { assigned_technicians: { connect: [{ id: params.assignedTechId }] } }
        : {}),
    },
  });
}

async function counts(workOrderId: string) {
  return prisma.inventoryTransaction.count({ where: { work_order_id: workOrderId } });
}

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  const base = await seedBase();

  // ---- Caso 1: cierre exitoso descuenta y liga los movimientos ----
  {
    const itemA = await base.makeItem('TEST-IT-A', 10);
    const itemB = await base.makeItem('TEST-IT-B', 5);
    const wo = await makeOpenOrder({
      title: 'Caso1',
      assetId: base.asset.id,
      createdById: base.admin.id,
      assignedTechId: base.tech.id,
    });
    const res = await callUpdate({
      workOrderId: wo.id,
      actor: { id: base.tech.id, role: 'TECNICO' },
      status: 'FINALIZADO',
      usedItems: [
        { item_id: itemA.id, amount: 2 },
        { item_id: itemB.id, amount: 3 },
      ],
      usedItemsAsString: true, // FormData manda JSON string
    });
    assert.equal(res._status, 200, `Caso 1: esperaba 200, recibí ${res._status}`);

    const fresh = await prisma.workOrder.findUniqueOrThrow({ where: { id: wo.id } });
    assert.equal(fresh.status, 'FINALIZADO');
    assert.ok(fresh.completed_at, 'completed_at debe quedar estampado');
    const a = await prisma.item.findUniqueOrThrow({ where: { id: itemA.id } });
    const b = await prisma.item.findUniqueOrThrow({ where: { id: itemB.id } });
    assert.equal(a.stock, 8, 'itemA debió bajar 10 → 8');
    assert.equal(b.stock, 2, 'itemB debió bajar 5 → 2');
    const txs = await prisma.inventoryTransaction.findMany({ where: { work_order_id: wo.id } });
    assert.equal(txs.length, 2);
    const amounts = txs.map((t) => t.amount).sort((x, y) => x - y);
    assert.deepEqual(amounts, [-3, -2]);
    assert.ok(txs.every((t) => t.reason.includes('Consumo OT')), 'razón debe decir Consumo OT');
    console.log('  ✓ Caso 1: cierre exitoso descuenta y liga movimientos');
  }

  // ---- Caso 2: stock insuficiente en el 2º repuesto → todo revierte ----
  {
    const itemC2 = await base.makeItem('TEST-IT-C2-A', 10);
    const itemD2 = await base.makeItem('TEST-IT-C2-B', 5);
    const wo = await makeOpenOrder({
      title: 'Caso2',
      assetId: base.asset.id,
      createdById: base.admin.id,
      assignedTechId: base.tech.id,
    });
    const res = await callUpdate({
      workOrderId: wo.id,
      actor: { id: base.tech.id, role: 'TECNICO' },
      status: 'FINALIZADO',
      usedItems: [
        { item_id: itemC2.id, amount: 1 }, // alcanza…
        { item_id: itemD2.id, amount: 999 }, // …pero este no
      ],
    });
    assert.equal(res._status, 400, `Caso 2: esperaba 400, recibí ${res._status}`);
    assert.match(res._body.error, /Stock insuficiente/);
    const fresh = await prisma.workOrder.findUniqueOrThrow({ where: { id: wo.id } });
    assert.equal(fresh.status, 'EN_PROCESO', 'la OT NO debe quedar finalizada');
    const a = await prisma.item.findUniqueOrThrow({ where: { id: itemC2.id } });
    const b = await prisma.item.findUniqueOrThrow({ where: { id: itemD2.id } });
    assert.equal(a.stock, 10, 'itemA no debe quedar descontado');
    assert.equal(b.stock, 5, 'itemB no debe quedar descontado');
    assert.equal(await counts(wo.id), 0, 'no debe quedar ningún movimiento');
    console.log('  ✓ Caso 2: cierre rechazado revierte TODO (sin descuentos parciales)');
  }

  // ---- Caso 3: cierres concurrentes descuentan una sola vez ----
  {
    const shared = await base.makeItem('TEST-IT-C3', 10);
    const wo = await makeOpenOrder({
      title: 'Caso3',
      assetId: base.asset.id,
      createdById: base.admin.id,
      assignedTechId: base.tech.id,
    });
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () =>
        callUpdate({
          workOrderId: wo.id,
          actor: { id: base.tech.id, role: 'TECNICO' },
          status: 'FINALIZADO',
          usedItems: [{ item_id: shared.id, amount: 4 }],
        })
      )
    );
    const ok = attempts.filter((r) => r._status === 200).length;
    const conflicted = attempts.filter((r) => r._status === 409).length;
    assert.ok(ok >= 1, `al menos un cierre debe triunfar (ok=${ok})`);
    assert.ok(
      ok + conflicted === attempts.length,
      `respuestas inesperadas: ${attempts.map((r) => r._status).join(',')}`
    );
    const item = await prisma.item.findUniqueOrThrow({ where: { id: shared.id } });
    assert.equal(item.stock, 6, 'el stock debe descontarse UNA sola vez (10 → 6)');
    assert.equal(await counts(wo.id), 1, 'debe existir UN solo movimiento de consumo');
    const fresh = await prisma.workOrder.findUniqueOrThrow({ where: { id: wo.id } });
    assert.equal(fresh.status, 'FINALIZADO');
    console.log(`  ✓ Caso 3: ${attempts.length} cierres concurrentes → 1 descuento (200=${ok}, 409=${conflicted})`);
  }

  // ---- Caso 4: reintento sobre OT ya finalizada no descuenta dos veces ----
  {
    const itemC4 = await base.makeItem('TEST-IT-C4', 5);
    const wo = await makeOpenOrder({
      title: 'Caso4',
      assetId: base.asset.id,
      createdById: base.admin.id,
      assignedTechId: base.tech.id,
    });
    const first = await callUpdate({
      workOrderId: wo.id,
      actor: { id: base.tech.id, role: 'TECNICO' },
      status: 'FINALIZADO',
      usedItems: [{ item_id: itemC4.id, amount: 1 }],
    });
    assert.equal(first._status, 200, `Caso 4 primer cierre: ${first._status}`);
    const afterFirst = await prisma.item.findUniqueOrThrow({ where: { id: itemC4.id } });
    const replay = await callUpdate({
      workOrderId: wo.id,
      actor: { id: base.admin.id, role: 'ADMINISTRADOR' },
      status: 'FINALIZADO',
      usedItems: [{ item_id: itemC4.id, amount: 1 }],
    });
    assert.equal(replay._status, 200, `Caso 4 replay: ${replay._status}`);
    const afterReplay = await prisma.item.findUniqueOrThrow({ where: { id: itemC4.id } });
    assert.equal(afterReplay.stock, afterFirst.stock, 'el replay no debe volver a descontar');
    assert.equal(await counts(wo.id), 1);
    console.log('  ✓ Caso 4: replay de cierre no descuenta dos veces');
  }

  // ---- Caso 5: lista mal formada → 400 sin tocar nada ----
  {
    const wo = await makeOpenOrder({
      title: 'Caso5',
      assetId: base.asset.id,
      createdById: base.admin.id,
      assignedTechId: base.tech.id,
    });
    const res = await callUpdate({
      workOrderId: wo.id,
      actor: { id: base.tech.id, role: 'TECNICO' },
      status: 'FINALIZADO',
      usedItems: 'esto-no-es-json',
    });
    assert.equal(res._status, 400);
    const fresh = await prisma.workOrder.findUniqueOrThrow({ where: { id: wo.id } });
    assert.equal(fresh.status, 'EN_PROCESO');
    assert.equal(await counts(wo.id), 0);
    console.log('  ✓ Caso 5: JSON inválido → 400 sin cambios');
  }

  console.log('\nTodas las comprobaciones de cierre atómico pasaron ✔');
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
