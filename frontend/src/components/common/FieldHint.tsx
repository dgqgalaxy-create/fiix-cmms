import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type FieldHintProps = {
  /** Descripción del parámetro; se muestra al pasar el puntero o al tocar. */
  text: string;
  children: ReactNode;
  className?: string;
};

const TIP_MAX_W = 280;
const GAP = 8;
const PAD = 8;
const Z_TIP = 10001;

type Placement = { top: number; left: number; below: boolean; arrow: number };

/**
 * Etiqueta con ayuda emergente.
 *
 * - Escritorio: aparece al posicionar el puntero sobre el nombre (y también con foco de teclado).
 * - Táctil: se abre al tocar y se cierra al tocar fuera.
 * - `title` queda como respaldo nativo del navegador.
 */
export function FieldHint({ text, children, className = '' }: FieldHintProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const tipId = useId();

  const updatePlacement = useCallback(() => {
    const anchor = anchorRef.current;
    const tip = tipRef.current;
    if (!anchor || !tip) return;

    const rect = anchor.getBoundingClientRect();
    const width = tip.offsetWidth || TIP_MAX_W;
    const height = tip.offsetHeight || 64;

    const left = Math.max(PAD, Math.min(rect.left, window.innerWidth - width - PAD));
    const roomBelow = window.innerHeight - rect.bottom - PAD;
    const roomAbove = rect.top - PAD;
    const below = roomBelow >= height + GAP || roomAbove < height + GAP;
    const top = below ? rect.bottom + GAP : rect.top - GAP - height;
    const arrow = Math.max(12, Math.min(rect.left + rect.width / 2 - left, width - 12));

    setPlacement({ top, left, below, arrow });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    const id = requestAnimationFrame(() => updatePlacement());
    return () => cancelAnimationFrame(id);
  }, [open, text, updatePlacement]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const reposition = () => updatePlacement();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updatePlacement]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    []
  );

  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <span
        ref={anchorRef}
        role="note"
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        title={text}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
        onClick={(event) => {
          // Solo en pantallas táctiles (sin hover) el toque alterna la ayuda;
          // en escritorio el clic sigue enfocando el campo como cualquier etiqueta.
          const touchOnly =
            typeof window !== 'undefined' && !window.matchMedia('(hover: hover)').matches;
          if (!touchOnly) return;
          event.preventDefault();
          setOpen((value) => !value);
        }}
        className="cursor-help border-b border-dotted border-slate-300 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-slate-600"
      >
        {children}
      </span>

      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={{
              position: 'fixed',
              top: placement?.top ?? -9999,
              left: placement?.left ?? 0,
              zIndex: Z_TIP,
              width: `min(${TIP_MAX_W}px, calc(100vw - ${PAD * 2}px))`,
              opacity: placement ? 1 : 0,
              pointerEvents: placement ? 'auto' : 'none',
            }}
            className="rounded-lg border border-slate-200 bg-slate-900 px-2.5 py-2 text-left text-[11.5px] font-normal normal-case leading-snug tracking-normal text-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
          >
            {text}
            <span
              aria-hidden
              className={
                placement?.below
                  ? 'absolute bottom-full h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-slate-900 dark:border-b-slate-800'
                  : 'absolute top-full h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-slate-900 dark:border-t-slate-800'
              }
              style={{ left: placement?.arrow ?? 24, transform: 'translateX(-50%)' }}
            />
          </div>,
          document.body
        )}
    </span>
  );
}
