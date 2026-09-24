// Run: node --test -r ts-node/register/transpile-only tests/requestTracking.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { trackingQuery, requestTrackingSelect, getRequestTracking } = require('../src/controllers/requestTrackingController');
const prisma = require('../src/config/prisma').default;

test('accepts printed and numeric folios; combines zone and name', () => {
  for (const folio of ['FOL-0042', '42', 'fol 0042', 'WO-42']) assert.equal(trackingQuery({ folio }).where.folio, 42);
  const zone = '12345678-1234-1234-1234-123456789abc';
  assert.deepEqual(trackingQuery({ folio: '42', zone, requester: '  Ana  ', page: '2' }), {
    where: { folio: 42, zone_id: zone, requester_name: { contains: 'Ana', mode: 'insensitive' } }, page: 2, pageSize: 20,
  });
  assert.deepEqual(trackingQuery({ zone }).where, { zone_id: zone });
  assert.deepEqual(trackingQuery({ requester: 'Ana' }).where, { requester_name: { contains: 'Ana', mode: 'insensitive' } });
});

test('rejects empty, malformed, repeated and unbounded parameters', () => {
  for (const query of [{}, { requester: ' ' }, { folio: '-1' }, { folio: '2147483648' },
    { folio: ['42', '43'] }, { requester: 'a' }, { zone: 'invalid' },
    { folio: '42', page: '-1' }, { folio: '42', page: '1.5' },
    { folio: '42', page: '10001' }, { requester: 'a'.repeat(151) }]) assert.throws(() => trackingQuery(query));
});

test('public projection exposes only folio and status', () => {
  assert.deepEqual(requestTrackingSelect, { folio: true, status: true });
});

test('bounds results, includes closed states and rejects invalid input before database access', async () => {
  const originals = { count: prisma.workOrder.count, findMany: prisma.workOrder.findMany, transaction: prisma.$transaction };
  let calls = 0;
  prisma.workOrder.count = ({ where }) => { assert.equal(where.status, undefined); calls++; return 22; };
  prisma.workOrder.findMany = args => {
    calls++;
    assert.equal(args.skip, 20); assert.equal(args.take, 20);
    assert.deepEqual(args.select, { folio: true, status: true });
    return [{ folio: 42, status: 'FINALIZADO' }, { folio: 41, status: 'ANULADO' }];
  };
  prisma.$transaction = async values => values;
  const response = () => ({ code: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    const valid = response();
    await getRequestTracking({ query: { requester: 'Ana', page: '2' } }, valid);
    assert.equal(valid.headers['Cache-Control'], 'no-store');
    assert.equal(valid.body.total, 22);
    assert.deepEqual(valid.body.requests.map(item => item.status), ['FINALIZADO', 'ANULADO']);
    assert.equal(calls, 2);
    const invalid = response();
    await getRequestTracking({ query: {} }, invalid);
    assert.equal(invalid.code, 400); assert.equal(calls, 2);
  } finally {
    prisma.workOrder.count = originals.count; prisma.workOrder.findMany = originals.findMany; prisma.$transaction = originals.transaction;
  }
});
