import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

type InfoTipProps = {
  /** Texto de ayuda (misma idea que el title del hover en PC). */
  text: string;
  /** Etiqueta accesible del botón ⓘ */
  label?: string;
  className?: string;
  /** Tamaño del icono */
  size?: number;
};

type TipPlacement = {
  top: number;
  left: number;
  placement: 'above' | 'below';
  arrowLeft: number;
};

const TIP_MAX_W = 256;
const GAP = 8;
const PAD = 8;
const Z_TIP = 10000;

/**
 * Ayuda táctil: en tablet/móvil no hay hover, así que se muestra un ⓘ
 * que al tocar abre el mensaje; en PC también funciona al hacer clic.
 * El diálogo se renderiza en portal (por encima de modales/overflow) y se
 * reubica si se sale del viewport.
 */
export function InfoTip({ text, label = 'Más información', className = '', size = 14 }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<TipPlacement | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipId = useId();

  const updatePlacement = useCallback(() => {
    const btn = buttonRef.current;
    const tip = tipRef.current;
    if (!btn || !tip) return;

    const anchor = btn.getBoundingClientRect();
    const tipW = tip.offsetWidth || Math.min(TIP_MAX_W, window.innerWidth - PAD * 2);
    const tipH = tip.offsetHeight || 64;

    let left = anchor.left + anchor.width / 2 - tipW / 2;
    left = Math.max(PAD, Math.min(left, window.innerWidth - tipW - PAD));

    const spaceAbove = anchor.top - PAD;
    const spaceBelow = window.innerHeight - anchor.bottom - PAD;
    const need = tipH + GAP;

    let place: 'above' | 'below' =
      spaceAbove >= need || (spaceAbove >= spaceBelow && spaceAbove >= 40) ? 'above' : 'below';

    let top: number;
    if (place === 'above') {
      top = anchor.top - GAP - tipH;
      if (top < PAD) {
        if (spaceBelow >= need) {
          place = 'below';
          top = anchor.bottom + GAP;
        } else {
          top = PAD;
        }
      }
    } else {
      top = anchor.bottom + GAP;
      if (top + tipH > window.innerHeight - PAD) {
        if (spaceAbove >= need) {
          place = 'above';
          top = anchor.top - GAP - tipH;
        } else {
          top = Math.max(PAD, window.innerHeight - tipH - PAD);
        }
      }
    }

    const arrowLeft = Math.max(12, Math.min(anchor.left + anchor.width / 2 - left, tipW - 12));
    setPlacement({ top, left, placement: place, arrowLeft });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    // Segunda pasada tras pintar (altura real del texto).
    const id = requestAnimationFrame(() => updatePlacement());
    return () => cancelAnimationFrame(id);
  }, [open, text, updatePlacement]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (tipRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onReposition = () => updatePlacement();

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePlacement]);

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tipId}
        title={text}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
      >
        <Info size={size} strokeWidth={2.25} aria-hidden />
      </button>
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
            className="rounded-lg border border-slate-200 bg-slate-900 px-2.5 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
          >
            {text}
            <span
              aria-hidden
              className={
                placement?.placement === 'below'
                  ? 'absolute bottom-full h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-slate-900 dark:border-b-slate-800'
                  : 'absolute top-full h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-slate-900 dark:border-t-slate-800'
              }
              style={{ left: placement?.arrowLeft ?? 24, transform: 'translateX(-50%)' }}
            />
          </div>,
          document.body
        )}
    </span>
  );
}
