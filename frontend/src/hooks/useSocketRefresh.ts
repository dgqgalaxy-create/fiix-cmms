import { useEffect, useRef } from 'react';
import { socket } from '../api/socket';

/**
 * Escucha uno o varios eventos de socket y ejecuta refetch en background.
 * Debounce por defecto 400 ms para evitar tormentas de refetch multi-usuario.
 */
export function useSocketRefresh(
  events: string | string[],
  refetch: () => void | Promise<void>,
  enabled = true,
  debounceMs = 400
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!enabled) return;
    const list = Array.isArray(events) ? events : [events];
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refetchRef.current();
      }, Math.max(0, debounceMs));
    };

    for (const event of list) {
      socket.on(event, handler);
    }
    return () => {
      if (timer) clearTimeout(timer);
      for (const event of list) {
        socket.off(event, handler);
      }
    };
  }, [enabled, debounceMs, Array.isArray(events) ? events.join('|') : events]);
}
