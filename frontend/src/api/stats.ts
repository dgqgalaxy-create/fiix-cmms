import api from './axios';

export interface AgingBucket {
  key: string;
  label: string;
  count: number;
}

export interface AgingOrder {
  id: string;
  folio: number;
  title: string;
  status: string;
  priority: string;
  days: number;
  created_at: string;
  scheduled_date?: string | null;
  asset?: { id: string; name: string; internal_code: string } | null;
  technicians?: { id: string; name: string }[];
}

export interface AgingResponse {
  total: number;
  buckets: AgingBucket[];
  oldest: AgingOrder[];
  orders: AgingOrder[];
}

export interface ConsumptionItem {
  id: string;
  name: string;
  internal_code: string;
  uom: string;
  category: string | null;
  quantity: number;
  cost: number;
  movements: number;
}

export interface ConsumptionResponse {
  from: string;
  to: string;
  total_cost: number;
  total_quantity: number;
  items: ConsumptionItem[];
  categories: { category: string; quantity: number; cost: number }[];
}

export interface ReliabilityRow {
  asset: { id: string; name: string; internal_code: string; is_critical?: boolean };
  stops: number;
  failures: number;
  downtime_hours: number;
  mtbf_hours: number | null;
  mttr_hours: number | null;
  availability_pct: number;
}

export interface ReliabilityResponse {
  from: string;
  to: string;
  assets: ReliabilityRow[];
}

export interface CostOrder {
  id: string;
  folio: number;
  title: string;
  status: string;
  maintenance_type: string;
  asset?: { id: string; name: string; internal_code: string } | null;
  hours: number;
  average_rate: number;
  labor_cost: number;
  parts_cost: number;
  total_cost: number;
  technicians: string[];
  created_at: string;
  completed_at?: string | null;
}

export interface CostsResponse {
  from: string;
  to: string;
  totals: { labor: number; parts: number; total: number; orders: number; hours: number };
  orders: CostOrder[];
  assets: { asset: { id: string; name: string; internal_code: string }; labor: number; parts: number; total: number; orders: number }[];
}

const rangeParams = (from?: string, to?: string) => ({
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
});

export const getStatsAging = async (): Promise<AgingResponse> =>
  (await api.get('/stats/aging')).data;

export const getStatsConsumption = async (from?: string, to?: string): Promise<ConsumptionResponse> =>
  (await api.get('/stats/consumption', { params: rangeParams(from, to) })).data;

export const getStatsReliability = async (from?: string, to?: string): Promise<ReliabilityResponse> =>
  (await api.get('/stats/reliability', { params: rangeParams(from, to) })).data;

export const getStatsCosts = async (from?: string, to?: string): Promise<CostsResponse> =>
  (await api.get('/stats/costs', { params: rangeParams(from, to) })).data;
