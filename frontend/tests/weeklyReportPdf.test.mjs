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


test('PDF header uses selected ISO week on every page, including year boundaries', () => {
  for (const [monday, number] of [['2026-09-28', 40], ['2026-09-21', 39], ['2026-12-28', 53], ['2027-01-04', 1]]) {
    const doc = buildWeeklyReportPdf({ ...base, monday });
    for (const page of doc.internal.pages.slice(1)) {
      const content = page.join('\n');
      assert.ok(content.includes('(SEMANA) Tj'));
      assert.ok(content.includes(`(${number}) Tj`));
    }
    if (process.env.PDF_WEEK_SAMPLE && number === 40) writeFileSync(process.env.PDF_WEEK_SAMPLE, Buffer.from(doc.output('arraybuffer')));
  }
});


test('monthly PDF includes full selected month and paginates daily summary', () => {
  const orders = Array.from({length:31}, (_, i) => ({id:String(i),folio:i+100,created_at:`2026-10-${String(i+1).padStart(2,'0')}T15:00:00Z`,status:'FINALIZADO',maintenance_type:'CORRECTIVO',completed_at:`2026-10-${String(i+1).padStart(2,'0')}T18:00:00Z`,asset:{name:'Compresor principal'},requester_name:'Persona de prueba'}));
  const doc = buildWeeklyReportPdf({...base,monthly:true,monday:'2026-10-01',today:'2026-11-01',orders,completed:orders});
  const pdf = doc.output();
  assert.ok(pdf.includes('Informe mensual')); assert.ok(pdf.includes('2026-10-01 al 2026-10-31'));
  assert.ok(!pdf.includes('(SEMANA)')); assert.ok(pdf.includes('100.0 %'));
  for (const order of orders) assert.ok(pdf.includes(`FOL-${String(order.folio).padStart(4,'0')}`));
  assert.ok(doc.getNumberOfPages() > 3);
  if (process.env.MONTHLY_PDF_SAMPLE) writeFileSync(process.env.MONTHLY_PDF_SAMPLE,Buffer.from(doc.output('arraybuffer')));
});
