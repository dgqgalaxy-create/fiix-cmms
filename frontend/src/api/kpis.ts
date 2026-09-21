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
  missingCount?: number;
  methodology?: string;
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

export type KpiPeriodQuery = {
  period?: string;
  startDate?: string;
  endDate?: string;
  reworkDays?: number;
};

const buildKpiQuery = (params: KpiPeriodQuery = {}): string => {
  const q = new URLSearchParams();
  if (params.period) q.set('period', params.period);
  if (params.period === 'CUSTOM') {
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
  }
  if (params.reworkDays !== undefined) q.set('reworkDays', String(params.reworkDays));
  const s = q.toString();
  return s ? `?${s}` : '';
};

export const getKPIs = async (
  periodOrQuery?: string | KpiPeriodQuery,
  reworkDays?: number,
): Promise<KPIResponse> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery, reworkDays };
  const response = await api.get(`/kpis${buildKpiQuery(params)}`);
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
  mtbfAssumptionHoursPerDay?: number;
  mtbfEstimated?: boolean;
}

export const getChartData = async (periodOrQuery?: string | KpiPeriodQuery): Promise<ChartData[]> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery };
  const response = await api.get(`/kpis/charts${buildKpiQuery(params)}`);
  return response.data;
};

export interface AssetCostData {
  assetId: string;
  assetName: string;
  totalCost: number;
}

export const getCostsByAsset = async (periodOrQuery?: string | KpiPeriodQuery): Promise<AssetCostData[]> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery };
  const response = await api.get(`/kpis/costs-by-asset${buildKpiQuery(params)}`);
  return response.data;
};

export interface TopFailingAsset {
  assetId: string;
  assetName: string;
  count: number;
}

export const getTopFailingAssets = async (
  periodOrQuery?: string | KpiPeriodQuery,
): Promise<TopFailingAsset[]> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery };
  const response = await api.get(`/kpis/top-failures${buildKpiQuery(params)}`);
  return response.data;
};

export interface FailureOrder {
  id: string;
  folio: number;
  title: string;
  created_at: string;
  status: string;
  machine_stopped?: boolean;
  accumulated_time_ms: number;
  zone?: { name: string } | null;
  assigned_technicians?: { name: string }[];
}

export const getAssetFailureOrders = async (
  assetId: string,
  periodOrQuery?: string | KpiPeriodQuery,
  machineStoppedOnly = false,
): Promise<FailureOrder[]> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery };
  const base = `/kpis/top-failures/${assetId}/orders${buildKpiQuery(params)}`;
  const sep = buildKpiQuery(params) ? '&' : '?';
  const response = await api.get(`${base}${machineStoppedOnly ? `${sep}machineStopped=1` : ''}`);
  return response.data;
};

export interface TechnicianPerformance {
  id: string;
  name: string;
  Finalizadas: number;
  EnProceso: number;
  Pendientes: number;
  Pausadas: number;
  Total: number;
  /** Órdenes abiertas asignadas (carga operativa del día). */
  CargaHoy: number;
  /** Horas acumuladas en EN_ESPERA (reloj actual). */
  TiempoEsperaHoras: number;
  /** Órdenes finalizadas en la semana calendario (lun–dom). */
  FinalizadasSemana: number;
  /** Horas de mano de obra (accumulated_time_ms) de OTs cerradas esta semana. */
  HorasLaborSemana: number;
  /** Horas de labor (sin pausas) de OT finalizadas en el periodo del filtro. */
  HorasLaborPeriodo?: number;
  /** Promedio de horas de labor por OT finalizada en el periodo. */
  TiempoPromedioHoras?: number;
}

export const getTechnicianPerformance = async (
  periodOrQuery?: string | KpiPeriodQuery,
): Promise<TechnicianPerformance[]> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery };
  const response = await api.get(`/kpis/technician-performance${buildKpiQuery(params)}`);
  return response.data;
};

export interface LineMttrMtbf {
  line: string;
  /** Paros correctivos (machine_stopped) creados en el periodo. */
  failures: number;
  /** MTTR en horas (promedio de tiempo de reparación de paros finalizados). null sin muestra. */
  mttrHours: number | null;
  mttrSample: number;
  /** MTBF en horas = horas operativas / fallas. null sin fallas en el periodo. */
  mtbfHours: number | null;
  /** Activos OPERATIVOS de la línea. */
  assets: number;
  operationalHours: number;
}

export interface LineMttrMtbfResponse {
  period: { start: string; end: string };
  days: number;
  hoursPerDay: number;
  lines: LineMttrMtbf[];
}

export const getMttrMtbfByLine = async (
  periodOrQuery?: string | KpiPeriodQuery,
): Promise<LineMttrMtbfResponse> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery };
  const response = await api.get(`/kpis/by-line${buildKpiQuery(params)}`);
  return response.data;
};

export interface LineAssetMttrMtbf {
  id: string;
  name: string;
  internalCode: string;
  status: string;
  /** Paros correctivos (machine_stopped) del equipo creados en el periodo. */
  failures: number;
  mttrHours: number | null;
  /** MTBF del equipo = horas operativas (si está OPERATIVO) / fallas. null sin fallas o no operativo. */
  mtbfHours: number | null;
  operationalHours: number;
}

export interface LineAssetsMttrMtbfResponse {
  line: string;
  period: { start: string; end: string };
  days: number;
  hoursPerDay: number;
  assets: LineAssetMttrMtbf[];
}

export const getLineAssetsMttrMtbf = async (
  line: string,
  periodOrQuery?: string | KpiPeriodQuery,
): Promise<LineAssetsMttrMtbfResponse> => {
  const params: KpiPeriodQuery =
    typeof periodOrQuery === 'object' && periodOrQuery
      ? periodOrQuery
      : { period: periodOrQuery };
  const response = await api.get(`/kpis/by-line/${encodeURIComponent(line)}/assets${buildKpiQuery(params)}`);
  return response.data;
};

export interface ResponseTimeZonesConfig {
  /** null = se miden todas las zonas. */
  zoneIds: string[] | null;
}

export const getResponseTimeZones = async (): Promise<ResponseTimeZonesConfig> => {
  const response = await api.get('/kpis/response-time-zones');
  return response.data;
};

export const updateResponseTimeZones = async (zoneIds: string[]): Promise<ResponseTimeZonesConfig> => {
  const response = await api.put('/kpis/response-time-zones', { zoneIds });
  return response.data;
};
