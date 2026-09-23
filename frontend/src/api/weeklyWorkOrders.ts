import api, { bareAxios, BACKEND_URL } from './axios';
export type WeeklyOrder = {
  id: string; folio: number; title: string; status: string;
  zone_id: string | null; zone_name: string; asset_name: string;
  created_at: string; completed_at: string | null; scheduled_date: string | null; due_date: string | null;
  hold_reason: string | null; technicians: string; deleted?: boolean;
  original_due_date?: string | null; original_scheduled_date?: string | null; original_zone_name?: string; program_zone_name?: string;
};
export type WeeklyCategory = 'program' | 'completed' | 'pending' | 'inProgress' | 'paused' | 'cancelled' | 'deleted' | 'overdue' | 'additions' | 'rescheduled' | 'incoming' | 'carryover' | 'backlog' | 'backlogOverdue' | 'allCompleted';
export type WeeklyReport = {
  week: string; lastDay: string; currentWeek: string; hasData: boolean; preview: boolean;
  capturedAt: string | null; selectedCutId: string | null;
  plan: { capturedAt: string; lateStart: boolean } | null;
  cuts: { id: string; day: string; capturedAt: string; source: string }[];
  zones: { id: string; name: string }[];
  daily: { day: string; cutId: string | null; capturedAt: string | null; closed: number | null; cumulative: number | null; programCompleted: number | null; compliance: number | null }[];
  counts: Record<WeeklyCategory, number>; compliance: number | null;
  details: Record<WeeklyCategory, WeeklyOrder[]>;
};
export async function getWeeklyReport(week: string, zoneIds: string[], cutId: string, signal?: AbortSignal): Promise<WeeklyReport> {
  return (await api.get('/work-orders/weekly', { params: { week, zoneIds: zoneIds.join(',') || undefined, cutId: cutId || undefined }, signal })).data;
}
// Un corte debe registrar el instante solicitado, nunca reproducirse desde la cola offline.
async function saveNow(path: string, week: string) {
  if (!navigator.onLine) throw new Error('Se necesita conexión para guardar el corte actual.');
  return bareAxios.post(`${BACKEND_URL}/api/work-orders/weekly/${path}`, { week }, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
  });
}
export async function freezeWeeklyPlan(week: string) { await saveNow('plan', week); }
export async function saveWeeklyCut(week: string): Promise<{ id: string }> { return (await saveNow('cuts', week)).data; }
