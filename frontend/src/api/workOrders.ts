import api from './axios';

export interface WorkOrder {
  id: string;
  title: string;
  description?: string;
  status: 'PENDIENTE' | 'EN_PROCESO' | 'EN_ESPERA' | 'FINALIZADO';
  hold_reason?: string;
  asset: {
    id: string;
    name: string;
  };
  created_by: {
    id: string;
    name: string;
  };
  assigned_to?: {
    id: string;
    name: string;
  };
  created_at: string;
  updated_at: string;
  paused_at?: string;
  completed_at?: string;
  before_image_url?: string;
  after_image_url?: string;
}

export const getWorkOrders = async (): Promise<WorkOrder[]> => {
  const response = await api.get('/work-orders');
  return response.data;
};

export const createWorkOrder = async (data: { title: string; description?: string; asset_id: string; assigned_to_id?: string }) => {
  const response = await api.post('/work-orders', data);
  return response.data;
};

export const updateWorkOrder = async (id: string, data: any) => {
  if (data.before_image || data.after_image) {
    const formData = new FormData();
    if (data.status) formData.append('status', data.status);
    if (data.hold_reason) formData.append('hold_reason', data.hold_reason);
    if (data.resolution_notes) formData.append('resolution_notes', data.resolution_notes);
    if (data.before_image) formData.append('before_image', data.before_image);
    if (data.after_image) formData.append('after_image', data.after_image);

    const response = await api.patch(`/work-orders/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  } else {
    const response = await api.patch(`/work-orders/${id}`, data);
    return response.data;
  }
};
