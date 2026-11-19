import api from './axios';

export interface WorkloadRow {
  user_id: string;
  name: string;
  role: string;
  shift_code: string | null;
  open_wos: number;
  in_progress: number;
  overdue: number;
  due_this_period: number;
  urgent: number;
  scheduled_hours: number;
  per_day: Array<{ date: string; count: number }>;
  title_samples: Array<{ id: string; folio: number; title: string; priority: string }>;
  load_pct: number;
  load_level: 'alta' | 'media' | 'baja';
}

export interface WorkloadResponse {
  from: string;
  to: string;
  days: number;
  zone_ids: string[];
  rows: WorkloadRow[];
  totals: {
    open_wos: number;
    unassigned: number;
    overdue: number;
    technicians: number;
    avg_open: number;
  };
  suggestion: { user_id: string; name: string; open_wos: number; reason: string } | null;
}

export const getWorkload = async (params: { days?: number; zoneIds?: string[] }): Promise<WorkloadResponse> => {
  const response = await api.get('/workload', {
    params: {
      days: params.days,
      zoneIds: params.zoneIds && params.zoneIds.length > 0 ? params.zoneIds.join(',') : undefined,
    },
  });
  return response.data;
};
