import api from './axios';
import type { QtyMode } from '../utils/qtyMode';

export interface UnitOfMeasure {
  id: string;
  name: string;
  is_active: boolean;
  default_qty_mode?: QtyMode;
}

export const getUoms = async (): Promise<UnitOfMeasure[]> => {
  const response = await api.get('/settings/uom');
  return response.data;
};

export const createUom = async (
  name: string,
  default_qty_mode: QtyMode = 'INTEGER'
): Promise<UnitOfMeasure> => {
  const response = await api.post('/settings/uom', { name, default_qty_mode });
  return response.data;
};

export const deleteUom = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/settings/uom/${id}`);
  return response.data;
};
