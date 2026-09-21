/**
 * Prueba de integración AISLADA del borrado de notificaciones.
 * Base temporal fiix_cmms_test_*; NUNCA toca la operativa.
 * Ejecutar desde backend/: bash scripts/run-notifications-delete-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import {
  deleteNotification,
  deleteReadNotifications,
  deleteAllNotifications,
} from '../src/controllers/notificationController';

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

  const me = await prisma.user.create({
    data: { name: 'Yo', email: `notif-me-${Date.now()}@test.local`, password_hash: 'x', role: 'TECNICO' },
  });
  const other = await prisma.user.create({
    data: { name: 'Otro', email: `notif-other-${Date.now()}@test.local`, password_hash: 'x', role: 'TECNICO' },
  });

  const mk = (userId: string, title: string, is_read = false) =>
    prisma.appNotification.create({ data: { user_id: userId, title, message: 'm', is_read } });

  await mk(me.id, 'mia sin leer 1');
  await mk(me.id, 'mia leida 1', true);
  await mk(me.id, 'mia leida 2', true);
  const otherNotif = await mk(other.id, 'de otro');

  // 1) Borrar una propia (una leída, para conservar la no leída en el paso 3)
  const first = await prisma.appNotification.findFirstOrThrow({
    where: { user_id: me.id, is_read: true },
  });
  {
    const res = makeRes();
    await deleteNotification({ params: { id: first.id }, user: { userId: me.id } } as any, res as any);
    assert.equal(res._status, 200);
    assert.equal(await prisma.appNotification.count({ where: { id: first.id } }), 0);
  }

  // 2) No puede borrar la de otro usuario → 404 y sigue existiendo
  {
    const res = makeRes();
    await deleteNotification({ params: { id: otherNotif.id }, user: { userId: me.id } } as any, res as any);
    assert.equal(res._status, 404);
    assert.equal(await prisma.appNotification.count({ where: { id: otherNotif.id } }), 1);
  }

  // 3) Limpiar leídas: solo las mías leídas; la de otro y mi no leída siguen
  {
    const res = makeRes();
    await deleteReadNotifications({ user: { userId: me.id } } as any, res as any);
    assert.equal(res._status, 200);
    const mine = await prisma.appNotification.findMany({ where: { user_id: me.id } });
    assert.equal(mine.length, 1, 'queda solo mi notificación no leída');
    assert.equal(mine[0].is_read, false);
    assert.equal(await prisma.appNotification.count({ where: { id: otherNotif.id } }), 1);
  }

  // 4) Borrar todas las mías (no las de otros)
  {
    const res = makeRes();
    await deleteAllNotifications({ user: { userId: me.id } } as any, res as any);
    assert.equal(res._status, 200);
    assert.equal(await prisma.appNotification.count({ where: { user_id: me.id } }), 0);
    assert.equal(await prisma.appNotification.count({ where: { id: otherNotif.id } }), 1);
  }

  console.log('  ✓ Notificaciones: borrar una, proteger las de otros, limpiar leídas y borrar todas');
  console.log('\nTodas las comprobaciones de borrado de notificaciones pasaron ✔');
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
