import api from './axios';

export interface CrewMemberInfo {
  id: string;
  user_id: string;
  role_label?: string | null;
  name: string;
  email?: string;
  role?: string;
}

export interface Crew {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  zone?: { id: string; name: string } | null;
  work_orders_count: number;
  members: CrewMemberInfo[];
}

export const getCrews = async (): Promise<Crew[]> => (await api.get('/crews')).data;

export const createCrew = async (data: {
  name: string;
  description?: string | null;
  zone_id?: string | null;
  members?: string[];
}): Promise<Crew> => (await api.post('/crews', data)).data;

export const updateCrew = async (
  id: string,
  data: { name?: string; description?: string | null; zone_id?: string | null; is_active?: boolean; members?: string[] }
): Promise<Crew> => (await api.put(`/crews/${id}`, data)).data;

export const deleteCrew = async (id: string): Promise<void> => {
  await api.delete(`/crews/${id}`);
};

export const assignCrewToWorkOrder = async (
  workOrderId: string,
  crewId: string | null
): Promise<{ id: string; crew_id: string | null }> =>
  (await api.put(`/crews/assign/${workOrderId}`, { crew_id: crewId })).data;
