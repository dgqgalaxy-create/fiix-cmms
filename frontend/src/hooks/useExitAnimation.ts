import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Animación de salida para diálogos que se montan de forma condicional
 * (`{open && <div ...>}`), donde no hay una prop `isOpen`.
 *
 * Uso:
 *   const { closing, close } = useExitAnimation();
 *   <div className={`... ${closing ? 'dialog-closing' : 'animate-in fade-in'}`}>
 *   <button onClick={() => close(() => setOpen(false))}>Cerrar</button>
 *
 * Si el diálogo se controla con una prop `open`, pásala para que el estado de
 * cierre se reinicie al volver a abrir: `useExitAnimation(isOpen)`.
 */
export function useExitAnimation(open?: boolean, delay = 180) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const close = useCallback((done: () => void) => {
    setClosing(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setClosing(false);
      done();
    }, delay);
  }, [delay]);

  return { closing, close };
}
