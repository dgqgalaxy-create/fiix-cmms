/**
 * Prueba de integración AISLADA del borrado definitivo de órdenes de trabajo.
 *
 * Corre contra una base temporal (fiix_cmms_test_*), NUNCA contra la operativa.
 * Ejecutar desde backend/ con:
 *   bash scripts/run-work-order-delete-test.sh
 *
 * Escenarios:
 *  1) Sin contraseña maestra → 403 DEV_PASSWORD_REQUIRED.
 *  2) Contraseña incorrecta → 403 DEV_PASSWORD_INVALID (cuenta intentos).
 *  3) Contraseña correcta → pasa el middleware.
 *  4) Borrar una OT FINALIZADA elimina la orden, sus movimientos de refacciones,
 *     comentarios, costos y archivos; devuelve el stock al inventario y deja
 *     constancia en la bitácora de auditoría.
 *  5) Orden inexistente → 404.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../src/config/prisma';
import { deleteWorkOrder, updateWorkOrder } from '../src/controllers/workOrderController';
import { verifyDevPasswordStrict } from '../src/middlewares/devPassword';

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

async function callMiddleware(userId: string, password?: string) {
  const req: any = {
    method: 'DELETE',
    path: '/',
    headers: password === undefined ? {} : { 'x-dev-password': password },
    user: { userId, role: 'ADMINISTRADOR' },
  };
  const res = makeRes();
  let nextCalled = false;
  await verifyDevPasswordStrict(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${url})`);
  }

  const stamp = Date.now();
  const admin = await prisma.user.create({
    data: {
      name: 'Admin Borrado',
      email: `admin-delete-${stamp}@test.local`,
      password_hash: 'x',
      role: 'ADMINISTRADOR',
    },
  });
  const asset = await prisma.asset.create({
    data: {
      internal_code: `DEL-ASSET-${stamp}`,
      name: 'Activo borrado',
      brand: 'Brand',
      model: 'Model',
      status: 'OPERATIVO',
      asset_kind: 'FIJO',
    },
  });

  // ---- Caso 1: sin contraseña ----
  {
    const { res, nextCalled } = await callMiddleware(admin.id);
    assert.equal(res._status, 403);
    assert.equal(res._body.code, 'DEV_PASSWORD_REQUIRED');
    assert.equal(nextCalled, false);
    console.log('  ✓ Caso 1: sin contraseña maestra → 403');
  }

  // ---- Caso 2: contraseña incorrecta ----
  {
    const { res, nextCalled } = await callMiddleware(admin.id, 'clave-equivocada');
    assert.equal(res._status, 403);
    assert.equal(res._body.code, 'DEV_PASSWORD_INVALID');
    assert.equal(nextCalled, false);
    assert.equal(res._body.remainingAttempts, 2);
    console.log('  ✓ Caso 2: contraseña incorrecta → 403 y cuenta intentos');
  }

  // ---- Caso 3: contraseña correcta ----
  {
    const { nextCalled } = await callMiddleware(admin.id, process.env.DEV_MENU_PASSWORD || 'DavidG.Q.1991');
    assert.equal(nextCalled, true);
    console.log('  ✓ Caso 3: contraseña correcta → pasa');
  }

  // ---- Caso 4: borrar OT finalizada con refacciones, comentario, costo y foto ----
  {
    const item = await prisma.item.create({
      data: {
        internal_code: `DEL-ITEM-${stamp}`,
        name: 'Balero de prueba',
        uom: 'PZA',
        qty_mode: 'INTEGER',
        stock: 10,
        purchase_cost: 25,
      },
    });

    // Archivo real de evidencia para comprobar el borrado físico.
    const uploadsRoot = path.join(__dirname, '../uploads');
    const relFile = `workorders/test-delete-${stamp}.jpg`;
    const absFile = path.join(uploadsRoot, relFile);
    await fs.promises.mkdir(path.dirname(absFile), { recursive: true });
    await fs.promises.writeFile(absFile, 'evidencia');

    const wo = await prisma.workOrder.create({
      data: {
        title: 'OT finalizada a borrar',
        asset_id: asset.id,
        created_by_id: admin.id,
        status: 'EN_PROCESO',
        before_image_url: `/uploads/${relFile}`,
        assigned_technicians: { connect: [{ id: admin.id }] },
      },
    });

    // Cierra la OT consumiendo 3 piezas (stock 10 → 7).
    const closeRes = makeRes();
    await updateWorkOrder(
      {
        params: { id: wo.id },
        body: {
          status: 'FINALIZADO',
          resolution_notes: 'Cierre de prueba',
          used_items: JSON.stringify([{ item_id: item.id, amount: 3 }]),
        },
        user: { userId: admin.id, role: 'ADMINISTRADOR' },
        files: {},
      } as any,
      closeRes
    );
    assert.equal(closeRes._status, 200, `cierre esperaba 200, recibí ${closeRes._status}`);

    const afterClose = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(afterClose.stock, 7);

    await prisma.workOrderComment.create({
      data: { work_order_id: wo.id, author_id: admin.id, body: 'Comentario que debe borrarse' },
    });
    await prisma.workOrderCost.create({
      data: { work_order_id: wo.id, description: 'Flete', amount: 150 },
    });

    const delRes = makeRes();
    await deleteWorkOrder(
      { params: { id: wo.id }, user: { userId: admin.id, role: 'ADMINISTRADOR' } } as any,
      delRes
    );
    assert.equal(delRes._status, 200, `borrado esperaba 200, recibí ${delRes._status}`);

    assert.equal(await prisma.workOrder.findUnique({ where: { id: wo.id } }), null);
    assert.equal(await prisma.inventoryTransaction.count({ where: { work_order_id: wo.id } }), 0);
    assert.equal(await prisma.workOrderComment.count({ where: { work_order_id: wo.id } }), 0);
    assert.equal(await prisma.workOrderCost.count({ where: { work_order_id: wo.id } }), 0);

    const afterDelete = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });
    assert.equal(afterDelete.stock, 10, 'el stock debe volver a 10');

    assert.equal(fs.existsSync(absFile), false, 'el archivo de evidencia debe borrarse');

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'WORK_ORDER_DELETED', entity_id: wo.id },
      orderBy: { created_at: 'desc' },
    });
    assert.ok(audit, 'debe existir el registro de auditoría');
    assert.match(audit!.summary, /Orden eliminada/);
    const meta = audit!.meta as any;
    assert.equal(meta.inventory_movements.length, 1);
    assert.equal(meta.restored_stock[0].amount, 3);
    assert.equal(meta.status, 'FINALIZADO');

    console.log('  ✓ Caso 4: OT finalizada borrada, stock devuelto, archivos y auditoría correctos');
  }

  // ---- Caso 5: orden inexistente ----
  {
    const res = makeRes();
    await deleteWorkOrder(
      {
        params: { id: '00000000-0000-0000-0000-000000000000' },
        user: { userId: admin.id, role: 'ADMINISTRADOR' },
      } as any,
      res
    );
    assert.equal(res._status, 404);
    console.log('  ✓ Caso 5: orden inexistente → 404');
  }

  console.log('\nTodas las pruebas de borrado de OT pasaron.');
}

main()
  .catch((err) => {
    console.error('FALLO:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
