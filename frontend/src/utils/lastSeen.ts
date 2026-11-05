/**
 * Texto de «última conexión» para las tarjetas de Personal.
 * `last_active` lo actualiza el heartbeat de la app (cada 30 s) y la conexión socket.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Texto corto para la tarjeta (se muestra bajo el turno). */
export function formatLastSeen(value?: string | null, now: number = Date.now()): string {
  const at = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(at)) return 'Sin conexiones registradas';

  const diff = Math.max(0, now - at);
  if (diff < MINUTE) return 'Última conexión: ahora';

  const minutes = Math.floor(diff / MINUTE);
  if (minutes < 60) return `Última conexión: hace ${minutes} min`;

  const hours = Math.floor(diff / HOUR);
  if (hours < 24) return `Última conexión: hace ${hours} h`;

  const days = Math.floor(diff / DAY);
  if (days < 7) return `Última conexión: hace ${days} d`;

  const date = new Date(at).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `Última conexión: ${date}`;
}

/** Fecha y hora exactas para el tooltip. */
export function formatLastSeenExact(value?: string | null): string {
  const at = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(at)) return 'Sin conexiones registradas';
  return new Date(at).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
