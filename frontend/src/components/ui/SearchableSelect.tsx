import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  disabled?: boolean;
  /** Texto cuando no hay valor seleccionado */
  placeholder?: string;
  /** Permite opción vacía (value '') al inicio de la lista */
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  id?: string;
  title?: string;
};

type MenuPos = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

/**
 * Desplegable con filtro por texto (combobox).
 * El menú se renderiza en portal con altura adaptada al espacio disponible en pantalla
 * (no queda recortado por overflow de modales).
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = 'Seleccionar…',
  allowEmpty = false,
  emptyLabel = '— Sin seleccionar —',
  className = '',
  inputClassName = '',
  required = false,
  id,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const allOptions = useMemo(() => {
    if (!allowEmpty) return options;
    return [{ value: '', label: emptyLabel }, ...options];
  }, [allowEmpty, emptyLabel, options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [allOptions, query]);

  const updateMenuPos = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(140, Math.min(360, available));
    setMenuPos({
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + gap }
        : { top: rect.bottom + gap }),
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onReposition = () => updateMenuPos();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, filtered.length, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      setQuery('');
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openList = () => {
    if (disabled) return;
    setQuery('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const showLabel = open ? query : selected?.label || (value === '' && allowEmpty ? emptyLabel : '');

  const menu =
    open && !disabled && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              top: menuPos.top,
              bottom: menuPos.bottom,
              zIndex: 200,
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto custom-scrollbar"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                Sin coincidencias
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value || '__empty'}
                  type="button"
                  className={`w-full text-left px-4 py-2.5 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-emerald-50 dark:hover:bg-slate-800 ${
                    o.value === value
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/30 font-semibold text-emerald-800 dark:text-emerald-300'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          required={required && !value}
          title={title}
          placeholder={placeholder}
          value={showLabel}
          autoComplete="off"
          onFocus={openList}
          onClick={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setQuery('');
              inputRef.current?.blur();
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const first = filtered[0];
              if (first) pick(first.value);
            }
          }}
          className={
            inputClassName ||
            'w-full px-4 py-2.5 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800'
          }
        />
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
      {menu}
    </div>
  );
}
