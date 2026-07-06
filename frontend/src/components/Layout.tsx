import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { sendHeartbeat } from '../api/users';
import { Menu, Wifi, WifiOff } from 'lucide-react';
import { NotificationsBell } from './NotificationsBell';

export const Layout = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Send initial heartbeat
    if (navigator.onLine) {
      sendHeartbeat().catch(console.error);
    }
    
    // Set up polling every 2 minutes
    const interval = setInterval(() => {
      if (navigator.onLine) {
        sendHeartbeat().catch(console.error);
      }
    }, 2 * 60 * 1000);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Backdrop overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 z-30 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Mobile Header */}
      <header className="print:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 text-white flex items-center justify-between px-4 z-30 md:hidden border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-lg tracking-tight flex items-center gap-2">
            LPET CMMS
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          {isOnline ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full" title="Conectado a Internet">
              <Wifi size={14} />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-full animate-pulse" title="Sin Conexión">
              <WifiOff size={14} />
              Offline
            </div>
          )}
        </div>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen pt-20 md:pt-8 relative print:ml-0 print:p-0 print:h-auto print:overflow-visible print:pt-0">
        
        {/* Desktop Online/Offline Indicator & Notifications */}
        <div className="hidden md:flex justify-end items-center gap-4 mb-6 z-20 print:hidden">
          <div className="bg-white rounded-full shadow-sm border border-slate-100">
            <NotificationsBell />
          </div>
          {!isOnline && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-full shadow-sm text-sm font-medium animate-pulse">
              <WifiOff size={16} />
              Modo Offline (Solo Lectura)
            </div>
          )}
        </div>

        <div className="max-w-6xl mx-auto">
          {children}
        </div>

      </div>
    </div>
  );
};
