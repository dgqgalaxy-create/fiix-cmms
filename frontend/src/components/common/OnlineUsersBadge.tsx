import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Users } from 'lucide-react';
import { getOnlineUsers } from '../../api/users';
import type { User } from '../../api/users';
import { pathToModuleLabel } from '../../utils/moduleLabels';

export const OnlineUsersBadge = () => {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [panelPosition, setPanelPosition] = useState({ left: 0, top: 0, width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const margin = 8;
      const viewportHeight = window.innerHeight;
      const viewportWidth = document.documentElement.clientWidth;
      const above = Math.max(0, rect.top - margin * 2);
      const below = Math.max(0, viewportHeight - rect.bottom - margin * 2);
      const openAbove = above >= below;
      const height = Math.min(320, openAbove ? above : below);
      const width = Math.min(rect.width, viewportWidth - margin * 2);
      setPanelPosition({
        left: Math.max(margin, Math.min(rect.left, viewportWidth - width - margin)),
        top: openAbove ? rect.top - margin - height : rect.bottom + margin,
        width,
        height,
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const users = await getOnlineUsers();
      setOnlineUsers(users);
    } catch (error) {
      console.error('Error fetching online users:', error);
    }
  }, []);

  useEffect(() => {
    void fetchOnlineUsers();
    const interval = setInterval(() => void fetchOnlineUsers(), 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchOnlineUsers();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [fetchOnlineUsers]);

  return (
    <div className="relative mb-2">
      <button
        ref={buttonRef}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) void fetchOnlineUsers();
        }}
        className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors text-xs font-medium text-slate-300"
      >
        <div className="flex items-center gap-1.5">
          <Users size={14} />
          <span>Usuarios en línea</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold text-emerald-400">{onlineUsers.length}</span>
        </div>
      </button>

      {isOpen && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="region"
          aria-label="Usuarios activos ahora"
          style={panelPosition}
          className="fixed flex flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-[60]"
        >
          <div className="shrink-0 p-2 border-b border-slate-700 bg-slate-900/50">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
              Activos ahora
            </p>
          </div>
          <div tabIndex={0}
            aria-label="Lista de usuarios en línea"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-1">
            {onlineUsers.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">Nadie en línea</div>
            ) : (
              onlineUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 font-medium truncate">{u.name}</p>
                    <p className="text-[10px] text-emerald-400/90 truncate">
                      {pathToModuleLabel(u.current_path)}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase truncate">{u.role}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 ml-2"></div>
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
