/**
 * Orígenes permitidos para CORS / Socket.IO.
 * CORS_ORIGINS / ALLOWED_ORIGINS añade orígenes extra; no quita localhost, LAN ni *.ts.net.
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
  if (configured.some((o) => o === origin || o === '*')) {
    return true;
  }

  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host === 'lpet-cmms' || host.endsWith('.ts.net')) return true;
    // Misma máquina en LAN (CasaOS / IP privada) o CGNAT Tailscale (100.x)
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|100\.)/.test(host)) return true;
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
