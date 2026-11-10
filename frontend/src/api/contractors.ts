import api from './axios';

export interface Contractor {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  hourly_rate: number | null;
  visit_rate: number | null;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
  is_active: boolean;
  work_orders_count?: number;
}

export const getContractors = async (): Promise<Contractor[]> => (await api.get('/contractors')).data;

export const createContractor = async (data: Partial<Contractor>): Promise<Contractor> =>
  (await api.post('/contractors', data)).data;

export const updateContractor = async (id: string, data: Partial<Contractor>): Promise<Contractor> =>
  (await api.put(`/contractors/${id}`, data)).data;

export const deleteContractor = async (id: string): Promise<{ detached_orders: number }> =>
  (await api.delete(`/contractors/${id}`)).data;
