import webpush from 'web-push';
import prisma from '../config/prisma';

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
};

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = (process.env.VAPID_SUBJECT || 'mailto:mantenimiento@localhost').trim();
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  const key = (process.env.VAPID_PUBLIC_KEY || '').trim();
  return key || null;
}

export function isWebPushConfigured(): boolean {
  return Boolean((process.env.VAPID_PUBLIC_KEY || '').trim() && (process.env.VAPID_PRIVATE_KEY || '').trim());
}

/** Envía Web Push a todas las suscripciones del usuario; limpia endpoints inválidos. */
export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload
): Promise<{ sent: number; removed: number }> {
  if (!ensureVapid()) {
    return { sent: 0, removed: 0 };
  }

  const subs = await prisma.pushSubscription.findMany({ where: { user_id: userId } });
  if (subs.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/home',
  });

  let sent = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
        sent += 1;
      } catch (err: any) {
        const status = err?.statusCode || err?.status;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          removed += 1;
        } else {
          console.error('Web Push error:', status || err?.message || err);
        }
      }
    })
  );

  return { sent, removed };
}

export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0 || !isWebPushConfigured()) return;
  await Promise.all(unique.map((id) => sendWebPushToUser(id, payload)));
}
