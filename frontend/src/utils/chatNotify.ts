/** Vibración corta tipo chat (Android / algunos navegadores). */
export function vibrateChatAlert() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([180, 70, 180]);
    }
  } catch {
    /* ignore */
  }
}

type IncomingChatNotifyOpts = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

/**
 * Aviso de sistema cuando la PWA está en segundo plano (pestaña oculta)
 * pero el socket aún entregó el mensaje. Complementa Web Push.
 */
export async function showIncomingChatSystemNotification(opts: IncomingChatNotifyOpts) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  // En primer plano el banner in-app basta; evitar doble aviso
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }

  const options: NotificationOptions & { vibrate?: number[] } = {
    body: opts.body,
    icon: '/icono_app.jpg',
    badge: '/icono_app.jpg',
    tag: opts.tag,
    renotify: true,
    data: { url: opts.url },
    vibrate: [200, 100, 200],
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(opts.title, options);
      return;
    }
  } catch {
    /* fallback abajo */
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(opts.title, options);
  } catch {
    /* ignore */
  }
}
