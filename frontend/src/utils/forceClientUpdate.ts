/**
 * Fuerza que el navegador tome el frontend recién desplegado.
 * Un location.reload() suave sigue pasando por el service worker y puede
 * devolver index.html / JS precacheados (APP_VERSION vieja).
 */
export async function forceClientUpdate(deployedVersion?: string): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }

  const v = (deployedVersion || '').trim() || String(Date.now());
  const url = new URL(window.location.href);
  url.searchParams.set('_fiix_v', `${v}-${Date.now()}`);
  window.location.replace(url.toString());
}
