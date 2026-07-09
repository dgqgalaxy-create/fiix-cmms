import api from './axios';

export interface UnitOfMeasure {
  id: string;
  name: string;
  is_active: boolean;
}

export const getUoms = async (): Promise<UnitOfMeasure[]> => {
  const response = await api.get('/settings/uom');
  return response.data;
};

export const createUom = async (name: string): Promise<UnitOfMeasure> => {
  const response = await api.post('/settings/uom', { name });
  return response.data;
};

export const deleteUom = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/settings/uom/${id}`);
  return response.data;
};
