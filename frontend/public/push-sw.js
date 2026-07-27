/* global self, clients */
/**
 * Handlers Web Push para el service worker generado por vite-plugin-pwa
 * (importado vía workbox.importScripts).
 */
self.addEventListener('push', (event) => {
  let data = { title: 'LPET CMMS', body: 'Nueva notificación', url: '/home' };
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

  const title = data.title || 'LPET CMMS';
  const options = {
    body: data.body || '',
    icon: '/icono_app.jpg',
    badge: '/icono_app.jpg',
    data: { url: data.url || '/home' },
    tag: data.url || 'fiix-cmms',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
