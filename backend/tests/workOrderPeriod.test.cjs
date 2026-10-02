const assert = require('node:assert/strict');
const { test } = require('node:test');
const { workOrderPeriod } = require('../src/utils/workOrderPeriod');
const prisma = require('../src/config/prisma').default;
require('../src/services/SlaService').getSlaSettings = async () => ({ sla_enabled: false, sla_policy: null });
const { getWorkOrders, getWorkOrdersSummary } = require('../src/controllers/workOrderController');
const response = () => ({ code: 200, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } });
test('September includes entire first and last plant days, independent of server timezone', () => {
 const { created_at } = workOrderPeriod('2026-09-01','2026-09-30');
 assert.equal(created_at.gte.toISOString(),'2026-09-01T06:00:00.000Z');
 assert.equal(created_at.lte.toISOString(),'2026-10-01T05:59:59.999Z');
 assert.ok(new Date('2026-10-01T05:00:00Z') <= created_at.lte);
 assert.ok(new Date('2026-10-01T06:00:00Z') > created_at.lte);
});
test('single date and historical filters work', () => {
 assert.deepEqual(workOrderPeriod('', ''), {});
 assert.equal(workOrderPeriod('2026-09-01','').created_at.lte, undefined);
 assert.equal(workOrderPeriod('', '2026-09-30').created_at.gte, undefined);
 assert.throws(() => workOrderPeriod('invalid', ''));
});
test('summary and paginated list use identical period; total excludes cancelled but not closed', async () => {
 const saved = { groupBy: prisma.workOrder.groupBy, count: prisma.workOrder.count, findMany: prisma.workOrder.findMany };
 let summaryWhere, listWhere;
 prisma.workOrder.groupBy = async ({where}) => { summaryWhere = where; return [{status:'PENDIENTE', _count:{id:3}}]; };
 prisma.workOrder.count = async () => 3;
 prisma.workOrder.findMany = async ({where}) => { listWhere = where; return []; };
 try {
  const query = {startDate:'2026-09-01',endDate:'2026-09-30'};
  const summary = response(); await getWorkOrdersSummary({query},summary);
  assert.equal(summary.code,200); assert.equal(summary.body.PENDIENTE,3);
  for (const status of ['PENDIENTE','EN_PROCESO','EN_ESPERA','FINALIZADO','ANULADO']) {
   const list = response();await getWorkOrders({query:{...query,status,page:'1',limit:'20'}},list);
   assert.equal(list.code,200);assert.ok(listWhere.AND.some(w => JSON.stringify(w) === JSON.stringify(summaryWhere)));
   assert.ok(listWhere.AND.some(w => w.status === status));assert.equal(list.body.total,3);
  }
  await getWorkOrders({query:{...query,excludeCancelled:'true',page:'1'}},response());
  assert.ok(listWhere.AND.some(w => w.status?.not === 'ANULADO'));
  assert.ok(!listWhere.AND.some(w => w.status?.notIn));
 } finally { Object.assign(prisma.workOrder,saved); }
});
