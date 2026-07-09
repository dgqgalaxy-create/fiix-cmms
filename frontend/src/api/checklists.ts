import api from './axios';

export interface ChecklistRow {
  id: string;
  activity_name: string;
  order: number;
  L1_status: string | null;
  L2_status: string | null;
  L3_status: string | null;
  L4_status: string | null;
  L5_status: string | null;
  observations: string | null;
}

export interface DailyChecklist {
  id: string;
  date: string;
  status: 'DRAFT' | 'COMPLETED' | 'REVIEWED';
  technician_id: string;
  technician?: { name: string };
  leader_id?: string;
  leader?: { name: string };
  rows?: ChecklistRow[];
}

export const getTodayChecklist = async () => {
  const response = await api.get('/checklists/today');
  return response.data;
};

export const createTodayChecklist = async () => {
  const response = await api.post('/checklists/today');
  return response.data;
};

export const updateChecklistRow = async (
  rowId: string, 
  data: Partial<ChecklistRow>
) => {
  const response = await api.put(`/checklists/row/${rowId}`, data);
  return response.data;
};

export const submitChecklist = async (id: string) => {
  const response = await api.post(`/checklists/${id}/submit`);
  return response.data;
};

export const reviewChecklist = async (id: string) => {
  const response = await api.post(`/checklists/${id}/review`);
  return response.data;
};

export const getChecklistHistory = async () => {
  const response = await api.get('/checklists/history');
  return response.data;
};

export const getChecklistById = async (id: string) => {
  const response = await api.get(`/checklists/${id}`);
  return response.data;
};

// ==============================
// CATÁLOGO DE ACTIVIDADES
// ==============================

export interface ChecklistActivity {
  id: string;
  name: string;
  order: number;
  is_active: boolean;
}

export const getChecklistActivities = async (): Promise<ChecklistActivity[]> => {
  const response = await api.get('/checklists/activities');
  return response.data;
};

export const createChecklistActivity = async (data: { name: string; is_active?: boolean }) => {
  const response = await api.post('/checklists/activities', data);
  return response.data;
};

export const updateChecklistActivity = async (id: string, data: { name?: string; is_active?: boolean }) => {
  const response = await api.put(`/checklists/activities/${id}`, data);
  return response.data;
};

export const deleteChecklistActivity = async (id: string) => {
  const response = await api.delete(`/checklists/activities/${id}`);
  return response.data;
};

export const reorderChecklistActivities = async (orderedIds: { id: string; order: number }[]) => {
  const response = await api.put('/checklists/activities/reorder', { orderedIds });
  return response.data;
};

export const restoreDefaultChecklistActivities = async () => {
  const response = await api.post(`/checklists/activities/restore-defaults`);
  return response.data;
};
