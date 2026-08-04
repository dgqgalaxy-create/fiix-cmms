import api, { BACKEND_URL } from './axios';

export interface WorkOrderComment {
  id: string;
  work_order_id: string;
  author_id: string;
  author?: { id: string; name: string; role: string };
  body: string;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
}

export const listWorkOrderComments = async (workOrderId: string): Promise<WorkOrderComment[]> => {
  const res = await api.get(`/work-orders/${workOrderId}/comments`);
  return res.data;
};

export const createWorkOrderComment = async (
  workOrderId: string,
  data: { body?: string; attachment?: File | null }
): Promise<WorkOrderComment> => {
  const form = new FormData();
  if (data.body) form.append('body', data.body);
  if (data.attachment) form.append('attachment', data.attachment);
  const res = await api.post(`/work-orders/${workOrderId}/comments`, form);
  return res.data;
};

export const commentAttachmentUrl = (url?: string | null) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
};
