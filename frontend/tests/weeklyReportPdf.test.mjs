import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
const moduleUrl = name => {
  let source = readFileSync(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8');
  let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  compiled = compiled.replace(/from '\.\/(\w+)'/g, (_, dependency) => `from '${moduleUrl(dependency)}'`);
  compiled = compiled.replace("from 'jspdf'", `from '${import.meta.resolve('jspdf')}'`);
  return `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
};
const { buildWeeklyReportPdf } = await import(moduleUrl('weeklyReportPdf'));
const base = { monday: '2026-09-21', today: '2026-09-24', updatedAt: '2026-09-24T18:00:00Z', now: Date.parse('2026-09-24T18:00:00Z'), orders: [], completed: [] };

test('empty selected week exports valid PDF and no invalid percentages', () => {
  const doc = buildWeeklyReportPdf(base);
  const pdf = doc.output();
  assert.ok(pdf.startsWith('%PDF-'));
  assert.ok(pdf.includes('2026-09-21 al 2026-09-27'));
  assert.ok(!pdf.includes('NaN'));
  assert.ok(pdf.includes('Sin solicitudes levantadas'));
});
test('large report paginates without losing folios or oversized cell content', () => {
  const orders = Array.from({ length: 80 }, (_, i) => ({ id: String(i), folio: i + 1, created_at: '2026-09-21T15:00:00Z', status: i % 2 ? 'FINALIZADO' : 'PENDIENTE', maintenance_type: 'CORRECTIVO', completed_at: i % 2 ? '2026-09-24T15:00:00Z' : undefined, asset: { name: i === 0 ? 'Equipo largo '.repeat(400) + 'FINDELNOMBRE' : 'Compresor principal de aire' }, zone: { name: 'Producción' }, requester_name: 'Solicitante de prueba', assigned_technicians: [{ name: 'Técnico de mantenimiento' }] }));
  const doc = buildWeeklyReportPdf({ ...base, orders, completed: orders });
  const pdf = doc.output();
  assert.ok(doc.getNumberOfPages() > 4);
  for (let i = 1; i <= 80; i++) assert.ok(pdf.includes(`FOL-${String(i).padStart(4, '0')}`));
  assert.ok(pdf.includes('FINDELNOMBRE'));
  assert.ok(pdf.includes('50.0 %'));
  if (process.env.PDF_SAMPLE) writeFileSync(process.env.PDF_SAMPLE, Buffer.from(doc.output('arraybuffer')));
});
