import api from './axios';

export interface KPIMetric {
  value: number;
  goal: {
    targetValue: number;
    unit: string;
  };
  details?: Array<{ id: string; name: string; count: number }>;
  sampleSize?: number;
  isNull?: boolean;
}

export interface KPIResponse {
  totalOrders: number;
  reworkWindowDays?: number;
  period?: {
    start: string;
    end: string;
  };
  metrics: {
    COMPLETED_MONTHLY: KPIMetric;
    MTTR: KPIMetric;
    RESPONSE_TIME: KPIMetric;
    SLA: KPIMetric;
    BACKLOG: KPIMetric;
    ASSET_AVAILABILITY: KPIMetric;
    REINCIDENCIA: KPIMetric;
  };
}

export const getKPIs = async (period?: string, reworkDays?: number): Promise<KPIResponse> => {
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  if (reworkDays !== undefined) params.set('reworkDays', String(reworkDays));
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get(`/kpis${query}`);
  return response.data;
};

export const updateKPIGoals = async (
  goals: { metricKey: string; targetValue: number; unit?: string }[],
): Promise<void> => {
  await api.put('/kpis/goals', { goals });
};

export interface ChartData {
  month: string;
  costos: number;
  mttr: number;
  mtbf: number;
  mtbfSample?: number;
}

export const getChartData = async (period?: string): Promise<ChartData[]> => {
  const query = period ? `?period=${period}` : '';
  const response = await api.get(`/kpis/charts${query}`);
  return response.data;
};

export interface AssetCostData {
  assetId: string;
  assetName: string;
  totalCost: number;
}

export const getCostsByAsset = async (period?: string): Promise<AssetCostData[]> => {
  const query = period ? `?period=${period}` : '';
  const response = await api.get(`/kpis/costs-by-asset${query}`);
  return response.data;
};

export interface TopFailingAsset {
  assetId: string;
  assetName: string;
  count: number;
}

export const getTopFailingAssets = async (period?: string): Promise<TopFailingAsset[]> => {
  const query = period ? `?period=${period}` : '';
  const response = await api.get(`/kpis/top-failures${query}`);
  return response.data;
};

export interface FailureOrder {
  id: string;
  folio: number;
  title: string;
  created_at: string;
  status: string;
  accumulated_time_ms: number;
  zone?: { name: string } | null;
  assigned_technicians?: { name: string }[];
}

export const getAssetFailureOrders = async (assetId: string, period?: string): Promise<FailureOrder[]> => {
  const query = period ? `?period=${period}` : '';
  const response = await api.get(`/kpis/top-failures/${assetId}/orders${query}`);
  return response.data;
};

export interface TechnicianPerformance {
  id: string;
  name: string;
  Finalizadas: number;
  EnProceso: number;
  Pendientes: number;
  Total: number;
}

export const getTechnicianPerformance = async (period?: string): Promise<TechnicianPerformance[]> => {
  const query = period ? `?period=${period}` : '';
  const response = await api.get(`/kpis/technician-performance${query}`);
  return response.data;
};
