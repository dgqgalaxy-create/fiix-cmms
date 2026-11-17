import api from './axios';

export type PerformanceMode = 'relative' | 'fixed';
export type PerformanceCompare = 'shift' | 'all';
export type PerformanceSemaphore = 'green' | 'amber' | 'red' | 'none';

export interface PerformanceTargets {
  ftf_pct: number;
  sla_pct: number;
  evidence_pct: number;
  utilization_pct: number;
  attention_max_min: number;
  backlog_max: number;
}

export interface PerformanceConfig {
  version: number;
  mode: PerformanceMode;
  compare: PerformanceCompare;
  period_days: number;
  min_sample: number;
  rework_days: number;
  backlog_days: number;
  weights: {
    attention: number;
    utilization: number;
    ftf: number;
    sla: number;
    evidence: number;
    backlog: number;
  };
  targets: PerformanceTargets;
  targets_by_code: Record<string, Partial<PerformanceTargets>>;
  flags: {
    express_close_min: number;
    accept_without_start_hours: number;
    ping_pong_min: number;
    end_of_shift_min: number;
    evidence_min_pct: number;
    cherry_pick_margin: number;
    duplicate_evidence_enabled: boolean;
  };
  hours_by_code: Record<string, number>;
  shift_end_by_code: Record<string, string>;
  thresholds: { green: number; amber: number };
}

export interface TechnicianPerformanceRow {
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
  flags: {
    express_close: number;
    accept_without_start: number;
    ping_pong: number;
    duplicate_evidence: number;
    end_of_shift: number;
    cherry_pick: boolean;
    evidence_low: boolean;
  };
}

export interface PerformanceReport {
  config: PerformanceConfig;
  from: string;
  to: string;
  compare: PerformanceCompare;
  rows: TechnicianPerformanceRow[];
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

export const getPerformanceSettings = async (): Promise<{
  config: PerformanceConfig;
  updated_at: string | null;
  is_default: boolean;
}> => {
  const response = await api.get('/performance/settings');
  return response.data;
};

export const savePerformanceSettings = async (
  config: PerformanceConfig,
  devPassword: string
): Promise<{ message: string; config: PerformanceConfig }> => {
  const response = await api.put('/performance/settings', { config }, {
    headers: { 'x-dev-password': devPassword },
  });
  return response.data;
};

export const resetPerformanceSettings = async (
  devPassword: string
): Promise<{ message: string; config: PerformanceConfig }> => {
  const response = await api.post('/performance/settings/reset', {}, {
    headers: { 'x-dev-password': devPassword },
  });
  return response.data;
};

export const getTeamPerformance = async (params: {
  period?: number;
  from?: string;
  to?: string;
  compare?: PerformanceCompare;
}): Promise<PerformanceReport> => {
  const response = await api.get('/performance/team', { params, timeout: 120_000 });
  return response.data;
};

/** Previsualiza el tablero con parámetros sin guardar (solo cálculo). */
export const previewTeamPerformance = async (
  config: PerformanceConfig,
  params: { period?: number; compare?: PerformanceCompare }
): Promise<PerformanceReport> => {
  const response = await api.post('/performance/team/preview', { config, ...params }, { timeout: 120_000 });
  return response.data;
};
