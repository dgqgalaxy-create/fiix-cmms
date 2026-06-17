import api from './axios';

export interface KPIMetric {
  value: number;
  goal: {
    targetValue: number;
    unit: string;
  };
}

export interface KPIResponse {
  totalOrders: number;
  metrics: {
    COMPLETED_MONTHLY: KPIMetric;
    MTTR: KPIMetric;
    RESPONSE_TIME: KPIMetric;
    SLA: KPIMetric;
    BACKLOG: KPIMetric;
    ASSET_AVAILABILITY: KPIMetric;
  };
}

export const getKPIs = async (period?: string): Promise<KPIResponse> => {
  const query = period ? `?period=${period}` : '';
  const response = await api.get(`/kpis${query}`);
  return response.data;
};

export const updateKPIGoals = async (goals: { metricKey: string; targetValue: number; unit?: string }[]): Promise<void> => {
  await api.post('/kpis/goals', { goals });
};

export interface ChartData {
  month: string;
  costos: number;
  mttr: number;
  mtbf: number;
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
}

export const getAssetFailureOrders = async (assetId: string, period?: string): Promise<FailureOrder[]> => {
  const query = period ? `?period=${period}` : '';
  const response = await api.get(`/kpis/top-failures/${assetId}/orders${query}`);
  return response.data;
};
