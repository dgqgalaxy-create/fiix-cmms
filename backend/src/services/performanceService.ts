import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { getUploadsRoot, urlToRelativeUploadPath } from '../utils/uploadsCleanup';
import {
  dominantPatternType,
  loadRosterSnapshot,
  rosterDayFor,
} from '../utils/rosterSchedule';
import {
  PerformanceCompare,
  PerformanceConfig,
  PerformanceTargets,
  normalizePerformanceConfig,
  targetsForCode,
} from '../utils/performanceConfig';

export type PerformanceSemaphore = 'green' | 'amber' | 'red' | 'none';

export interface PerformanceFlagsSummary {
  express_close: number;
  accept_without_start: number;
  ping_pong: number;
  duplicate_evidence: number;
  end_of_shift: number;
  cherry_pick: boolean;
  evidence_low: boolean;
}

export interface TechnicianRow {
  user_id: string;
  name: string;
  role: string;
  shift_code: string | null;
  completed: number;
  sample: number;
  attention_min: number | null;
  utilization_pct: number | null;
  ftf_pct: number | null;
  sla_pct: number | null;
  evidence_pct: number | null;
  backlog_old: number;
  labor_hours: number;
  scheduled_hours: number;
  index: number | null;
  semaphore: PerformanceSemaphore;
  insufficient: boolean;
  scores: Record<string, number | null>;
  flags: PerformanceFlagsSummary;
}

export interface PerformanceReport {
  config: PerformanceConfig;
  from: string;
  to: string;
  compare: PerformanceCompare;
  rows: TechnicianRow[];
  teams: Array<{ shift_code: string | null; count: number; avg_index: number | null }>;
  reference: {
    technicians: number;
    shifts: number;
    ftf_p75: number | null;
    utilization_p75: number | null;
    attention_p50: number | null;
  };
  summary: {
    total_completed: number;
    avg_index: number | null;
    green: number;
    amber: number;
    red: number;
    insufficient: number;
    open_flags: number;
  };
  generated_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const round = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const percentile = (values: number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
};

/** Elemento más frecuente (turno dominante del técnico en el periodo). */
const mode = (values: string[]): string | null => {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
};

const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

/** Hora local (HH:MM) de una fecha en la zona indicada. */
const localHm = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
};

const toMinutes = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
};

const hasEvidence = (wo: {
  request_image_url: string | null;
  before_image_url: string | null;
  after_image_url: string | null;
  signature_clean_area: string | null;
  signature_delivery: string | null;
  resolution_notes: string | null;
  inventory_transactions: unknown[];
}): boolean =>
  Boolean(
    wo.before_image_url ||
      wo.after_image_url ||
      wo.signature_delivery ||
      wo.signature_clean_area ||
      (wo.resolution_notes && wo.resolution_notes.trim().length >= 8) ||
      wo.inventory_transactions.length > 0
  );

export async function getPerformanceConfig(): Promise<{
  config: PerformanceConfig;
  updated_at: string | null;
  updated_by: string | null;
}> {
  const settings = await prisma.systemSettings.findFirst({
    select: { performance_config: true, updated_at: true },
  });
  return {
    config: normalizePerformanceConfig(settings?.performance_config),
    updated_at: settings?.updated_at ? settings.updated_at.toISOString() : null,
    updated_by: null,
  };
}

export async function computeTeamReport(options: {
  from: Date;
  to: Date;
  compare: PerformanceCompare;
  configOverride?: PerformanceConfig;
  timeZone?: string;
}): Promise<PerformanceReport> {
  const { from, to, compare } = options;
  const { config } = options.configOverride
    ? { config: options.configOverride }
    : await getPerformanceConfig();
  const timeZone = options.timeZone || 'America/Mexico_City';

  const technicians = await prisma.user.findMany({
    where: { is_active: true, role: { in: ['TECNICO', 'GESTIONADOR'] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });

  // El horario vive en patrones (MIXTO / 4X4), excepciones y turnos explícitos.
  const roster = await loadRosterSnapshot(prisma as any, from, to);

  const completed = await prisma.workOrder.findMany({
    where: { completed_at: { gte: from, lte: to }, status: 'FINALIZADO' },
    select: {
      id: true,
      title: true,
      asset_id: true,
      status: true,
      maintenance_type: true,
      created_at: true,
      assigned_at: true,
      started_at: true,
      completed_at: true,
      due_date: true,
      paused_at: true,
      accumulated_time_ms: true,
      reassignment_count: true,
      request_image_url: true,
      before_image_url: true,
      after_image_url: true,
      signature_clean_area: true,
      signature_delivery: true,
      resolution_notes: true,
      assigned_technicians: { select: { id: true, name: true } },
      inventory_transactions: { select: { id: true } },
    },
  });

  const openOrders = await prisma.workOrder.findMany({
    where: {
      status: { in: ['PENDIENTE', 'EN_PROCESO', 'EN_ESPERA'] },
      created_at: { lte: to },
    },
    select: {
      id: true,
      asset_id: true,
      created_at: true,
      started_at: true,
      reassignment_count: true,
      assigned_technicians: { select: { id: true } },
    },
  });

  // Reincidencia: otras OT del mismo activo creadas dentro de la ventana posterior.
  const assetIds = [...new Set(completed.map((wo) => wo.asset_id))];
  const relatedOrders = assetIds.length
    ? await prisma.workOrder.findMany({
        where: {
          asset_id: { in: assetIds },
          created_at: { gte: new Date(from.getTime() - config.rework_days * DAY_MS), lte: new Date(to.getTime() + config.rework_days * DAY_MS) },
        },
        select: { id: true, asset_id: true, created_at: true, maintenance_type: true },
      })
    : [];

  const ordersByAsset = new Map<string, { id: string; created_at: Date; maintenance_type: string }[]>();
  for (const order of relatedOrders) {
    const list = ordersByAsset.get(order.asset_id) ?? [];
    list.push({ id: order.id, created_at: order.created_at, maintenance_type: order.maintenance_type });
    ordersByAsset.set(order.asset_id, list);
  }

  const isReworked = (wo: { id: string; asset_id: string; completed_at: Date | null; maintenance_type: string }): boolean => {
    if (!wo.completed_at || wo.maintenance_type !== 'CORRECTIVO') return false;
    const limit = new Date(wo.completed_at.getTime() + config.rework_days * DAY_MS);
    const related = ordersByAsset.get(wo.asset_id) ?? [];
    return related.some(
      (other) =>
        other.id !== wo.id &&
        other.maintenance_type === 'CORRECTIVO' &&
        other.created_at > wo.completed_at! &&
        other.created_at <= limit
    );
  };

  // Evidencia duplicada: misma imagen usada en más de una OT del periodo.
  const duplicateHashes = new Set<string>();
  const woDuplicateEvidence = new Map<string, boolean>();
  if (config.flags.duplicate_evidence_enabled) {
    try {
      const uploadsRoot = getUploadsRoot();
      const hashByWo = new Map<string, string[]>();
      const hashOwners = new Map<string, Set<string>>();
      let inspected = 0;
      for (const wo of completed) {
        if (inspected >= 600) break;
        const urls = [wo.before_image_url, wo.after_image_url, wo.request_image_url].filter(
          (url): url is string => Boolean(url)
        );
        for (const url of urls) {
          if (inspected >= 600) break;
          const relative = urlToRelativeUploadPath(url);
          if (!relative) continue;
          const absolute = path.join(uploadsRoot, relative);
          try {
            const buffer = await fs.promises.readFile(absolute);
            inspected += 1;
            const hash = crypto.createHash('md5').update(buffer).digest('hex');
            const list = hashByWo.get(wo.id) ?? [];
            list.push(hash);
            hashByWo.set(wo.id, list);
            const owners = hashOwners.get(hash) ?? new Set<string>();
            owners.add(wo.id);
            hashOwners.set(hash, owners);
          } catch {
            /* archivo ausente: se ignora */
          }
        }
      }
      for (const [hash, owners] of hashOwners) {
        if (owners.size > 1) duplicateHashes.add(hash);
      }
      for (const [woId, hashes] of hashByWo) {
        woDuplicateEvidence.set(woId, hashes.some((hash) => duplicateHashes.has(hash)));
      }
    } catch {
      /* si el almacenamiento no está accesible, la bandera queda en cero */
    }
  }

  const now = to;

  const rows: TechnicianRow[] = technicians.map((tech) => {
    const mine = completed.filter((wo) => wo.assigned_technicians.some((t) => t.id === tech.id));
    // Turno = patrón vigente (MIXTO / 4X4…) o, si no hay patrón, el turno explícito dominante.
    const patternType = dominantPatternType(roster, tech.id, from, to);
    const explicitCodes = roster.shifts
      .filter((shift) => shift.user_id === tech.id)
      .map((shift) => shift.shift_code);
    const shiftCode = patternType ?? mode(explicitCodes);
    const targets: PerformanceTargets = targetsForCode(config, shiftCode);

    const attentionSamples: number[] = [];
    for (const wo of mine) {
      if (!wo.started_at) continue;
      const start = (wo.assigned_at ?? wo.created_at).getTime();
      const diffMin = (wo.started_at.getTime() - start) / 60000;
      if (diffMin >= 0 && diffMin <= 60 * 24 * 30) attentionSamples.push(diffMin);
    }

    const laborMs = mine.reduce((sum, wo) => sum + Number(wo.accumulated_time_ms || 0), 0);
    const laborHours = laborMs / 3_600_000;

    // Horas programadas: recorre el calendario del periodo con patrones y excepciones.
    let scheduledHours = 0;
    for (let time = from.getTime(); time <= to.getTime(); time += DAY_MS) {
      const day = new Date(time).toISOString().slice(0, 10);
      const rosterDay = rosterDayFor(roster, tech.id, day, {
        hoursByCode: config.hours_by_code,
        shiftEndByCode: config.shift_end_by_code,
      });
      scheduledHours += rosterDay.hours;
    }

    const withDue = mine.filter((wo) => wo.due_date && wo.completed_at);
    const slaOk = withDue.filter((wo) => wo.completed_at! <= wo.due_date!).length;
    const evidenceOk = mine.filter((wo) => hasEvidence(wo)).length;
    const correctiveDone = mine.filter((wo) => wo.maintenance_type === 'CORRECTIVO');
    const ftfOk = correctiveDone.filter((wo) => !isReworked(wo)).length;

    const backlogOld = openOrders.filter(
      (wo) =>
        wo.assigned_technicians.some((t) => t.id === tech.id) &&
        !wo.started_at &&
        wo.created_at.getTime() <= now.getTime() - config.backlog_days * DAY_MS
    ).length;

    const expressClose = mine.filter((wo) => {
      if (!wo.started_at || !wo.completed_at) return false;
      const minutes = (wo.completed_at.getTime() - wo.started_at.getTime()) / 60000;
      return (
        minutes >= 0 &&
        minutes < config.flags.express_close_min &&
        !hasEvidence(wo) &&
        wo.inventory_transactions.length === 0
      );
    }).length;

    const acceptWithoutStart = openOrders.filter(
      (wo) =>
        wo.assigned_technicians.some((t) => t.id === tech.id) &&
        !wo.started_at &&
        wo.created_at.getTime() <= now.getTime() - config.flags.accept_without_start_hours * 3_600_000
    ).length;

    const pingPong =
      mine.filter((wo) => wo.reassignment_count >= config.flags.ping_pong_min).length +
      openOrders.filter(
        (wo) =>
          wo.reassignment_count >= config.flags.ping_pong_min &&
          wo.assigned_technicians.some((t) => t.id === tech.id)
      ).length;

    const duplicateEvidence = mine.filter((wo) => woDuplicateEvidence.get(wo.id)).length;

    let endOfShift = 0;
    for (const wo of mine) {
      if (!wo.completed_at) continue;
      const completionDay = dateKey(wo.completed_at);
      let rosterDay = rosterDayFor(roster, tech.id, completionDay, {
        hoursByCode: config.hours_by_code,
        shiftEndByCode: config.shift_end_by_code,
      });
      // El turno de noche termina al día siguiente: si hoy no hay turno, revisa ayer.
      if (!rosterDay.endTime) {
        const previousDay = dateKey(new Date(wo.completed_at.getTime() - DAY_MS));
        const previous = rosterDayFor(roster, tech.id, previousDay, {
          hoursByCode: config.hours_by_code,
          shiftEndByCode: config.shift_end_by_code,
        });
        if (previous.code === 'N' || previous.code === 'N_TE') rosterDay = previous;
      }
      if (!rosterDay.endTime) continue;
      const diff = toMinutes(rosterDay.endTime) - toMinutes(localHm(wo.completed_at, timeZone));
      const normalized = ((diff % 1440) + 1440) % 1440;
      if (normalized <= config.flags.end_of_shift_min) endOfShift += 1;
    }

    return {
      user_id: tech.id,
      name: tech.name,
      role: tech.role,
      shift_code: shiftCode,
      completed: mine.length,
      sample: mine.length,
      attention_min: attentionSamples.length ? round(median(attentionSamples) ?? 0) : null,
      utilization_pct: scheduledHours > 0 ? round((laborHours / scheduledHours) * 100) : null,
      ftf_pct: correctiveDone.length ? round((ftfOk / correctiveDone.length) * 100) : null,
      sla_pct: withDue.length ? round((slaOk / withDue.length) * 100) : null,
      evidence_pct: mine.length ? round((evidenceOk / mine.length) * 100) : null,
      backlog_old: backlogOld,
      labor_hours: round(laborHours, 2),
      scheduled_hours: round(scheduledHours, 2),
      index: null,
      semaphore: 'none',
      insufficient: mine.length < config.min_sample,
      scores: {},
      flags: {
        express_close: expressClose,
        accept_without_start: acceptWithoutStart,
        ping_pong: pingPong,
        duplicate_evidence: duplicateEvidence,
        end_of_shift: endOfShift,
        cherry_pick: false,
        evidence_low: (mine.length ? (evidenceOk / mine.length) * 100 : 100) < config.flags.evidence_min_pct,
      },
    } as TechnicianRow;
  });

  // Selección de trabajo: proporción de preventivas muy por encima del equipo.
  const teamPreventiveRatio = completed.length
    ? completed.filter((wo) => wo.maintenance_type === 'PREVENTIVO').length / completed.length
    : 0;

  // Comparación relativa por turno o contra todos.
  const groupKey = (row: TechnicianRow): string =>
    compare === 'all' ? 'all' : row.shift_code ?? 'SIN_TURNO';

  const metricGetters: Record<string, { get: (row: TechnicianRow) => number | null; inverse: boolean }> = {
    attention: { get: (row) => row.attention_min, inverse: true },
    utilization: { get: (row) => row.utilization_pct, inverse: false },
    ftf: { get: (row) => row.ftf_pct, inverse: false },
    sla: { get: (row) => row.sla_pct, inverse: false },
    evidence: { get: (row) => row.evidence_pct, inverse: false },
    backlog: { get: (row) => row.backlog_old, inverse: true },
  };

  const groups = new Map<string, TechnicianRow[]>();
  for (const row of rows) {
    const key = groupKey(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const row of rows) {
    const peers = groups.get(groupKey(row)) ?? [];
    const scores: Record<string, number | null> = {};

    for (const [metric, { get, inverse }] of Object.entries(metricGetters)) {
      const value = get(row);
      if (value === null || Number.isNaN(value)) {
        scores[metric] = null;
        continue;
      }
      if (config.mode === 'relative') {
        const values = peers
          .map((peer) => get(peer))
          .filter((v): v is number => v !== null && !Number.isNaN(v));
        if (values.length < 2) {
          scores[metric] = null;
          continue;
        }
        const better = inverse
          ? values.filter((v) => v >= value).length - 1
          : values.filter((v) => v <= value).length - 1;
        scores[metric] = better / (values.length - 1);
      } else {
        const targets = targetsForCode(config, row.shift_code);
        if (metric === 'attention') {
          const target = Math.max(1, targets.attention_max_min);
          scores[metric] = Math.max(0, Math.min(1, 1 - (value - target) / target));
        } else if (metric === 'backlog') {
          const target = Math.max(1, targets.backlog_max);
          scores[metric] = Math.max(0, Math.min(1, 1 - (value - target) / target));
        } else {
          const target = Math.max(1, (targets as unknown as Record<string, number>)[
            metric === 'utilization' ? 'utilization_pct' : `${metric}_pct`
          ] ?? 100);
          scores[metric] = Math.max(0, Math.min(1, (value / target)));
        }
      }
    }

    row.scores = scores;

    if (row.insufficient) {
      row.index = null;
      row.semaphore = 'none';
      continue;
    }

    let weighted = 0;
    let weightSum = 0;
    for (const [metric, { }] of Object.entries(metricGetters)) {
      const score = scores[metric];
      if (score === null || score === undefined) continue;
      const weight = Number((config.weights as unknown as Record<string, number>)[metric] ?? 0);
      if (weight <= 0) continue;
      weighted += score * weight;
      weightSum += weight;
    }

    const index = weightSum > 0 ? (weighted / weightSum) * 100 : null;
    row.index = index === null ? null : round(index);
    row.semaphore =
      index === null
        ? 'none'
        : index >= config.thresholds.green
          ? 'green'
          : index >= config.thresholds.amber
            ? 'amber'
            : 'red';
  }

  // Banderas de selección de trabajo (necesita el ratio del equipo ya calculado).
  const myPreventiveRatio = (row: TechnicianRow): number => {
    const mine = completed.filter((wo) => wo.assigned_technicians.some((t) => t.id === row.user_id));
    if (!mine.length) return 0;
    return mine.filter((wo) => wo.maintenance_type === 'PREVENTIVO').length / mine.length;
  };
  for (const row of rows) {
    const ratio = myPreventiveRatio(row);
    row.flags.cherry_pick =
      row.completed >= Math.max(5, config.min_sample) &&
      (ratio - teamPreventiveRatio) * 100 >= config.flags.cherry_pick_margin;
  }

  rows.sort((a, b) => (b.index ?? -1) - (a.index ?? -1) || a.name.localeCompare(b.name));

  const withIndex = rows.filter((row) => row.index !== null);
  const byShift = new Map<string | null, TechnicianRow[]>();
  for (const row of rows) {
    const list = byShift.get(row.shift_code) ?? [];
    list.push(row);
    byShift.set(row.shift_code, list);
  }

  const openFlags = rows.reduce(
    (sum, row) =>
      sum +
      row.flags.express_close +
      row.flags.accept_without_start +
      row.flags.ping_pong +
      row.flags.duplicate_evidence +
      row.flags.end_of_shift +
      (row.flags.cherry_pick ? 1 : 0) +
      (row.flags.evidence_low ? 1 : 0),
    0
  );

  return {
    config,
    from: from.toISOString(),
    to: to.toISOString(),
    compare,
    rows,
    teams: [...byShift.entries()]
      .map(([code, list]) => {
        const scored = list.filter((row) => row.index !== null);
        return {
          shift_code: code,
          count: list.length,
          avg_index: scored.length
            ? round(scored.reduce((sum, row) => sum + (row.index ?? 0), 0) / scored.length)
            : null,
        };
      })
      .sort((a, b) => (a.shift_code ?? '').localeCompare(b.shift_code ?? '')),
    reference: {
      technicians: technicians.length,
      shifts: byShift.size,
      ftf_p75: percentile(
        rows.map((row) => row.ftf_pct).filter((v): v is number => v !== null),
        0.75
      ),
      utilization_p75: percentile(
        rows.map((row) => row.utilization_pct).filter((v): v is number => v !== null),
        0.75
      ),
      attention_p50: median(
        rows.map((row) => row.attention_min).filter((v): v is number => v !== null)
      ),
    },
    summary: {
      total_completed: completed.length,
      avg_index: withIndex.length
        ? round(withIndex.reduce((sum, row) => sum + (row.index ?? 0), 0) / withIndex.length)
        : null,
      green: rows.filter((row) => row.semaphore === 'green').length,
      amber: rows.filter((row) => row.semaphore === 'amber').length,
      red: rows.filter((row) => row.semaphore === 'red').length,
      insufficient: rows.filter((row) => row.insufficient).length,
      open_flags: openFlags,
    },
    generated_at: new Date().toISOString(),
  };
}
