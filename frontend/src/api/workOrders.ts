import api, { BACKEND_URL } from './axios';
import { addOfflineRequest } from '../utils/offlineQueue';
import {
  putOfflinePhotoBlob,
  type OfflineMultipartBody,
} from '../utils/offlinePhotoQueue';

export interface WorkOrder {
  id: string;
  folio: number;
  title: string;
  description?: string;
  status: 'PENDIENTE' | 'EN_PROCESO' | 'EN_ESPERA' | 'FINALIZADO' | 'ANULADO';
  hold_reason?: string;
  asset: {
    id: string;
    name: string;
    internal_code?: string;
  };
  zone_id?: string;
  zone?: {
    id: string;
    name: string;
  };
  priority: 'URGENTE' | 'NORMAL' | 'BAJO';
  maintenance_type: 'SERVICIO' | 'PREVENTIVO' | 'CORRECTIVO';
  machine_stopped: boolean;
  requester_name?: string;
  production_group: 'A' | 'B' | 'C' | 'D' | 'NA';
  created_by: {
    id: string;
    name: string;
  };
  assigned_technicians?: {
    id: string;
    name: string;
  }[];
  created_at: string;
  updated_at: string;
  started_at?: string;
  paused_at?: string;
  last_resumed_at?: string;
  accumulated_time_ms?: number;
  completed_at?: string;
  scheduled_date?: string;
  due_date?: string;
  request_image_url?: string;
  before_image_url?: string;
  after_image_url?: string;
  signature_clean_area?: string;
  signature_delivery?: string;
  resolution_notes?: string;
  maintenance_plan_id?: string;
  sla?: {
    overall: 'OK' | 'RISK' | 'BREACHED' | 'N/A';
    response: 'OK' | 'RISK' | 'BREACHED' | 'N/A';
    hold: 'OK' | 'RISK' | 'BREACHED' | 'N/A';
    resolution: 'OK' | 'RISK' | 'BREACHED' | 'N/A';
    elapsed?: {
      response_h: number | null;
      hold_h: number | null;
      resolution_h: number | null;
    };
  };
  inventory_transactions?: Array<{
    id: string;
    amount: number;
    unit_cost?: number | null;
    reason: string;
    item: {
      id: string;
      name: string;
      internal_code: string;
      uom: string;
      purchase_cost?: number | null;
    };
  }>;
  parts_cost_total?: number;
}

export const getWorkOrders = async (): Promise<WorkOrder[]> => {
  const response = await api.get('/work-orders');
  return response.data;
};

export const getWorkOrderById = async (id: string): Promise<WorkOrder> => {
  const response = await api.get(`/work-orders/${id}`);
  return response.data;
};

export const getWorkOrdersSummary = async (startDate?: string, endDate?: string): Promise<Record<string, number>> => {
  let url = '/work-orders/summary';
  if (startDate && endDate) {
    url += `?startDate=${startDate}&endDate=${endDate}`;
  }
  const response = await api.get(url);
  return response.data;
};

export const getUniqueRequesters = async (): Promise<string[]> => {
  const response = await api.get('/work-orders/requesters');
  return response.data;
};

export const createWorkOrder = async (data: any) => {
  const response = await api.post('/work-orders', data);
  return response.data;
};

/** Encola PATCH multipart con fotos en IndexedDB (blobs + metadatos). */
async function queueOfflineWorkOrderWithPhotos(id: string, data: any) {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const files: OfflineMultipartBody['files'] = [];
  const fields: Record<string, string> = {};

  if (data.status) fields.status = String(data.status);
  if (data.hold_reason) fields.hold_reason = String(data.hold_reason);
  if (data.resolution_notes) fields.resolution_notes = String(data.resolution_notes);
  if (data.signature_clean_area) fields.signature_clean_area = String(data.signature_clean_area);
  if (data.signature_delivery) fields.signature_delivery = String(data.signature_delivery);
  if (data.used_items) fields.used_items = JSON.stringify(data.used_items);
  if (data.failure_problem_id) fields.failure_problem_id = String(data.failure_problem_id);
  if (data.failure_cause_id) fields.failure_cause_id = String(data.failure_cause_id);
  if (data.failure_remedy_id) fields.failure_remedy_id = String(data.failure_remedy_id);
  if (data.assigned_technicians_ids !== undefined) {
    fields.assigned_technicians_ids = JSON.stringify(data.assigned_technicians_ids);
  }

  if (data.before_image instanceof Blob) {
    const key = `wo-${id}-before-${stamp}`;
    const name = (data.before_image as File).name || 'before.jpg';
    const type = data.before_image.type || 'image/jpeg';
    await putOfflinePhotoBlob(key, data.before_image, name, type);
    files.push({ field: 'before_image', blobKey: key, name, type });
  }
  if (data.after_image instanceof Blob) {
    const key = `wo-${id}-after-${stamp}`;
    const name = (data.after_image as File).name || 'after.jpg';
    const type = data.after_image.type || 'image/jpeg';
    await putOfflinePhotoBlob(key, data.after_image, name, type);
    files.push({ field: 'after_image', blobKey: key, name, type });
  }

  const body: OfflineMultipartBody = {
    __fiixMultipart: true,
    fields,
    files,
  };

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  await addOfflineRequest(`${BACKEND_URL}/api/work-orders/${id}`, 'PATCH', headers, body);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('fiix-offline-sync-done'));
  }
}

export const updateWorkOrder = async (id: string, data: any) => {
  const hasImages = !!(data.before_image || data.after_image);

  // Sin conexión: guarda estado + fotos en IndexedDB y sincroniza al volver la señal.
  if (hasImages && !navigator.onLine) {
    await queueOfflineWorkOrderWithPhotos(id, data);
    return { success: true, offline: true, offline_images_queued: true };
  }

  if (hasImages) {
    const formData = new FormData();
    if (data.status) formData.append('status', data.status);
    if (data.hold_reason) formData.append('hold_reason', data.hold_reason);
    if (data.resolution_notes) formData.append('resolution_notes', data.resolution_notes);
    if (data.signature_clean_area) formData.append('signature_clean_area', data.signature_clean_area);
    if (data.signature_delivery) formData.append('signature_delivery', data.signature_delivery);
    if (data.before_image) formData.append('before_image', data.before_image);
    if (data.after_image) formData.append('after_image', data.after_image);
    if (data.used_items) formData.append('used_items', JSON.stringify(data.used_items));
    if (data.failure_problem_id) formData.append('failure_problem_id', data.failure_problem_id);
    if (data.failure_cause_id) formData.append('failure_cause_id', data.failure_cause_id);
    if (data.failure_remedy_id) formData.append('failure_remedy_id', data.failure_remedy_id);
    if (data.assigned_technicians_ids !== undefined) {
      formData.append('assigned_technicians_ids', JSON.stringify(data.assigned_technicians_ids));
    }

    const response = await api.patch(`/work-orders/${id}`, formData);
    return response.data;
  } else {
    const response = await api.patch(`/work-orders/${id}`, data);
    return response.data;
  }
};

export const deleteWorkOrder = async (id: string) => {
  const response = await api.delete(`/work-orders/${id}`);
  return response.data;
};

export const joinWorkOrder = async (id: string) => {
  const response = await api.post(`/work-orders/${id}/join`);
  return response.data;
};
