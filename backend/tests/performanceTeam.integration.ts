/**
 * Prueba de integración AISLADA del tablero «Desempeño del equipo».
 *
 * Corre contra una base temporal (fiix_cmms_test_*), NUNCA contra la operativa.
 * Ejecutar desde backend/ con:
 *   bash scripts/run-performance-team-test.sh
 *
 * Escenarios:
 *  1) Normalización de la configuración: valores inválidos caen a los sugeridos.
 *  2) Metas por turno sobrescriben las globales.
 *  3) Modo fijo: índice, banderas de cierre exprés/ping-pong y muestra insuficiente.
 *  4) Modo relativo: compara percentiles del equipo sin salirse de 0-100.
 *  5) Backlog viejo y «aceptar sin iniciar» detectados desde OT abiertas.
 */
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma';
import { computeTeamReport } from '../src/services/performanceService';
import {
  DEFAULT_PERFORMANCE_CONFIG,
  normalizePerformanceConfig,
  targetsForCode,
  type PerformanceConfig,
} from '../src/utils/performanceConfig';

const DAY = 24 * 60 * 60 * 1000;

const baseConfig = (overrides: Partial<PerformanceConfig> = {}): PerformanceConfig =>
  normalizePerformanceConfig({ ...DEFAULT_PERFORMANCE_CONFIG, ...overrides });

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('fiix_cmms_test')) {
    throw new Error(`Negado: DATABASE_URL no apunta a una base de prueba (${url})`);
  }

  const stamp = Date.now();
  const now = new Date();
  const from = new Date(now.getTime() - 30 * DAY);
  const to = now;

  // ---- Caso 1: normalización ----
  {
    const config = normalizePerformanceConfig({
      mode: 'otro',
      min_sample: -5,
      period_days: 9999,
      weights: { attention: 'x' },
      targets: { ftf_pct: 500 },
      flags: { express_close_min: 0 },
      thresholds: { green: 10, amber: 150 },
    });
    assert.equal(config.mode, 'relative');
    assert.equal(config.min_sample, 1);
    assert.equal(config.period_days, 365);
    assert.equal(config.weights.attention, DEFAULT_PERFORMANCE_CONFIG.weights.attention);
    assert.equal(config.targets.ftf_pct, 100);
    assert.equal(config.flags.express_close_min, 1);
    assert.equal(config.thresholds.green, 30);
    assert.equal(config.thresholds.amber, 99);
    console.log('  ✓ Caso 1: configuración inválida normalizada a valores seguros');
  }

  // ---- Caso 2: metas por turno ----
  {
    const config = baseConfig({
      targets_by_code: { M: { utilization_pct: 35, attention_max_min: 5 } },
    });
    const forM = targetsForCode(config, 'M');
    const forD = targetsForCode(config, 'D');
    assert.equal(forM.utilization_pct, 35);
    assert.equal(forM.attention_max_min, 5);
    assert.equal(forD.utilization_pct, config.targets.utilization_pct);
    console.log('  ✓ Caso 2: las metas por turno sobrescriben solo su código');
  }

  const admin = await prisma.user.create({
    data: {
      name: 'Admin Desempeño',
      email: `admin-perf-${stamp}@test.local`,
      password_hash: 'x',
      role: 'ADMINISTRADOR',
    },
  });

  const makeTech = (name: string) =>
    prisma.user.create({
      data: {
        name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}-${stamp}@test.local`,
        password_hash: 'x',
        role: 'TECNICO',
        is_active: true,
      },
    });

  const techA = await makeTech('Tech Alfa');
  const techB = await makeTech('Tech Beta');
  const techC = await makeTech('Tech Gamma');

  const asset = await prisma.asset.create({
    data: {
      internal_code: `PERF-ASSET-${stamp}`,
      name: 'Activo desempeño',
      brand: 'Demo',
      model: 'X1',
      status: 'OPERATIVO',
    },
  });

  // Turnos: 12 días de 8 h para A y B (96 h programadas).
  const shiftDates: Date[] = [];
  for (let i = 1; i <= 12; i += 1) {
    shiftDates.push(new Date(now.getTime() - i * DAY));
  }
  await prisma.technicianShift.createMany({
    data: shiftDates.flatMap((date) => [
      { user_id: techA.id, date, shift_code: 'M' },
      { user_id: techB.id, date, shift_code: 'M' },
    ]),
  });

  const createCompleted = async (options: {
    techId: string;
    title: string;
    startOffsetMin: number;
    attentionMin: number;
    laborMs: number;
    evidence: boolean;
    reassignments: number;
    dayOffset: number;
  }) => {
    const completedAt = new Date(now.getTime() - options.dayOffset * DAY);
    const startedAt = new Date(completedAt.getTime() - options.startOffsetMin * 60000);
    const createdAt = new Date(startedAt.getTime() - options.attentionMin * 60000);
    return prisma.workOrder.create({
      data: {
        title: options.title,
        description: 'Prueba de desempeño',
        asset_id: asset.id,
        status: 'FINALIZADO',
        maintenance_type: 'CORRECTIVO',
        created_by_id: admin.id,
        created_at: createdAt,
        assigned_at: createdAt,
        started_at: startedAt,
        completed_at: completedAt,
        accumulated_time_ms: BigInt(options.laborMs),
        after_image_url: options.evidence ? `/uploads/test-${stamp}.jpg` : null,
        resolution_notes: options.evidence ? 'Trabajo terminado y verificado.' : null,
        reassignment_count: options.reassignments,
        assigned_technicians: { connect: [{ id: options.techId }] },
      },
    });
  };

  // Tech A: 12 cierres bien documentados, atención de 5 min, 2 h de labor.
  for (let i = 0; i < 12; i += 1) {
    await createCompleted({
      techId: techA.id,
      title: `Alfa ${i}`,
      startOffsetMin: 120,
      attentionMin: 5,
      laborMs: 2 * 3600 * 1000,
      evidence: true,
      reassignments: 0,
      dayOffset: 3 + i,
    });
  }

  // Tech B: 12 cierres exprés de 2 min, sin evidencia y con rebotes.
  for (let i = 0; i < 12; i += 1) {
    await createCompleted({
      techId: techB.id,
      title: `Beta ${i}`,
      startOffsetMin: 2,
      attentionMin: 60,
      laborMs: 2 * 3600 * 1000,
      evidence: false,
      reassignments: 3,
      dayOffset: 3 + i,
    });
  }

  // Tech C: solo 2 cierres → muestra insuficiente.
  for (let i = 0; i < 2; i += 1) {
    await createCompleted({
      techId: techC.id,
      title: `Gamma ${i}`,
      startOffsetMin: 60,
      attentionMin: 10,
      laborMs: 3600 * 1000,
      evidence: true,
      reassignments: 0,
      dayOffset: 4 + i,
    });
  }

  // OT abierta de B: asignada hace 4 días y sin iniciar.
  await prisma.workOrder.create({
    data: {
      title: 'Beta pendiente',
      asset_id: asset.id,
      status: 'PENDIENTE',
      maintenance_type: 'CORRECTIVO',
      created_by_id: admin.id,
      created_at: new Date(now.getTime() - 10 * DAY),
      assigned_at: new Date(now.getTime() - 10 * DAY),
      assigned_technicians: { connect: [{ id: techB.id }] },
    },
  });

  // ---- Caso 3: modo fijo ----
  const fixedConfig = baseConfig({ mode: 'fixed', min_sample: 10, compare: 'all' });
  const fixed = await computeTeamReport({ from, to, compare: 'all', configOverride: fixedConfig });
  const rowA = fixed.rows.find((row) => row.user_id === techA.id);
  const rowB = fixed.rows.find((row) => row.user_id === techB.id);
  const rowC = fixed.rows.find((row) => row.user_id === techC.id);
  assert.ok(rowA && rowB && rowC, 'faltan filas de técnicos');

  assert.equal(rowC.insufficient, true);
  assert.equal(rowC.index, null, 'con muestra insuficiente no debe haber índice');
  assert.equal(rowC.semaphore, 'none');

  assert.equal(rowB.flags.express_close, 12, 'debe detectar 12 cierres exprés');
  assert.ok(rowB.flags.ping_pong >= 12, 'debe detectar los rebotes');
  assert.equal(rowB.flags.accept_without_start, 1, 'debe detectar la OT asignada sin iniciar');
  assert.equal(rowB.backlog_old, 1, 'debe contar el backlog viejo');
  assert.equal(rowB.evidence_pct, 0);
  assert.equal(rowA.flags.express_close, 0);
  assert.equal(rowA.evidence_pct, 100);
  assert.ok((rowA.index ?? 0) > (rowB.index ?? 0), 'A debe puntuar por encima de B');
  console.log(
    `  ✓ Caso 3: modo fijo (A=${rowA.index}, B=${rowB.index}, C=sin muestra; exprés=${rowB.flags.express_close}, rebotes=${rowB.flags.ping_pong})`
  );

  // ---- Caso 4: modo relativo ----
  const relativeConfig = baseConfig({ mode: 'relative', min_sample: 10, compare: 'all' });
  const relative = await computeTeamReport({ from, to, compare: 'all', configOverride: relativeConfig });
  const relA = relative.rows.find((row) => row.user_id === techA.id);
  const relB = relative.rows.find((row) => row.user_id === techB.id);
  assert.ok(relA && relB);
  assert.ok((relA.index ?? 0) >= (relB.index ?? 0), 'en relativo A debe ir por delante de B');
  for (const row of relative.rows) {
    if (row.index !== null) {
      assert.ok(row.index >= 0 && row.index <= 100, `índice fuera de rango: ${row.index}`);
    }
  }
  console.log(`  ✓ Caso 4: modo relativo (A=${relA.index}, B=${relB.index}) dentro de 0-100`);

  // ---- Caso 5: metas por turno cambian el puntaje ----
  const strict = await computeTeamReport({
    from,
    to,
    compare: 'all',
    configOverride: baseConfig({ mode: 'fixed', min_sample: 10, targets_by_code: { M: { utilization_pct: 25 } } }),
  });
  const strictA = strict.rows.find((row) => row.user_id === techA.id);
  const normalA = fixed.rows.find((row) => row.user_id === techA.id);
  assert.ok(strictA && normalA);
  assert.ok(
    (strictA.scores.utilization ?? 0) > (normalA.scores.utilization ?? 0),
    'con meta de utilización 25 % el puntaje de A debe subir'
  );
  console.log(
    `  ✓ Caso 5: meta de turno M aplicada (utilización ${Math.round((normalA.scores.utilization ?? 0) * 100)} → ${Math.round((strictA.scores.utilization ?? 0) * 100)})`
  );

  // Limpieza de datos de la prueba.
  await prisma.workOrder.deleteMany({ where: { asset_id: asset.id } });
  await prisma.technicianShift.deleteMany({ where: { user_id: { in: [techA.id, techB.id] } } });
  await prisma.asset.delete({ where: { id: asset.id } });
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, techA.id, techB.id, techC.id] } } });

  console.log('\nTodas las pruebas de desempeño del equipo pasaron.');
}

main()
  .catch((err) => {
    console.error('FALLO:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
