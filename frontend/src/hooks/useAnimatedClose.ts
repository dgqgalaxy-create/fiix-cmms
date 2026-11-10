import { useCallback, useEffect, useState } from 'react';

/**
 * Cierre con animación de salida para paneles y modales.
 *
 * Devuelve `closing` (para aplicar las clases de salida) y `requestClose`,
 * que anima y luego llama al `onClose` real. Úsalo también en el botón X,
 * el fondo y la tecla Escape para que el cierre sea uniforme.
 */
export function useAnimatedClose(onClose: () => void, isOpen: boolean, delay = 190) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (isOpen) setClosing(false);
  }, [isOpen]);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, delay);
  }, [onClose, delay]);

  return { closing, requestClose };
}
