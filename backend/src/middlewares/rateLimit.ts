import type { Request, Response, NextFunction, RequestHandler } from 'express';

type Bucket = { count: number; resetAt: number };

/**
 * Rate limit en memoria (por proceso). Suficiente para un solo PM2 fiix-backend.
 * Clave por IP (+ opcional sufijo, p. ej. email en login).
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  /** Mensaje JSON de error */
  message?: string;
  /** Extra key material (p. ej. body.email) */
  keyFn?: (req: Request) => string;
}): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const message = options.message || 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';

  // Limpieza periódica para no crecer sin límite
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, Math.min(options.windowMs, 60_000));
  if (typeof sweep.unref === 'function') sweep.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.socket.remoteAddress ||
      'unknown';
    const extra = options.keyFn?.(req) || '';
    const key = `${ip}|${extra}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      res.status(429).json({ error: message, retryAfterSeconds: retrySec });
      return;
    }
    next();
  };
}
