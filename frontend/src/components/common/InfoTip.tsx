import { useEffect, useId, useRef, useState } from 'react';
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

/**
 * Ayuda táctil: en tablet/móvil no hay hover, así que se muestra un ⓘ
 * que al tocar abre el mensaje; en PC también funciona al hacer clic.
 */
export function InfoTip({ text, label = 'Más información', className = '', size = 14 }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex align-middle ${className}`}>
      <button
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
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute z-[120] bottom-[calc(100%+6px)] left-1/2 w-[min(16rem,70vw)] -translate-x-1/2 rounded-lg border border-slate-200 bg-slate-900 px-2.5 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {text}
          <span
            aria-hidden
            className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-slate-900 dark:border-t-slate-800"
          />
        </span>
      )}
    </span>
  );
}
