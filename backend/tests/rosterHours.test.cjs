const assert = require('node:assert/strict');
const { test } = require('node:test');
const { intervalMinutes, timeRange, overlaps } = require('../src/utils/rosterHours');
const prisma = require('../src/config/prisma').default;
require('../src/utils/socket').emitRefresh = () => {};
const { addException, removeException } = require('../src/controllers/rosterController');
const user_id = '11111111-1111-1111-1111-111111111111';
const time_debt_id = '22222222-2222-2222-2222-222222222222';
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test('hours validation supports overnight and rejects missing, equal or malformed times', () => {
  assert.equal(intervalMinutes('19:00', '07:00'), 720);
  assert.equal(intervalMinutes('16:00', '19:00'), 180);
  for (const values of [['07:00', '07:00'], ['', '16:00'], ['24:00', '07:00'], ['07:99', '16:00']]) assert.equal(intervalMinutes(...values), null);
  assert.equal(overlaps(timeRange(new Date('2026-09-30'), '22:00', '02:00'), timeRange(new Date('2026-10-01'), '01:00', '03:00')), true);
});
test('three partial payments settle 9h; rejects duplicates, excess, wrong owner; removing restores balance', async () => {
  const saved = prisma.$transaction;
  const payments = [];
  let owner = user_id;
  const tx = {
    $queryRaw: async () => [],
    user: { findUnique: async () => ({ is_active: true }) },
    technicianTimeDebt: { findUnique: async () => ({ user_id: owner, date: new Date('2026-09-30'), total_minutes: 540, payments }) },
    technicianException: {
      findMany: async () => payments,
      create: async ({ data }) => { const item = { ...data, id: `33333333-3333-3333-3333-${String(payments.length + 1).padStart(12, '0')}` }; payments.push(item); return item; },
      findUnique: async ({ where }) => payments.find(item => item.id === where.id),
      delete: async ({ where }) => { payments.splice(payments.findIndex(item => item.id === where.id), 1); },
    },
  };
  prisma.$transaction = async callback => callback(tx);
  const write = async (date, extra = {}) => { const res = response(); await addException({ body: { user_id, date, exception_type: 'TIEMPO_POR_TIEMPO', start_time: '16:00', end_time: '19:00', time_debt_id, ...extra } }, res); return res; };
  try {
    assert.equal((await write('2026-09-30')).code, 200);
    assert.equal((await write('2026-09-30')).code, 400);
    owner = 'other'; assert.equal((await write('2026-10-01')).code, 400); owner = user_id;
    assert.equal((await write('2026-10-01')).code, 200);
    assert.equal((await write('2026-10-02')).code, 200);
    assert.equal(payments.reduce((sum, item) => sum + item.paid_minutes, 0), 540);
    assert.equal((await write('2026-10-03')).code, 400);
    const res = response(); await removeException({ params: { id: payments[2].id } }, res);
    assert.equal(res.code, 200);
    assert.equal(payments.reduce((sum, item) => sum + item.paid_minutes, 0), 360);
    assert.equal((await write('2026-10-03')).code, 200);
    assert.equal((await write('2026-10-04', { start_time: undefined })).code, 400);
  } finally { prisma.$transaction = saved; }
});

test('roster queries include the first day at database DATE midnight', async () => {
  const { getRoster } = require('../src/controllers/rosterController');
  const models = ['technicianPattern', 'technicianException', 'technicianShift', 'user', 'holiday'];
  const originals = models.map(model => prisma[model].findMany);
  let range;
  for (const model of models) prisma[model].findMany = async args => { if (model === 'technicianShift') range = args.where.date; return []; };
  try {
    const res = response(); await getRoster({ query: { start: '2026-09-30', end: '2026-09-30' } }, res);
    assert.equal(res.code, 200);
    assert.equal(range.gte.toISOString(), '2026-09-30T00:00:00.000Z');
    assert.equal(range.lte.toISOString(), '2026-09-30T00:00:00.000Z');
    const invalid = response(); await getRoster({ query: { start: '2026-02-30' } }, invalid);
    assert.equal(invalid.code, 400);
  } finally { models.forEach((model, i) => prisma[model].findMany = originals[i]); }
});
