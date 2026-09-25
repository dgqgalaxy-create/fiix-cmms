import api from './axios';

export interface PersonalNote {
  id: string;
  user_id: string;
  title: string;
  body?: string | null;
  remind_at?: string | null;
  reminded_at?: string | null;
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export type TaskPriority = 'NORMAL' | 'ALTA';
export type TaskScope = 'mine' | 'assigned' | 'created';

export interface OperationalTask {
  id: string;
  title: string;
  body?: string | null;
  created_by_id: string;
  assignee_id: string;
  work_order_id?: string | null;
  asset_id?: string | null;
  due_at?: string | null;
  reminded_at?: string | null;
  priority?: TaskPriority;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  completed_at?: string | null;
  completion_note?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: { id: string; name: string };
  assignee?: { id: string; name: string };
  work_order?: { id: string; folio: number; title: string } | null;
  asset?: { id: string; name: string; internal_code: string } | null;
}

export interface NotesSummary {
  open_notes: number;
  open_tasks_assigned: number;
  open_tasks_created: number;
  unread_announcements: number;
  open_total: number;
}

export interface GlobalAnnouncement {
  id: string;
  title: string;
  body?: string | null;
  image_url?: string | null;
  created_by_id: string;
  created_by?: { id: string; name: string };
  is_active: boolean;
  created_at: string;
  updated_at: string;
  seen_by_me: boolean;
  seen_count: number;
  audience_count: number;
  readers?: { id: string; name: string; role: string; seen_at: string }[];
}

export type SnoozeMode = '1h' | 'tomorrow';

export const getNotesSummary = async (signal?: AbortSignal): Promise<NotesSummary> => {
  const res = await api.get('/notes/summary', { signal });
  return res.data;
};

export const listAnnouncements = async (includeInactive = false): Promise<GlobalAnnouncement[]> => {
  const res = await api.get('/notes/announcements', {
    params: includeInactive ? { include_inactive: '1' } : undefined,
  });
  return res.data;
};

export const createAnnouncement = async (data: {
  title: string;
  body?: string;
  image?: File | null;
}): Promise<GlobalAnnouncement> => {
  const form = new FormData();
  form.append('title', data.title);
  if (data.body) form.append('body', data.body);
  if (data.image) form.append('image', data.image);
  const res = await api.post('/notes/announcements', form);
  return res.data;
};

export const markAnnouncementSeen = async (id: string): Promise<void> => {
  await api.post(`/notes/announcements/${id}/seen`);
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
  await api.delete(`/notes/announcements/${id}`);
};

export const listPersonalNotes = async (includeDone = false): Promise<PersonalNote[]> => {
  const res = await api.get('/notes/personal', {
    params: includeDone ? { include_done: '1' } : undefined,
  });
  return res.data;
};

export const createPersonalNote = async (data: {
  content: string;
}): Promise<PersonalNote> => {
  const res = await api.post('/notes/personal', data);
  return res.data;
};

export const updatePersonalNote = async (
  id: string,
  data: Partial<{ content: string; is_done: boolean }>
): Promise<PersonalNote> => {
  const res = await api.put(`/notes/personal/${id}`, data);
  return res.data;
};

export const deletePersonalNote = async (id: string): Promise<void> => {
  await api.delete(`/notes/personal/${id}`);
};

export const listOperationalTasks = async (
  includeDone = false,
  scope: TaskScope = 'mine'
): Promise<OperationalTask[]> => {
  const res = await api.get('/notes/tasks', {
    params: {
      ...(includeDone ? { include_done: '1' } : {}),
      scope,
    },
  });
  return res.data;
};

export const createOperationalTask = async (data: {
  title: string;
  body?: string;
  assignee_id?: string;
  due_at?: string | null;
  folio?: number | string;
  work_order_id?: string;
  asset_code?: string;
  asset_id?: string;
  priority?: TaskPriority;
}): Promise<OperationalTask> => {
  const res = await api.post('/notes/tasks', data);
  return res.data;
};

export const updateOperationalTask = async (
  id: string,
  data: Partial<{
    title: string;
    body: string | null;
    due_at: string | null;
    assignee_id: string;
    priority: TaskPriority;
    status: 'OPEN' | 'DONE' | 'CANCELLED';
    completion_note: string | null;
    work_order_id: string | null;
    asset_id: string | null;
  }>
): Promise<OperationalTask> => {
  const res = await api.put(`/notes/tasks/${id}`, data);
  return res.data;
};

export const snoozeOperationalTask = async (
  id: string,
  mode: SnoozeMode
): Promise<OperationalTask> => {
  const res = await api.post(`/notes/tasks/${id}/snooze`, { mode });
  return res.data;
};

export const deleteOperationalTask = async (id: string): Promise<void> => {
  await api.delete(`/notes/tasks/${id}`);
};

export interface NotesSearchHit {
  assets: { id: string; name: string; internal_code: string }[];
  work_orders: { id: string; folio: number; title: string }[];
}

export const searchNotesLinks = async (q: string): Promise<NotesSearchHit> => {
  const res = await api.get('/search', { params: { q } });
  return {
    assets: Array.isArray(res.data?.assets) ? res.data.assets : [],
    work_orders: Array.isArray(res.data?.work_orders) ? res.data.work_orders : [],
  };
};
