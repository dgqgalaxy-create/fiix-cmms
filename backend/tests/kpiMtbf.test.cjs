const assert = require('node:assert/strict');
const { test } = require('node:test');
const prisma = require('../src/config/prisma').default;
const { getKPIs } = require('../src/controllers/kpiController');

test('MTBF uses filtered completed correctives, elapsed period, operating hours and optional goal', async () => {
  const originals = [];
  const mock = (object, key, fn) => { originals.push(() => { object[key] = fn.original; }); fn.original = object[key]; object[key] = fn; };
  const oldHours = process.env.FIIX_OPERATING_HOURS_PER_DAY;
  process.env.FIIX_OPERATING_HOURS_PER_DAY = '12';
  let assets = 2, goals = [];
  let orders = [
    ['CORRECTIVO', 'FINALIZADO', '2026-09-01T12:00:00Z'],
    ['CORRECTIVO', 'FINALIZADO', '2026-09-02T12:00:00Z'],
    ['PREVENTIVO', 'FINALIZADO', '2026-09-01T12:00:00Z'],
    ['CORRECTIVO', 'EN_PROCESO', null],
    ['CORRECTIVO', 'FINALIZADO', '2026-08-31T12:00:00Z'],
  ].map(([maintenance_type, status, end], i) => ({
    id: String(i), maintenance_type, status, completed_at: end ? new Date(end) : null,
    created_at: new Date('2026-09-01T06:00:00Z'), accumulated_time_ms: 3600000,
  }));
  mock(prisma.kPIGoal, 'findMany', async () => goals);
  mock(prisma.asset, 'count', async ({where}) => { assert.equal(where.status, 'OPERATIVO'); return assets; });
  mock(prisma.zone, 'findMany', async () => []);
  mock(prisma.systemSettings, 'findFirst', async () => null);
  mock(prisma.workOrder, 'count', async () => orders.length);
  mock(prisma.workOrder, 'findMany', async args => args.include ? orders : []);
  const fetch = async (query) => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await getKPIs({query}, res);
    assert.notEqual(res.code, 500);
    return res.body;
  };
  try {
    const query = {period:'CUSTOM', startDate:'2026-09-01', endDate:'2026-09-02'};
    let data = await fetch(query);
    assert.equal(data.metrics.MTBF.value, 24);
    assert.equal(data.metrics.MTBF.sampleSize, 2);
    assert.equal(data.metrics.MTBF.goalConfigured, false);
    assert.equal(data.metrics.MTBF.isNull, false);
    data = await fetch({...query, endDate:'2026-09-01'});
    assert.equal(data.metrics.MTBF.value, 24);
    assert.equal(data.metrics.MTBF.sampleSize, 1);
    goals = [{metricKey:'MTBF', targetValue:1500, unit:'horas'}];
    data = await fetch(query);
    assert.equal(data.metrics.MTBF.goal.targetValue, 1500);
    assert.equal(data.metrics.MTBF.goalConfigured, true);
    for (const period of ['THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'LAST_12_MONTHS', 'ALL']) {
      data = await fetch({period});
      const start = new Date(data.period.start), end = new Date(data.period.end);
      const failures = orders.filter(o => o.status === 'FINALIZADO' && o.maintenance_type === 'CORRECTIVO' && o.completed_at >= start && o.completed_at <= end).length;
      assert.equal(data.metrics.MTBF.sampleSize, failures, period);
      const observationStart = period === 'ALL' ? orders[0].created_at : start;
      const expected = failures ? Number(((end - observationStart) / 86400000 * 12 * assets / failures).toFixed(2)) : 0;
      assert.equal(data.metrics.MTBF.value, expected, period);
      assert.ok(end <= new Date());
    }
    assets = 0;
    assert.equal((await fetch(query)).metrics.MTBF.isNull, true);
    assets = 2;
    orders = [];
    assert.equal((await fetch(query)).metrics.MTBF.isNull, true);
  } finally {
    originals.reverse().forEach(restore => restore());
    if (oldHours === undefined) delete process.env.FIIX_OPERATING_HOURS_PER_DAY;
    else process.env.FIIX_OPERATING_HOURS_PER_DAY = oldHours;
  }
});
