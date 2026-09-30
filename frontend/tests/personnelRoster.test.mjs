import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
const source = readFileSync(new URL('../src/utils/personnelRoster.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { personnelDayStatus, personnelCurrentStatus } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const base = { shifts: [], exceptions: [], patterns: [], technicians: [], holidays: [] };
const pattern = { user_id: 'u', start_date: '2026-09-28', pattern_type: '4X4_ROTATORIO' };
test('rotating and fixed patterns distinguish rest and night without browser timezone', () => {
  const roster = { ...base, patterns: [pattern] };
  assert.equal(personnelDayStatus(roster, 'u', '2026-09-28').label, 'Turno día');
  assert.equal(personnelDayStatus(roster, 'u', '2026-09-30').label, 'Turno noche');
  assert.equal(personnelDayStatus(roster, 'u', '2026-10-02').label, 'Descanso');
  assert.equal(personnelDayStatus(roster, 'u', '2026-09-27').label, 'Sin horario registrado');
  assert.equal(personnelDayStatus({ ...base, patterns: [{ ...pattern, pattern_type: 'MIXTO' }] }, 'u', '2026-10-04').label, 'Descanso');
});
test('explicit shifts match calendar precedence over incidents and patterns', () => {
  const roster = { ...base, patterns: [pattern], exceptions: [{ user_id: 'u', date: '2026-09-30', exception_type: 'FALTA' }], shifts: [{ user_id: 'u', date: '2026-09-30', shift_code: 'V' }] };
  assert.equal(personnelDayStatus(roster, 'u', '2026-09-30').label, 'Vacaciones');
  assert.equal(personnelDayStatus({ ...roster, shifts: [] }, 'u', '2026-09-30').label, 'Falta');
});
test('missing imported cells are not assumed to be confirmed rest; incidents without pattern are shown', () => {
  assert.equal(personnelDayStatus(base, 'u', '2026-09-30').kind, 'unknown');
  assert.equal(personnelDayStatus({ ...base, exceptions: [{ user_id: 'u', date: '2026-09-30', exception_type: 'TIEMPO_EXTRA' }] }, 'u', '2026-09-30').label, 'Tiempo extra');
});

const current = (roster, date) => personnelCurrentStatus(roster, 'u', new Date(date));
const shift = (date, code) => ({ ...base, shifts: [{ user_id: 'u', date, shift_code: code }] });
test('day shift has exact 07:00 inclusive and 19:00 exclusive plant boundaries', () => {
  const roster = shift('2026-09-30', 'D');
  assert.equal(current(roster, '2026-09-30T12:59:00Z').onDuty, false);
  assert.equal(current(roster, '2026-09-30T13:00:00Z').onDuty, true);
  assert.equal(current(roster, '2026-10-01T00:59:00Z').onDuty, true);
  assert.equal(current(roster, '2026-10-01T01:00:00Z').onDuty, false);
});
test('night shift continues across midnight, including month boundary', () => {
  const roster = shift('2026-09-30', 'N');
  assert.equal(current(roster, '2026-10-01T01:00:00Z').onDuty, true);
  assert.equal(current(roster, '2026-10-01T12:59:00Z').onDuty, true);
  assert.equal(current(roster, '2026-10-01T13:00:00Z').onDuty, false);
});
test('mixed schedule ends at 16 weekdays and 12 Saturday; Sunday pattern rests', () => {
  const roster = { ...base, patterns: [{ ...pattern, pattern_type: 'MIXTO' }] };
  assert.equal(current(roster, '2026-09-30T21:59:00Z').onDuty, true);
  assert.equal(current(roster, '2026-09-30T22:00:00Z').onDuty, false);
  assert.equal(current(roster, '2026-10-03T17:59:00Z').onDuty, true);
  assert.equal(current(roster, '2026-10-03T18:00:00Z').onDuty, false);
  assert.equal(current(roster, '2026-10-04T16:00:00Z').label, 'Descanso');
  assert.equal(current(shift('2026-10-04', 'M'), '2026-10-04T16:00:00Z').onDuty, false);
});
test('extra hours supplement imported regular shift and cross midnight', () => {
  const roster = { ...shift('2026-09-30', 'D'), exceptions: [{ user_id: 'u', date: '2026-09-30', exception_type: 'TIEMPO_EXTRA', start_time: '22:00', end_time: '02:00' }] };
  assert.equal(current(roster, '2026-09-30T16:00:00Z').onDuty, true);
  assert.equal(current(roster, '2026-10-01T03:59:00Z').onDuty, false);
  assert.match(current(roster, '2026-10-01T04:00:00Z').label, /Tiempo extra/);
  assert.equal(current(roster, '2026-10-01T07:59:00Z').onDuty, true);
  assert.equal(current(roster, '2026-10-01T08:00:00Z').onDuty, false);
});
test('vacations, missing hours and missing schedules are never counted as active', () => {
  assert.equal(current(shift('2026-09-30', 'V'), '2026-09-30T16:00:00Z').label, 'Vacaciones');
  assert.equal(current(shift('2026-09-30', 'TE'), '2026-09-30T16:00:00Z').onDuty, false);
  assert.equal(current(base, '2026-09-30T16:00:00Z').onDuty, false);
});
