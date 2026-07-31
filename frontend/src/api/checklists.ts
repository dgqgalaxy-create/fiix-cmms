import api from './axios';

export type ChecklistFieldType = 'CHECKBOX' | 'NUMBER' | 'TEXT';

export interface ChecklistRow {
  id: string;
  activity_name: string;
  order: number;
  field_type?: ChecklistFieldType;
  line_statuses?: Record<string, string | null>;
  /** @deprecated legacy keys kept optional for older payloads */
  L1_status?: string | null;
  L2_status?: string | null;
  L3_status?: string | null;
  L4_status?: string | null;
  L5_status?: string | null;
  observations: string | null;
}

export interface ChecklistTransfer {
  id: string;
  checklist_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  note?: string | null;
  created_at: string;
  resolved_at?: string | null;
  from_user?: { id: string; name: string };
  to_user?: { id: string; name: string };
}

export interface DailyChecklist {
  id: string;
  date: string;
  status: 'DRAFT' | 'COMPLETED' | 'REVIEWED';
  column_count?: number;
  technician_id?: string | null;
  technician?: { name: string } | null;
  leader_id?: string;
  leader?: { name: string };
  rows?: ChecklistRow[];
  pending_transfer?: ChecklistTransfer | null;
}

export interface ChecklistConfig {
  column_count: number;
  min: number;
  max: number;
}

export const getTodayChecklist = async () => {
  const response = await api.get('/checklists/today');
  return response.data;
};

export const createTodayChecklist = async () => {
  const response = await api.post('/checklists/today');
  return response.data;
};

export const startChecklist = async (id: string) => {
  const response = await api.post(`/checklists/${id}/start`);
  return response.data;
};

export const transferChecklist = async (id: string, to_user_id: string, note?: string) => {
  const response = await api.post(`/checklists/${id}/transfer`, { to_user_id, note });
  return response.data as ChecklistTransfer;
};

export const acceptChecklistTransfer = async (transferId: string) => {
  const response = await api.post(`/checklists/transfers/${transferId}/accept`);
  return response.data as DailyChecklist;
};

export const rejectChecklistTransfer = async (transferId: string) => {
  const response = await api.post(`/checklists/transfers/${transferId}/reject`);
  return response.data as DailyChecklist;
};

export const cancelChecklistTransfer = async (transferId: string) => {
  const response = await api.post(`/checklists/transfers/${transferId}/cancel`);
  return response.data as DailyChecklist;
};

export const updateChecklistRow = async (
  rowId: string,
  data: {
    observations?: string | null;
    line?: number;
    status?: string | null;
    line_statuses?: Record<string, string | null>;
  }
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

export const getChecklistConfig = async (): Promise<ChecklistConfig> => {
  const response = await api.get('/checklists/config');
  return response.data;
};

export const updateChecklistConfig = async (column_count: number): Promise<ChecklistConfig> => {
  const response = await api.put('/checklists/config', { column_count });
  return response.data;
};

// ==============================
// CATÁLOGO DE ACTIVIDADES
// ==============================

export interface ChecklistActivity {
  id: string;
  name: string;
  order: number;
  field_type: ChecklistFieldType;
  is_active: boolean;
}

export const getChecklistActivities = async (): Promise<ChecklistActivity[]> => {
  const response = await api.get('/checklists/activities');
  return response.data;
};

export const createChecklistActivity = async (data: { name: string; field_type?: ChecklistFieldType; is_active?: boolean }) => {
  const response = await api.post('/checklists/activities', data);
  return response.data;
};

export const updateChecklistActivity = async (id: string, data: { name?: string; field_type?: ChecklistFieldType; is_active?: boolean }) => {
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

export const getRowLineStatus = (row: ChecklistRow, line: number): string => {
  const key = String(line);
  if (row.line_statuses && key in row.line_statuses) {
    const value = row.line_statuses[key];
    // null/undefined = celda vacía (p. ej. ciclo OK→FAIL→NA→vacío); no debe pasar validación
    return value == null ? '' : String(value);
  }
  const legacy = (row as any)[`L${line}_status`];
  return legacy == null ? '' : String(legacy);
};
