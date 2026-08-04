/* global self, clients */
/**
 * Handlers Web Push para el service worker generado por vite-plugin-pwa
 * (importado vía workbox.importScripts).
 *
 * En Android (PWA instalada) `vibrate` hace vibrar al mostrar la notificación.
 * iOS suele ignorar vibrate; ahí manda el permiso + app en Inicio.
 */
self.addEventListener('push', (event) => {
  let data = { title: 'GTZ CMMS', body: 'Nueva notificación', url: '/home', tag: 'fiix-cmms' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      const text = event.data && event.data.text();
      if (text) data.body = text;
    } catch {
      /* ignore */
    }
  }

  const title = data.title || 'GTZ CMMS';
  const url = data.url || '/home';
  const tag = data.tag || url || 'fiix-cmms';
  const options = {
    body: data.body || '',
    icon: '/icono_app.jpg',
    badge: '/icono_app.jpg',
    data: { url },
    tag,
    renotify: true,
    // Sonido del canal de notificaciones del SO (no silenciar)
    silent: false,
    // Patrón tipo chat (ms): vibra — pausa — vibra
    vibrate: Array.isArray(data.vibrate) ? data.vibrate : [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    (async () => {
      // Si la PWA ya está abierta y en primer plano, el banner in-app basta
      // (evita doble aviso: toast + notificación del sistema).
      try {
        const clientList = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        const appOpen = clientList.some((client) => {
          if (!client.url || !client.url.startsWith(self.location.origin)) return false;
          if (client.focused) return true;
          if (typeof client.visibilityState === 'string' && client.visibilityState === 'visible') {
            return true;
          }
          return false;
        });
        if (appOpen) return;
      } catch {
        /* si falla el check, mostrar push igual */
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || '/home';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return undefined;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
