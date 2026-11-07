import api from './axios';

export interface AssetDowntime {
  id: string;
  asset_id: string;
  work_order_id?: string | null;
  reason?: string | null;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  reported_by?: { id: string; name: string } | null;
  work_order?: { id: string; folio: number; title: string } | null;
  asset?: { id: string; name: string; internal_code: string } | null;
}

export interface DowntimeStats {
  from: string;
  to: string;
  stops: number;
  open_stops: number;
  downtime_hours: number;
  mtbf_hours: number | null;
  mttr_minutes: number | null;
  availability_pct: number | null;
}

export const getDowntimes = async (params?: {
  assetId?: string;
  from?: string;
  to?: string;
  open?: boolean;
}): Promise<AssetDowntime[]> => {
  const response = await api.get('/downtimes', {
    params: {
      ...params,
      open: params?.open ? 1 : undefined,
    },
  });
  return response.data;
};

export const createDowntime = async (data: {
  asset_id: string;
  reason?: string;
  started_at?: string;
  work_order_id?: string;
}): Promise<AssetDowntime> => {
  const response = await api.post('/downtimes', data);
  return response.data;
};

export const closeDowntime = async (id: string, ended_at?: string): Promise<AssetDowntime> => {
  const response = await api.patch(`/downtimes/${id}/close`, ended_at ? { ended_at } : {});
  return response.data;
};

export const updateDowntime = async (
  id: string,
  data: { reason?: string; started_at?: string; ended_at?: string | null; work_order_id?: string | null }
): Promise<AssetDowntime> => {
  const response = await api.patch(`/downtimes/${id}`, data);
  return response.data;
};

export const deleteDowntime = async (id: string): Promise<void> => {
  await api.delete(`/downtimes/${id}`);
};

export const getDowntimeStats = async (params?: {
  assetId?: string;
  from?: string;
  to?: string;
}): Promise<DowntimeStats> => {
  const response = await api.get('/downtimes/stats', { params });
  return response.data;
};
