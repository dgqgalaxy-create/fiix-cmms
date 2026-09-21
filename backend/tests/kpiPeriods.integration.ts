/**
 * Prueba de integración AISLADA de los indicadores (KPIs):
 *
 *  1) Paros superpuestos de la MISMA línea no se cuentan dos veces (unión de
 *     intervalos): dos OT que se solapan dan la MISMA disponibilidad que una sola
 *     OT con la cobertura equivalente.
 *  2) Paros simultáneos en líneas DISTINTAS sí suman (cada línea aporta su tramo).
 *  3) Los límites de periodo (THIS_MONTH / CUSTOM) son los del calendario de PLANTA
 *     (America/Mexico_City), no los del TZ del proceso.
 *
 * Base temporal fiix_cmms_test_*; NUNCA toca la operativa.
 * Ejecutar desde backend/: bash scripts/run-kpi-periods-test.sh
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { getKPIs } from '../src/controllers/kpiController';
import {
  plantDateParts,
  plantWallClockToDate,
  plantStartOfMonth,
} from '../src/utils/plantTimezone';

// Disponibilidad calendario: denominador de 24 h, sin factor productivo estimado.
const PRODUCTIVE_FACTOR = 1;
const clip = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

async function callGetKpis(period: string, startDate?: string, endDate?: string) {
  const res = makeRes();
  const query: Record<string, string> = { period };
  if (startDate) query.startDate = startDate;
  if (endDate) query.endDate = endDate;
  const req: any = { query };
  await getKPIs(req, res);
  assert.equal(res._status, 200, `getKPIs respondió ${res._status}`);
  return res._body;
}

const ymd = (d: Date) => {
  const p = plantDateParts(d);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
};

/** Instante UTC de una hora de pared de planta hace `daysAgo` días. */
function plantWallDaysAgo(daysAgo: number, hour: number, minute = 0): Date {
  const p = plantDateParts(new Date(Date.now() - daysAgo * 86_400_000));
  return plantWallClockToDate(p.year, p.month, p.day, hour, minute) ?? new Date();
}

async function main() {
  const dbName = process.env.DATABASE_URL ?? '';
  if (!dbName.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${dbName})`);
  }

  const admin = await prisma.user.create({
    data: { name: 'Admin', email: `admin-kpi-${Date.now()}@test.local`, password_hash: 'x', role: 'ADMINISTRADOR' },
  });
  const l1 = await prisma.zone.create({ data: { name: 'L1-TEST' } });
  const l2 = await prisma.zone.create({ data: { name: 'L2-TEST' } });
  const mkAsset = async (code: string, zoneId: string) =>
    prisma.asset.create({
      data: { internal_code: code, name: code, brand: 'B', model: 'M', status: 'OPERATIVO', zone_id: zoneId },
    });
  const a1 = await mkAsset('KPI-A1', l1.id);
  const a2 = await mkAsset('KPI-A2', l2.id);

  const mkStoppedWo = async (assetId: string, from: Date, to: Date) =>
    prisma.workOrder.create({
      data: {
        title: 'Paro KPI',
        asset_id: assetId,
        zone_id: assetId === a1.id ? l1.id : l2.id,
        created_by_id: admin.id,
        status: 'FINALIZADO',
        maintenance_type: 'CORRECTIVO',
        machine_stopped: true,
        created_at: from,
        completed_at: to,
      },
    });

  const clearWos = () => prisma.workOrder.deleteMany({ where: { created_by_id: admin.id } });

  // Ventana CUSTOM de 2 días (anteayer → ayer) en hora de planta.
  const dayBeforeYesterday = plantWallDaysAgo(2, 0);
  const yesterday = plantWallDaysAgo(1, 0);
  const startDate = ymd(dayBeforeYesterday);
  const endDate = ymd(yesterday);
  const pStart = plantDateParts(dayBeforeYesterday);
  const pEnd = plantDateParts(yesterday);
  const periodStart = plantWallClockToDate(pStart.year, pStart.month, pStart.day) ?? new Date();
  const periodEndMs =
    (plantWallClockToDate(pEnd.year, pEnd.month, pEnd.day, 23, 59, 59) ?? new Date()).getTime() + 999;

  // ---- Escenario A: 2 OT superpuestas en la MISMA línea (10-12 y 11-13) ----
  await clearWos();
  const woA1 = await mkStoppedWo(a1.id, plantWallDaysAgo(2, 10), plantWallDaysAgo(2, 12));
  const woA2 = await mkStoppedWo(a1.id, plantWallDaysAgo(2, 11), plantWallDaysAgo(2, 13));
  const kpiA = await callGetKpis('CUSTOM', startDate, endDate);
  const availA = kpiA.metrics.ASSET_AVAILABILITY.value;

  // ---- Escenario B: una sola OT con la cobertura equivalente (10-13) ----
  await clearWos();
  await mkStoppedWo(a1.id, plantWallDaysAgo(2, 10), plantWallDaysAgo(2, 13));
  const kpiB = await callGetKpis('CUSTOM', startDate, endDate);
  const availB = kpiB.metrics.ASSET_AVAILABILITY.value;

  // La unión 10-13 (3 h) debe dar la misma disponibilidad en A y en B.
  assert.ok(
    Math.abs(availA - availB) <= 0.06,
    `A(${availA}) y B(${availB}) deben ser iguales (unión de paros superpuestos)`
  );
  console.log(`  ✓ 1: paros superpuestos de la misma línea cuentan UNA vez (${availA}% == ${availB}%)`);

  // ---- Escenario C: mismo tramo en DOS líneas distintas → suma por línea ----
  await clearWos();
  await mkStoppedWo(a1.id, plantWallDaysAgo(2, 10), plantWallDaysAgo(2, 13));
  await mkStoppedWo(a2.id, plantWallDaysAgo(2, 10), plantWallDaysAgo(2, 13));
  const kpiC = await callGetKpis('CUSTOM', startDate, endDate);
  const availC = kpiC.metrics.ASSET_AVAILABILITY.value;

  // Cálculo esperado: downtime = 3h * 2 líneas = 21.6e6 ms; teórico = nº zonas * periodo * factor.
  const zones = await prisma.zone.count();
  const periodMs = periodEndMs - periodStart.getTime() + 1;
  const theoretical = Math.max(zones, 1) * periodMs * PRODUCTIVE_FACTOR;
  const expectedDowntime = 2 * (plantWallDaysAgo(2, 13).getTime() - plantWallDaysAgo(2, 10).getTime());
  const expectedAvailC = clip(((theoretical - expectedDowntime) / theoretical) * 100, 0, 100);
  assert.ok(
    Math.abs(availC - expectedAvailC) <= 0.06,
    `C: esperado ${expectedAvailC.toFixed(1)}%, obtenido ${availC}%`
  );
  assert.ok(availC < availB, `dos líneas paradas deben bajar más la disponibilidad (${availC} < ${availB})`);
  console.log(`  ✓ 2: paros simultáneos en líneas distintas suman por línea (${availC}%)`);

  // ---- Escenario 3: límites de periodo en hora de planta ----
  const now = new Date();
  const body = await callGetKpis('THIS_MONTH');
  const expectedStart = plantStartOfMonth(now.getTime());
  const gotStart = new Date(body.period.start);
  assert.equal(
    gotStart.getTime(),
    expectedStart.getTime(),
    `THIS_MONTH debe iniciar en la medianoche de planta (${expectedStart.toISOString()}), recibí ${gotStart.toISOString()}`
  );

  const custom = await callGetKpis('CUSTOM', startDate, startDate);
  const customStart = new Date(custom.period.start);
  assert.equal(
    customStart.getTime(),
    periodStart.getTime(),
    `CUSTOM debe iniciar en la fecha civil de planta, recibí ${customStart.toISOString()}`
  );
  console.log('  ✓ 3: periodos KPI fijos en hora de planta (America/Mexico_City)');

  console.log('\nTodas las comprobaciones de KPIs pasaron ✔');
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
