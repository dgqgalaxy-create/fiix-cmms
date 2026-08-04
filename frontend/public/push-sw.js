/* global self, clients */
/**
 * Handlers Web Push para el service worker generado por vite-plugin-pwa
 * (importado vía workbox.importScripts).
 *
 * Vibración:
 * - `vibrate` en showNotification: Android moderno a menudo lo ignora (manda el canal del SO).
 * - Si hay una pestaña/PWA en segundo plano, pedimos vibrar con postMessage + navigator.vibrate.
 * - Con la app totalmente cerrada, el usuario debe tener «Vibrar» activo en
 *   Ajustes → Apps → [GTZ CMMS o Chrome] → Notificaciones.
 */
var DEFAULT_VIBRATE = [400, 120, 400, 120, 400];

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
  const vibrate = Array.isArray(data.vibrate) && data.vibrate.length > 0 ? data.vibrate : DEFAULT_VIBRATE;
  const options = {
    body: data.body || '',
    icon: '/icono_app.jpg',
    badge: '/icono_app.jpg',
    data: { url, vibrate },
    tag,
    renotify: true,
    // Misma etiqueta → Windows/Chrome reemplaza en lugar de apilar duplicados
    silent: false,
    vibrate,
    timestamp: Date.now(),
  };

  event.waitUntil(
    (async () => {
      try {
        const clientList = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        const appFocused = clientList.some((client) => {
          if (!client.url || !client.url.startsWith(self.location.origin)) return false;
          if (client.focused) return true;
          if (typeof client.visibilityState === 'string' && client.visibilityState === 'visible') {
            return true;
          }
          return false;
        });
        // Primer plano: banner in-app (y su propia vibración)
        if (appFocused) return;

        // App en segundo plano (aún hay cliente): forzar vibración vía página
        for (const client of clientList) {
          if (client.url && client.url.startsWith(self.location.origin)) {
            try {
              client.postMessage({ type: 'fiix-vibrate', pattern: vibrate });
            } catch {
              /* ignore */
            }
          }
        }
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
