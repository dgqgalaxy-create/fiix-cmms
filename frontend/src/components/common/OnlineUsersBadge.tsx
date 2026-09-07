import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { getOnlineUsers } from '../../api/users';
import type { User } from '../../api/users';
import { pathToModuleLabel } from '../../utils/moduleLabels';

export const OnlineUsersBadge = () => {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);

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

      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-2 border-b border-slate-700 bg-slate-900/50">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
              Activos ahora
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
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
        </div>
      )}
    </div>
  );
};
