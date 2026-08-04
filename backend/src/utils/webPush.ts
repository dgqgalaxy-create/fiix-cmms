import webpush from 'web-push';
import prisma from '../config/prisma';

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  /** Agrupa / renotify en el dispositivo (p. ej. chat-{conversationId}). */
  tag?: string;
  /** Patrón de vibración Android (ms). */
  vibrate?: number[];
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

/**
 * Clase de dispositivo para no mandar el mismo push 2 veces
 * (p. ej. Chrome ventana + PWA instalada en el mismo Windows).
 */
export function pushDeviceClass(userAgent: string | null | undefined): string {
  const ua = userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Mac OS|Macintosh/i.test(ua)) return 'mac';
  if (/Linux/i.test(ua)) return 'linux';
  return 'other';
}

type SubRow = {
  id: string;
  endpoint: string;
  user_agent: string | null;
  updated_at: Date;
  created_at: Date;
};

/** Una suscripción por clase de dispositivo (la más reciente). */
export function pickLatestSubPerDevice<T extends SubRow>(subs: T[]): T[] {
  const best = new Map<string, T>();
  for (const s of subs) {
    const key = pushDeviceClass(s.user_agent);
    const prev = best.get(key);
    const sTime = new Date(s.updated_at || s.created_at).getTime();
    const pTime = prev ? new Date(prev.updated_at || prev.created_at).getTime() : 0;
    if (!prev || sTime >= pTime) best.set(key, s);
  }
  return Array.from(best.values());
}

/** Al suscribir: quita otras suscripciones del mismo usuario/dispositivo. */
export async function pruneDuplicatePushSubsForDevice(
  userId: string,
  keepEndpoint: string,
  userAgent: string | null
): Promise<number> {
  const device = pushDeviceClass(userAgent);
  const all = await prisma.pushSubscription.findMany({
    where: { user_id: userId },
    select: { id: true, endpoint: true, user_agent: true },
  });
  const ids = all
    .filter((s) => s.endpoint !== keepEndpoint && pushDeviceClass(s.user_agent) === device)
    .map((s) => s.id);
  if (ids.length === 0) return 0;
  const result = await prisma.pushSubscription.deleteMany({ where: { id: { in: ids } } });
  return result.count;
}

/** Envía Web Push a todas las suscripciones del usuario; limpia endpoints inválidos. */
export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload
): Promise<{ sent: number; removed: number }> {
  if (!ensureVapid()) {
    return { sent: 0, removed: 0 };
  }

  const allSubs = await prisma.pushSubscription.findMany({ where: { user_id: userId } });
  if (allSubs.length === 0) return { sent: 0, removed: 0 };

  const subs = pickLatestSubPerDevice(allSubs);
  const keepIds = new Set(subs.map((s) => s.id));
  const staleIds = allSubs.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } }).catch(() => {});
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/home',
    tag: payload.tag || payload.url || 'fiix-cmms',
    vibrate: payload.vibrate || [400, 120, 400, 120, 400],
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
          body,
          {
            TTL: 120,
            urgency: 'high',
          }
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
