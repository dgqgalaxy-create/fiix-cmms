/**
 * Parámetros del tablero «Desempeño del equipo».
 *
 * Todo vive en `SystemSettings.performance_config` (JSONB) y se edita desde la app,
 * de modo que cambiar metas o umbrales NO requiere tocar código ni reconstruir.
 * El número de técnicos no es un parámetro: el equipo se descubre en cada consulta
 * (usuarios activos con rol Técnico/Gestionador).
 */

export type PerformanceMode = 'relative' | 'fixed';
export type PerformanceCompare = 'shift' | 'all';

export interface PerformanceTargets {
  /** Resuelto a la primera: % mínimo de OT sin reincidencia. */
  ftf_pct: number;
  /** Cumplimiento de fecha comprometida (%). */
  sla_pct: number;
  /** Cierres con evidencia (%). */
  evidence_pct: number;
  /** Labor registrada ÷ horas de turno (%). */
  utilization_pct: number;
  /** Minutos máximos de atención (creación/asignación → inicio). */
  attention_max_min: number;
  /** OT sin iniciar más antiguas permitidas (días). */
  backlog_max: number;
}

export interface PerformanceWeights {
  attention: number;
  utilization: number;
  ftf: number;
  sla: number;
  evidence: number;
  backlog: number;
}

export interface PerformanceFlags {
  /** Cierre «exprés»: menos de N minutos y sin evidencia ni refacciones. */
  express_close_min: number;
  /** OT asignadas sin iniciar después de N horas. */
  accept_without_start_hours: number;
  /** Cambios de técnico a partir de los cuales se marca ping-pong. */
  ping_pong_min: number;
  /** Ventana mínima antes del fin de turno (min) para marcar cierres de relleno. */
  end_of_shift_min: number;
  /** % mínimo de cierres con evidencia para no marcar la bandera. */
  evidence_min_pct: number;
  /** Diferencia (puntos) sobre el promedio del equipo para marcar selección de trabajo. */
  cherry_pick_margin: number;
  /** Activa la bandera de evidencia duplicada (requiere leer archivos). */
  duplicate_evidence_enabled: boolean;
}

export interface PerformanceConfig {
  version: number;
  mode: PerformanceMode;
  compare: PerformanceCompare;
  period_days: number;
  min_sample: number;
  rework_days: number;
  /** Días para considerar una OT sin iniciar como «backlog viejo». */
  backlog_days: number;
  weights: PerformanceWeights;
  targets: PerformanceTargets;
  /** Metas específicas por código de turno (sobrescriben las globales). */
  targets_by_code: Record<string, Partial<PerformanceTargets>>;
  flags: PerformanceFlags;
  /** Horas de jornada por código de turno (roster). 0 = descanso. */
  hours_by_code: Record<string, number>;
  /** Fin de turno (HH:MM) por código, para la bandera de cierre de relleno. */
  shift_end_by_code: Record<string, string>;
  thresholds: { green: number; amber: number };
}

export const SHIFT_CODES_KNOWN = [
  'D', 'N', 'M', 'D_TE', 'N_TE', 'TE', 'TXT', 'V', 'I', 'F', 'PSG', 'X', 'CURSO',
] as const;

/** Horas por jornada según Horarios: día y noche 12 h; mixto 9 h (sábado 5 h). */
export const DEFAULT_HOURS_BY_CODE: Record<string, number> = {
  D: 12,
  N: 12,
  M: 9,
  M_SAT: 5,
  D_TE: 12,
  N_TE: 12,
  TE: 8,
  TXT: 8,
  CURSO: 8,
  PSG: 0,
  V: 0,
  I: 0,
  F: 0,
  X: 0,
};

/** Fin de turno por código (Horarios: D 07-19, N 19-07, M 07-16 y sábado 07-12). */
export const DEFAULT_SHIFT_END_BY_CODE: Record<string, string> = {
  D: '19:00',
  N: '07:00',
  M: '16:00',
  M_SAT: '12:00',
  D_TE: '19:00',
  N_TE: '07:00',
  TE: '16:00',
  TXT: '16:00',
  CURSO: '16:00',
};

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  version: 1,
  mode: 'relative',
  compare: 'shift',
  period_days: 30,
  min_sample: 10,
  rework_days: 7,
  backlog_days: 7,
  weights: {
    attention: 20,
    utilization: 20,
    ftf: 20,
    sla: 15,
    evidence: 15,
    backlog: 10,
  },
  targets: {
    ftf_pct: 75,
    sla_pct: 90,
    evidence_pct: 90,
    utilization_pct: 60,
    attention_max_min: 15,
    backlog_max: 2,
  },
  targets_by_code: {},
  flags: {
    express_close_min: 5,
    accept_without_start_hours: 48,
    ping_pong_min: 2,
    end_of_shift_min: 30,
    evidence_min_pct: 90,
    cherry_pick_margin: 20,
    duplicate_evidence_enabled: true,
  },
  hours_by_code: { ...DEFAULT_HOURS_BY_CODE },
  shift_end_by_code: { ...DEFAULT_SHIFT_END_BY_CODE },
  thresholds: { green: 80, amber: 60 },
};

const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const num = (value: unknown, fallback: number, min = 0, max = 100000): number =>
  clampNumber(value, fallback, min, max);

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const recordOfNumbers = (
  value: unknown,
  fallback: Record<string, number>,
  min: number,
  max: number
): Record<string, number> => {
  const out: Record<string, number> = { ...fallback };
  if (!value || typeof value !== 'object') return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const code = String(key).toUpperCase();
    if (!code) continue;
    out[code] = clampNumber(raw, out[code] ?? 8, min, max);
  }
  return out;
};

const recordOfStrings = (value: unknown, fallback: Record<string, string>): Record<string, string> => {
  const out: Record<string, string> = { ...fallback };
  if (!value || typeof value !== 'object') return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const code = String(key).toUpperCase();
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!code || !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) continue;
    out[code] = text;
  }
  return out;
};

const normalizeTargets = (value: unknown, base: PerformanceTargets): PerformanceTargets => {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    ftf_pct: num(raw.ftf_pct, base.ftf_pct, 0, 100),
    sla_pct: num(raw.sla_pct, base.sla_pct, 0, 100),
    evidence_pct: num(raw.evidence_pct, base.evidence_pct, 0, 100),
    utilization_pct: num(raw.utilization_pct, base.utilization_pct, 0, 100),
    attention_max_min: num(raw.attention_max_min, base.attention_max_min, 1, 2880),
    backlog_max: num(raw.backlog_max, base.backlog_max, 0, 365),
  };
};

/**
 * Mezcla lo guardado con los valores por omisión: cualquier campo faltante o
 * inválido cae al valor sugerido, así una configuración vieja nunca rompe el tablero.
 */
export function normalizePerformanceConfig(raw: unknown): PerformanceConfig {
  const base = DEFAULT_PERFORMANCE_CONFIG;
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const targets_by_code: Record<string, Partial<PerformanceTargets>> = {};
  if (input.targets_by_code && typeof input.targets_by_code === 'object') {
    for (const [key, value] of Object.entries(input.targets_by_code as Record<string, unknown>)) {
      const code = String(key).toUpperCase();
      if (!code) continue;
      targets_by_code[code] = normalizeTargets(value, base.targets);
    }
  }

  return {
    version: 1,
    mode: input.mode === 'fixed' ? 'fixed' : 'relative',
    compare: input.compare === 'all' ? 'all' : 'shift',
    period_days: num(input.period_days, base.period_days, 7, 365),
    min_sample: num(input.min_sample, base.min_sample, 1, 100),
    rework_days: num(input.rework_days, base.rework_days, 1, 90),
    backlog_days: num(input.backlog_days, base.backlog_days, 1, 180),
    weights: {
      attention: num((input.weights as Record<string, unknown>)?.attention, base.weights.attention, 0, 100),
      utilization: num((input.weights as Record<string, unknown>)?.utilization, base.weights.utilization, 0, 100),
      ftf: num((input.weights as Record<string, unknown>)?.ftf, base.weights.ftf, 0, 100),
      sla: num((input.weights as Record<string, unknown>)?.sla, base.weights.sla, 0, 100),
      evidence: num((input.weights as Record<string, unknown>)?.evidence, base.weights.evidence, 0, 100),
      backlog: num((input.weights as Record<string, unknown>)?.backlog, base.weights.backlog, 0, 100),
    },
    targets: normalizeTargets(input.targets, base.targets),
    targets_by_code,
    flags: {
      express_close_min: num((input.flags as Record<string, unknown>)?.express_close_min, base.flags.express_close_min, 1, 480),
      accept_without_start_hours: num((input.flags as Record<string, unknown>)?.accept_without_start_hours, base.flags.accept_without_start_hours, 1, 720),
      ping_pong_min: num((input.flags as Record<string, unknown>)?.ping_pong_min, base.flags.ping_pong_min, 1, 20),
      end_of_shift_min: num((input.flags as Record<string, unknown>)?.end_of_shift_min, base.flags.end_of_shift_min, 5, 180),
      evidence_min_pct: num((input.flags as Record<string, unknown>)?.evidence_min_pct, base.flags.evidence_min_pct, 0, 100),
      cherry_pick_margin: num((input.flags as Record<string, unknown>)?.cherry_pick_margin, base.flags.cherry_pick_margin, 0, 100),
      duplicate_evidence_enabled: bool((input.flags as Record<string, unknown>)?.duplicate_evidence_enabled, base.flags.duplicate_evidence_enabled),
    },
    hours_by_code: recordOfNumbers(input.hours_by_code, base.hours_by_code, 0, 24),
    shift_end_by_code: recordOfStrings(input.shift_end_by_code, base.shift_end_by_code),
    thresholds: {
      green: num((input.thresholds as Record<string, unknown>)?.green, base.thresholds.green, 30, 100),
      amber: num((input.thresholds as Record<string, unknown>)?.amber, base.thresholds.amber, 0, 99),
    },
  };
}

/** Metas efectivas para un turno: las específicas sobrescriben las globales. */
export function targetsForCode(config: PerformanceConfig, code: string | null): PerformanceTargets {
  const override = code ? config.targets_by_code[code] : undefined;
  return override ? { ...config.targets, ...override } : config.targets;
}
