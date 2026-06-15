import api from './axios';

export interface Zone {
  id: string;
  name: string;
  created_at: string;
}

export const getZones = async (): Promise<Zone[]> => {
  const response = await api.get('/zones');
  return response.data;
};

export const createZone = async (name: string): Promise<Zone> => {
  const response = await api.post('/zones', { name });
  return response.data;
};

export const deleteZone = async (id: string): Promise<void> => {
  await api.delete(`/zones/${id}`);
};
