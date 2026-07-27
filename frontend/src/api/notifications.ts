import api from './axios';

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
};

export type PushStatus = {
  configured: boolean;
  subscribed: boolean;
  devices: number;
};

export const getVapidPublicKey = async (): Promise<{ publicKey: string; configured: boolean }> => {
  const res = await api.get('/notifications/vapid-public-key');
  return res.data;
};

export const getPushStatus = async (): Promise<PushStatus> => {
  const res = await api.get('/notifications/push/status');
  return res.data;
};

export const subscribePush = async (subscription: PushSubscriptionJSON, userAgent?: string) => {
  const res = await api.post('/notifications/push/subscribe', {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    user_agent: userAgent,
  });
  return res.data;
};

export const unsubscribePush = async (endpoint?: string) => {
  const res = await api.delete('/notifications/push/unsubscribe', {
    data: endpoint ? { endpoint } : {},
  });
  return res.data;
};
