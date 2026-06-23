import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { getOnlineUsers } from '../../api/users';
import type { User } from '../../api/users';

export const OnlineUsersBadge = () => {
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchOnlineUsers = async () => {
      try {
        const users = await getOnlineUsers();
        setOnlineUsers(users);
      } catch (error) {
        console.error('Error fetching online users:', error);
      }
    };

    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors text-sm font-medium text-slate-300"
      >
        <div className="flex items-center gap-2">
          <Users size={16} />
          <span>Usuarios en línea</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-bold text-emerald-400">{onlineUsers.length}</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-2 border-b border-slate-700 bg-slate-900/50">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Activos recientemente</p>
          </div>
          <div className="max-h-48 overflow-y-auto custom-scrollbar p-1">
            {onlineUsers.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">Nadie en línea</div>
            ) : (
              onlineUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 rounded-lg transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 font-medium truncate">{u.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase truncate">{u.role}</p>
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
