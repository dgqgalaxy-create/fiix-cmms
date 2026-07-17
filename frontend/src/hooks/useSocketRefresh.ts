import { useEffect, useRef } from 'react';
import { socket } from '../api/socket';

/**
 * Escucha uno o varios eventos de socket y ejecuta refetch en background.
 * Evita suscripciones duplicadas si el callback cambia identidad.
 */
export function useSocketRefresh(
  events: string | string[],
  refetch: () => void | Promise<void>,
  enabled = true
) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!enabled) return;
    const list = Array.isArray(events) ? events : [events];

    const handler = () => {
      void refetchRef.current();
    };

    for (const event of list) {
      socket.on(event, handler);
    }
    return () => {
      for (const event of list) {
        socket.off(event, handler);
      }
    };
  }, [enabled, Array.isArray(events) ? events.join('|') : events]);
}
