import api from './axios';

export type MeterUnit = 'HORAS' | 'KILOMETROS' | 'CICLOS' | 'PIEZAS' | 'OTRO';
export type MeterTriggerCondition = 'GTE' | 'LTE';

export interface MeterTrigger {
  id: string;
  meter_id: string;
  name: string;
  condition: MeterTriggerCondition;
  threshold: number;
  /** Si viene, tras generar la OT el umbral pasa a lectura + interval. */
  interval: number | null;
  is_active: boolean;
  last_fired_at?: string | null;
  last_fired_value?: number | null;
  created_at: string;
}

export interface Meter {
  id: string;
  asset_id: string;
  name: string;
  unit: string;
  current_value: number;
  current_reading_at?: string | null;
  last_reading_at?: string | null;
  last_reading_value?: number | null;
  is_active: boolean;
  notes?: string | null;
  asset?: { id: string; name: string; internal_code: string };
  triggers: MeterTrigger[];
  created_at: string;
}

export interface MeterReading {
  id: string;
  meter_id: string;
  value: number;
  reading_at: string;
  notes?: string | null;
  created_by?: { id: string; name: string } | null;
  created_at: string;
}

export interface FiredWorkOrder {
  trigger_id: string;
  trigger_name: string;
  work_order_id: string;
}

export const getMeters = async (assetId?: string): Promise<Meter[]> => {
  const response = await api.get('/meters', { params: assetId ? { assetId } : undefined });
  return response.data;
};

export const createMeter = async (data: {
  asset_id: string;
  name: string;
  unit: MeterUnit;
  initial_value?: number | null;
  notes?: string;
}): Promise<Meter> => {
  const response = await api.post('/meters', data);
  return response.data;
};

export const updateMeter = async (
  id: string,
  data: { name?: string; unit?: MeterUnit; notes?: string | null; is_active?: boolean }
): Promise<Meter> => {
  const response = await api.patch(`/meters/${id}`, data);
  return response.data;
};

export const deleteMeter = async (id: string): Promise<void> => {
  await api.delete(`/meters/${id}`);
};

export const getMeterReadings = async (id: string, limit = 50): Promise<MeterReading[]> => {
  const response = await api.get(`/meters/${id}/readings`, { params: { limit } });
  return response.data;
};

export const addMeterReading = async (
  id: string,
  data: { value: number; reading_at?: string; notes?: string }
): Promise<{ reading: MeterReading; meter: Meter | null; fired_work_orders: FiredWorkOrder[] }> => {
  const response = await api.post(`/meters/${id}/readings`, data);
  return response.data;
};

export const deleteMeterReading = async (meterId: string, readingId: string): Promise<void> => {
  await api.delete(`/meters/${meterId}/readings/${readingId}`);
};

export const createMeterTrigger = async (
  meterId: string,
  data: { name: string; condition: MeterTriggerCondition; threshold: number; interval?: number | null }
): Promise<MeterTrigger> => {
  const response = await api.post(`/meters/${meterId}/triggers`, data);
  return response.data;
};

export const updateMeterTrigger = async (
  meterId: string,
  triggerId: string,
  data: {
    name?: string;
    condition?: MeterTriggerCondition;
    threshold?: number;
    interval?: number | null;
    is_active?: boolean;
  }
): Promise<MeterTrigger> => {
  const response = await api.patch(`/meters/${meterId}/triggers/${triggerId}`, data);
  return response.data;
};

export const deleteMeterTrigger = async (meterId: string, triggerId: string): Promise<void> => {
  await api.delete(`/meters/${meterId}/triggers/${triggerId}`);
};
