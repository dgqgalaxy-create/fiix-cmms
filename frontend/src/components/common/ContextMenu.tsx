import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ContextMenuAction {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
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
  useEffect(() => {
    const onDocClick = () => onClose();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('scroll', onDocClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('scroll', onDocClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - 208);
  const top = Math.min(y, window.innerHeight - (actions.length * 40 + 64));

  return (
    <div
      className="fixed min-w-[190px] max-w-[240px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
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
        <button
          key={a.key}
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
          {a.icon && <span className={`shrink-0 ${a.danger ? 'text-red-400' : 'text-slate-400'}`}>{a.icon}</span>}
          <span className="truncate">{a.label}</span>
        </button>
      ))}
    </div>
  );
};
