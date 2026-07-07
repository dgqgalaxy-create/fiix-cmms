import api from './axios';

export interface TechnicianPattern {
  id: string;
  user_id: string;
  pattern_type: string;
  start_date: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export interface TechnicianException {
  id: string;
  user_id: string;
  date: string;
  exception_type: string;
  notes?: string;
  user: {
    id: string;
    name: string;
  };
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
}

export interface RosterResponse {
  patterns: TechnicianPattern[];
  exceptions: TechnicianException[];
  technicians: { id: string; name: string; role: string }[];
  holidays: Holiday[];
}

export const getRoster = async (start: string, end: string): Promise<RosterResponse> => {
  const response = await api.get('/roster', { params: { start, end } });
  return response.data;
};

export const assignPattern = async (data: { user_id: string; pattern_type: string; start_date: string }) => {
  const response = await api.post('/roster/pattern', data);
  return response.data;
};

export const addException = async (data: { user_id: string; date: string; exception_type: string; notes?: string }) => {
  const response = await api.post('/roster/exception', data);
  return response.data;
};

export const removeException = async (id: string) => {
  const response = await api.delete(`/roster/exception/${id}`);
  return response.data;
};
