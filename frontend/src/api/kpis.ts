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

export const getKPIs = async (): Promise<KPIResponse> => {
  const { data } = await api.get('/kpis');
  return data;
};

export const updateKPIGoals = async (goals: { metricKey: string; targetValue: number; unit: string }[]): Promise<void> => {
  await api.put('/kpis/goals', { goals });
};

export interface ChartData {
  month: string;
  costos: number;
  mttr: number;
  mtbf: number;
}

export const getChartData = async (): Promise<ChartData[]> => {
  const { data } = await api.get('/kpis/charts');
  return data;
};
