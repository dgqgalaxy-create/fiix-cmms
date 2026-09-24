import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/utils/weeklyReport.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { plantDay, weekStart, addDays, weeklyReport, repairMs, weekQuery } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const order = (values = {}) => ({ id: 'one', created_at: '2026-09-21T15:00:00Z', status: 'PENDIENTE', maintenance_type: 'CORRECTIVO', ...values });

test('plant timezone and Monday weeks handle midnight and year boundaries', () => {
  assert.equal(plantDay('2026-09-21T05:59:59Z'), '2026-09-20');
  assert.equal(plantDay('2026-09-21T06:00:00Z'), '2026-09-21');
  assert.equal(weekStart('2027-01-01'), '2026-12-28');
  assert.equal(weekStart('2026-09-27'), '2026-09-21');
  assert.equal(weekStart('2026-09-28'), '2026-09-28');
  assert.equal(addDays('2026-12-28', 6), '2027-01-03');
});
test('Monday request completed Thursday stays on Monday with its current state', () => {
  const report = weeklyReport([order({ status: 'FINALIZADO', completed_at: '2026-09-24T15:00:00Z' })], '2026-09-21', '2026-09-24');
  assert.equal(report.days[0].counts.FINALIZADO.CORRECTIVO, 1);
  assert.equal(report.days[0].counts.PENDIENTE.CORRECTIVO, 0);
  assert.equal(report.days[3].items.length, 0);
  assert.equal(report.days[0].backlog, 0);
  assert.equal(report.days[4].future, true);
});
test('cancelled orders excluded from denominator; backlog includes all open states', () => {
  const report = weeklyReport(['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA', 'FINALIZADO', 'ANULADO'].map(status => order({ status })), '2026-09-21', '2026-09-24');
  assert.equal(report.total, 5); assert.equal(report.valid, 4); assert.equal(report.totals.ANULADO, 1);
  assert.equal(report.days[0].backlog, 3);
  assert.equal(weeklyReport([order({ status: 'ANULADO' })], '2026-09-21', '2026-09-24').valid, 0);
});
test('historical weeks retain latest states; rows outside selected week excluded', () => {
  const report = weeklyReport([order({ status: 'FINALIZADO' }), order({ created_at: '2026-09-28T06:00:00Z' }), order({ created_at: '2026-09-21T05:59:59Z' })], '2026-09-21', '2026-10-01');
  assert.equal(report.total, 1); assert.equal(report.totals.FINALIZADO, 1);
  assert.ok(report.days.every(day => !day.future));
});
test('repair time excludes pauses and includes only a running active segment', () => {
  const base = order({ started_at: '2026-09-21T15:00:00Z', accumulated_time_ms: 3600000, last_resumed_at: '2026-09-24T15:00:00Z' });
  const now = Date.parse('2026-09-24T15:30:00Z');
  assert.equal(repairMs({ ...base, status: 'EN_PROCESO' }, now), 5400000);
  assert.equal(repairMs({ ...base, status: 'EN_ESPERA' }, now), 3600000);
  assert.equal(repairMs(order(), now), null);
});

test('API bounds use plant midnight regardless of server timezone', () => {
  assert.deepEqual(weekQuery('2026-09-21'), { startDate: '2026-09-21T06:00:00.000Z', endDate: '2026-09-28T05:59:59.999Z' });
  assert.equal(weekQuery('2021-07-12').startDate, '2021-07-12T05:00:00.000Z');
});
