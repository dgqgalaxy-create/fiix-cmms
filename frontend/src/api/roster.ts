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

export interface TechnicianShift {
  id: string;
  user_id: string;
  date: string;
  shift_code: string;
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

export interface RosterImportSummary {
  totalRows: number;
  matchedTechnicians: number;
  createdTechnicians: number;
  unmatched: string[];
  unknownCodes: string[];
  createdShifts: number;
  deletedShifts: number;
  dateStart: string | null;
  dateEnd: string | null;
}

export interface RosterResponse {
  patterns: TechnicianPattern[];
  exceptions: TechnicianException[];
  shifts: TechnicianShift[];
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

export const importRosterCalendar = async (file: File, createMissing: boolean) => {
  const form = new FormData();
  form.append('file', file);
  form.append('createMissing', String(createMissing));
  const response = await api.post('/roster/import', form, {
    timeout: 120 * 1000,
  });
  return response.data as { success: boolean; summary: RosterImportSummary; sheetName?: string };
};
