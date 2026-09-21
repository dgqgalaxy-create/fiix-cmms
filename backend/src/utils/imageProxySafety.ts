import dns from 'dns';
import net from 'net';

/**
 * Seguridad del proxy de imágenes (evita SSRF y descargas abusivas):
 * - Solo http/https.
 * - Bloquea hosts locales y rangos de IP privados/reservados (incluido el metadata
 *   de nube 169.254.169.254 y CGNAT de Tailscale 100.64/10).
 * - Resuelve DNS y valida TODAS las IPs del host (mitiga DNS rebinding básico).
 * - Límite de tamaño, timeout y tipo de contenido image/*.
 */

export const IMAGE_PROXY_LIMITS = {
  /** Tamaño máximo aceptado de la imagen (bytes). */
  maxBytes: 8 * 1024 * 1024,
  /** Timeout de la petición saliente (ms). */
  timeoutMs: 10_000,
  /** Redirecciones máximas (se validan una por una). */
  maxRedirects: 3,
};

/** true si la IP es privada, loopback, link-local, CGNAT o reservada. */
export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / metadata de nube
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (Tailscale)
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // multicast / reservado
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    // IPv4 mapeada (::ffff:192.168.x.x)
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true; // no es una IP válida → rechazar (no debería llegar aquí)
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

/** Valida protocolo, host y que TODAS las IPs resueltas sean públicas. */
export async function assertSafeRemoteUrl(raw: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: 'URL inválida' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: 'Solo se permiten URLs http/https' };
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, error: 'Destino no permitido' };
  }

  // IP literal
  if (net.isIP(hostname)) {
    return isPrivateIp(hostname)
      ? { ok: false, error: 'Destino no permitido (red privada)' }
      : { ok: true, url };
  }

  // Resolver DNS y comprobar todas las direcciones
  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    if (records.length === 0) return { ok: false, error: 'No se pudo resolver el host' };
    for (const rec of records) {
      if (isPrivateIp(rec.address)) return { ok: false, error: 'Destino no permitido (red privada)' };
    }
  } catch {
    return { ok: false, error: 'No se pudo resolver el host' };
  }

  return { ok: true, url };
}

/** true si el Content-Type es de imagen. */
export function isImageContentType(contentType: unknown): boolean {
  if (typeof contentType !== 'string') return false;
  return /^image\//i.test(contentType.trim());
}
