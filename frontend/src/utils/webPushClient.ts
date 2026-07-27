import { getVapidPublicKey, subscribePush, unsubscribePush, getPushStatus } from '../api/notifications';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushSupportInfo = {
  supported: boolean;
  reason?: string;
  permission: NotificationPermission | 'unsupported';
};

export function getPushSupportInfo(): PushSupportInfo {
  if (typeof window === 'undefined') {
    return { supported: false, reason: 'No disponible', permission: 'unsupported' };
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return {
      supported: false,
      permission: 'unsupported',
      reason: isIOS
        ? 'En iPhone/iPad instala la app en Inicio (Compartir → Añadir a pantalla de inicio) y usa iOS 16.4+.'
        : 'Este navegador no soporta notificaciones push.',
    };
  }
  return { supported: true, permission: Notification.permission };
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

/** Activa permiso + suscripción Web Push y la guarda en el servidor. */
export async function enableDevicePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  const support = getPushSupportInfo();
  if (!support.supported) {
    return { ok: false, error: support.reason || 'No soportado' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return {
      ok: false,
      error:
        permission === 'denied'
          ? 'Permiso denegado. Actívalo en la configuración del navegador o reinstala la PWA.'
          : 'No se concedió el permiso de notificaciones.',
    };
  }

  try {
    const { publicKey, configured } = await getVapidPublicKey();
    if (!configured || !publicKey) {
      return {
        ok: false,
        error: 'El servidor aún no tiene claves VAPID. Configura VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY.',
      };
    }

    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    await subscribePush(sub.toJSON(), navigator.userAgent);
    return { ok: true };
  } catch (err: any) {
    console.error(err);
    return { ok: false, error: err?.response?.data?.error || err?.message || 'Error al suscribir push' };
  }
}

/** Quita la suscripción del dispositivo actual (y del servidor). */
export async function disableDevicePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!('serviceWorker' in navigator)) return { ok: true };
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => {});
      await unsubscribePush(endpoint).catch(() => {});
    } else {
      await unsubscribePush().catch(() => {});
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al desactivar push' };
  }
}

export async function refreshPushStatus() {
  try {
    return await getPushStatus();
  } catch {
    return { configured: false, subscribed: false, devices: 0 };
  }
}
