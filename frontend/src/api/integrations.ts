import api from './axios';

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  created_by?: { name: string } | null;
}

export interface WebhookDeliveryRow {
  id: string;
  event: string;
  status: number | null;
  ok: boolean;
  error: string | null;
  created_at: string;
}

export interface WebhookRow {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  is_active: boolean;
  last_status: number | null;
  last_error: string | null;
  last_sent_at: string | null;
  created_at: string;
  deliveries: WebhookDeliveryRow[];
}

export const WEBHOOK_EVENTS: { value: string; label: string }[] = [
  { value: 'work_order.created', label: 'Orden creada' },
  { value: 'work_order.updated', label: 'Orden actualizada' },
  { value: 'work_order.comment', label: 'Comentario en orden' },
];

export const getApiKeys = async (): Promise<ApiKeyRow[]> => (await api.get('/integrations/keys')).data;

export const createApiKey = async (data: {
  name: string;
  scopes: string[];
  expires_in_days?: number;
}): Promise<{ id: string; name: string; key: string; prefix: string; scopes: string[] }> =>
  (await api.post('/integrations/keys', data)).data;

export const revokeApiKey = async (id: string): Promise<void> => {
  await api.delete(`/integrations/keys/${id}`);
};

export const getWebhooks = async (): Promise<WebhookRow[]> => (await api.get('/integrations/webhooks')).data;

export const createWebhook = async (data: {
  url: string;
  description?: string;
  events: string[];
}): Promise<WebhookRow & { secret: string }> => (await api.post('/integrations/webhooks', data)).data;

export const updateWebhook = async (
  id: string,
  data: { url?: string; description?: string | null; events?: string[]; is_active?: boolean }
): Promise<WebhookRow> => (await api.put(`/integrations/webhooks/${id}`, data)).data;

export const deleteWebhook = async (id: string): Promise<void> => {
  await api.delete(`/integrations/webhooks/${id}`);
};

export const testWebhook = async (id: string): Promise<{ ok: boolean; status: number | null; error: string | null }> =>
  (await api.post(`/integrations/webhooks/${id}/test`)).data;
