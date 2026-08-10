/**
 * Orígenes permitidos para CORS / Socket.IO.
 * Configura CORS_ORIGINS="http://a,http://b" en .env (recomendado en producción).
 * Si no hay lista, se permiten localhost, hostname local y *.ts.net (Tailscale).
 */
export function parseAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // same-origin / curl / server-to-server
  const configured = parseAllowedOrigins();
  if (configured.length > 0) {
    return configured.some((o) => o === origin || o === '*');
  }

  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host === 'lpet-cmms' || host.endsWith('.ts.net')) return true;
    // Misma máquina en LAN (CasaOS / IP privada)
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (isAllowedOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS: origen no permitido (${origin})`));
}
