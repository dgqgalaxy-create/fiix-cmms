import api from './axios';

export interface Requester {
  id: string;
  name: string;
  email?: string | null;
  department?: string | null;
  created_at: string;
}

export const getRequesters = async (): Promise<Requester[]> => {
  const response = await api.get('/requesters');
  return response.data;
};

export const createRequester = async (data: Partial<Requester>): Promise<Requester> => {
  const response = await api.post('/requesters', data);
  return response.data;
};

export const updateRequester = async (id: string, data: Partial<Requester>): Promise<Requester> => {
  const response = await api.put(`/requesters/${id}`, data);
  return response.data;
};

export const deleteRequester = async (id: string): Promise<void> => {
  await api.delete(`/requesters/${id}`);
};

export const migrateRequesters = async (): Promise<{ message: string, count: number }> => {
  const response = await api.post('/requesters/migrate');
  return response.data;
};
