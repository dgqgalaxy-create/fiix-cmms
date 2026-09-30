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
  start_time?: string | null;
  end_time?: string | null;
  paid_minutes?: number | null;
  time_debt_id?: string | null;
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

export const addException = async (data: { user_id: string; date: string; exception_type: string; notes?: string; start_time?: string; end_time?: string; time_debt_id?: string }) => {
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


export interface TimeDebt {
  id: string;
  user_id: string;
  date: string;
  total_minutes: number;
  paid_minutes: number;
  remaining_minutes: number;
  notes?: string;
  payments: TechnicianException[];
}
export const getTimeDebts = async (): Promise<TimeDebt[]> => (await api.get('/roster/time-debts')).data;
export const createTimeDebt = async (data: { user_id: string; date: string; total_minutes: number; notes?: string }) => (await api.post('/roster/time-debts', data)).data;
