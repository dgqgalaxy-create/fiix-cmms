import { useEffect, useRef } from 'react';

/**
 * Cierra la ventana/panel activo con la tecla Escape.
 *
 * Usa una pila para que, si hay paneles anidados (por ejemplo un diálogo de
 * confirmación dentro de un detalle), Escape cierre solo el de más arriba.
 * El callback se guarda en un ref para no re-registrar el listener en cada
 * render (lo que alteraría el orden de la pila).
 */
const escapeStack: symbol[] = [];

export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;

  useEffect(() => {
    if (!enabled) return;
    const id = Symbol('escape-layer');
    escapeStack.push(id);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (escapeStack[escapeStack.length - 1] !== id) return;
      event.stopPropagation();
      handlerRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      const index = escapeStack.indexOf(id);
      if (index >= 0) escapeStack.splice(index, 1);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
