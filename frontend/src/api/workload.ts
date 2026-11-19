import api from './axios';

export interface WorkloadOrder {
  id: string;
  folio: number;
  title: string;
  status: 'PENDIENTE' | 'EN_PROCESO' | 'EN_ESPERA' | 'FINALIZADO' | 'ANULADO';
  priority: 'URGENTE' | 'NORMAL' | 'BAJO';
  asset_name: string | null;
  zone_name: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  created_at: string;
  overdue: boolean;
}

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
  /** Órdenes abiertas del técnico, ordenadas por prioridad y fecha límite. */
  orders: WorkloadOrder[];
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
