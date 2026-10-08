const assert = require('node:assert/strict');
const { test } = require('node:test');
const prisma = require('../src/config/prisma').default;
const { getKPIs, getChartData } = require('../src/controllers/kpiController');

test('MTBF = dias x horas x zonas / correctivas levantadas (creadas, excluye anuladas)', async () => {
  const originals = [];
  const mock = (object, key, fn) => { originals.push(() => { object[key] = fn.original; }); fn.original = object[key]; object[key] = fn; };
  let zoneCount = 2, goals = [], selectedZones = null;

  // [tipo, estado, created_at, completed_at]
  let orders = [
    ['CORRECTIVO', 'FINALIZADO',  '2026-09-01T06:00:00Z', '2026-09-01T12:00:00Z'],
    ['CORRECTIVO', 'EN_PROCESO',  '2026-09-01T08:00:00Z', null],
    ['CORRECTIVO', 'FINALIZADO',  '2026-09-02T06:00:00Z', '2026-09-02T12:00:00Z'],
    ['CORRECTIVO', 'FINALIZADO',  '2026-09-03T06:00:00Z', '2026-09-03T12:00:00Z'],
    ['CORRECTIVO', 'ANULADO',     '2026-09-01T06:00:00Z', null],
    ['PREVENTIVO', 'FINALIZADO',  '2026-09-01T06:00:00Z', '2026-09-01T12:00:00Z'],
  ].map(([maintenance_type, status, created, end], i) => ({
    id: String(i), asset: { zone_id: 'A' }, maintenance_type, status,
    completed_at: end ? new Date(end) : null,
    created_at: new Date(created), accumulated_time_ms: 3600000,
  }));

  mock(prisma.kPIGoal, 'findMany', async () => goals);
  mock(prisma.zone, 'count', async () => zoneCount);
  mock(prisma.zone, 'findMany', async () => []);
  mock(prisma.systemSettings, 'findFirst', async () => ({ response_time_zone_ids: selectedZones }));
  mock(prisma.inventoryTransaction, 'findMany', async () => []);
  mock(prisma.workOrder, 'count', async () => orders.length);
  // El filtro status != ANULADO vive en la consulta Prisma; lo simulamos aquí.
  mock(prisma.workOrder, 'findMany', async args => (args.include ? orders.filter(o => o.status !== 'ANULADO') : []));

  const fetch = async (query) => {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await getKPIs({ query }, res);
    assert.notEqual(res.code, 500);
    return res.body;
  };

  try {
    const query = { period: 'CUSTOM', startDate: '2026-09-01', endDate: '2026-09-02' };
    let data = await fetch(query);
    // 3 correctivas LEVANTADAS en 09-01..09-02: dos FINALIZADAS + una EN_PROCESO.
    // (la ANULADA y la PREVENTIVA quedan fuera)
    assert.equal(data.metrics.MTBF.sampleSize, 3);
    // 2 dias x 24 h x 2 zonas / 3 = 32
    assert.equal(data.metrics.MTBF.value, 32);
    assert.equal(data.metrics.MTBF.isNull, false);

    goals = [{ metricKey: 'MTBF', targetValue: 1500, unit: 'horas' }];
    data = await fetch(query);
    assert.equal(data.metrics.MTBF.goal.targetValue, 1500);
    assert.equal(data.metrics.MTBF.goalConfigured, true);

    for (const period of ['THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'THIS_YEAR', 'LAST_12_MONTHS', 'ALL']) {
      data = await fetch({ period });
      const start = new Date(data.period.start).getTime();
      const end = new Date(data.period.end).getTime();
      const failures = orders.filter(o =>
        o.maintenance_type === 'CORRECTIVO' && o.status !== 'ANULADO' &&
        o.created_at.getTime() >= start && o.created_at.getTime() <= end
      ).length;
      assert.equal(data.metrics.MTBF.sampleSize, failures, period);
      const observationStart = period === 'ALL'
        ? Math.min(...orders.filter(o => o.status !== 'ANULADO' && o.asset).map(o => o.created_at.getTime()))
        : start;
      const expected = failures
        ? Number(((end - observationStart) / 86400000 * 24 * zoneCount / failures).toFixed(2))
        : 0;
      assert.equal(data.metrics.MTBF.value, expected, period);
      assert.ok(end <= Date.now());
    }

    // Zona seleccionada: el numerador usa 1 zona.
    selectedZones = ['A'];
    data = await fetch(query);
    assert.equal(data.metrics.MTBF.sampleSize, 3);
    assert.equal(data.metrics.MTBF.value, 16); // 2 dias x 24 h x 1 zona / 3 = 16

    selectedZones = ['missing'];
    assert.equal((await fetch(query)).metrics.MTBF.isNull, true);

    // Grafica: suma de correctivas creadas por intervalo = 3 (no 2 como "finalizadas")
    selectedZones = null;
    const chartRes = { json(body) { this.body = body; }, status(code) { this.code = code; return this; } };
    await getChartData({ query }, chartRes);
    assert.notEqual(chartRes.code, 500);
    assert.equal(chartRes.body.reduce((s, d) => s + (d.mtbfSample || 0), 0), 3);

    // Sin correctivas levantadas -> null
    orders = [];
    assert.equal((await fetch(query)).metrics.MTBF.isNull, true);
  } finally {
    originals.reverse().forEach(restore => restore());
  }
});
