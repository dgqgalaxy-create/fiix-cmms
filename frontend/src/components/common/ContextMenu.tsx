import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface ContextMenuAction {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Muestra una palomita (true) o un hueco alineado (false) — para opciones tipo checkbox. */
  checked?: boolean;
  /** Dibuja un separador ANTES de este elemento. */
  separator?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  title?: string;
  actions: ContextMenuAction[];
  onClose: () => void;
  zIndex?: number;
}

/**
 * Menú contextual reutilizable (clic derecho). Se cierra con clic fuera,
 * scroll o tecla Escape. Se posiciona pegado a (x, y) y se recorta al viewport.
 */
export const ContextMenu = ({ x, y, title, actions, onClose, zIndex = 80 }: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = () => onClose();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    const onDocScroll = (ev: Event) => {
      // El scroll DENTRO del propio menú (lista larga con overflow) no debe cerrarlo.
      if (menuRef.current && ev.target instanceof Node && menuRef.current.contains(ev.target)) return;
      onClose();
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('scroll', onDocScroll, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('scroll', onDocScroll, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Recorta la posición al viewport: nunca se sale por arriba, abajo ni por los lados;
  // si el menú es más alto que la pantalla queda anclado arriba y hace scroll interno.
  const left = Math.max(8, Math.min(x, window.innerWidth - 224));
  const estimatedHeight = Math.min(actions.length * 40 + 64, Math.round(window.innerHeight * 0.7));
  const top = Math.max(8, Math.min(y, window.innerHeight - estimatedHeight));

  return (
    <div
      ref={menuRef}
      className="fixed min-w-[190px] max-w-[240px] max-h-[70vh] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl"
      style={{ left, top, zIndex }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {title && (
        <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700 truncate">
          {title}
        </div>
      )}
      {actions.map((a) => (
        <div key={a.key}>
          {a.separator && <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />}
          <button
            type="button"
            disabled={a.disabled}
            onClick={() => {
              onClose();
              a.onClick();
            }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              a.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            {a.checked !== undefined ? (
              <span className={`w-4 shrink-0 flex items-center justify-center ${a.checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`}>
                {a.checked ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-current opacity-40" />
                )}
              </span>
            ) : a.icon ? (
              <span className={`shrink-0 ${a.danger ? 'text-red-400' : 'text-slate-400'}`}>{a.icon}</span>
            ) : null}
            <span className="truncate">{a.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
};
