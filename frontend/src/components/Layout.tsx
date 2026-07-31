import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { sendHeartbeat } from '../api/users';
import { Menu, Wifi, WifiOff, Info, Search } from 'lucide-react';
import { NotificationsBell } from './NotificationsBell';
import { VersionModal, APP_VERSION } from './VersionModal';
import { OfflineBanner } from './OfflineBanner';
import { GlobalSearchModal, GlobalSearchTrigger } from './GlobalSearchModal';
import { TechnicianBottomNav } from './TechnicianBottomNav';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';
import { UpdateBanner } from './UpdateBanner';

export const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const isTechMobileShell = useTechnicianMobileShell();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const isWidePage = location.pathname.startsWith('/calendar') || location.pathname.startsWith('/roster');

  useEffect(() => {
    const beat = () => {
      if (navigator.onLine) {
        sendHeartbeat(location.pathname).catch(console.error);
      }
    };

    beat();

    const interval = setInterval(beat, 2 * 60 * 1000);

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      beat();
      setTimeout(() => setIsSyncing(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-surface-muted text-fg transition-colors duration-200">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <header className="print:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between px-4 z-30 md:hidden border-b border-slate-800 dark:border-slate-900 transition-colors duration-200">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            title="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-lg tracking-tight truncate">
            {isTechMobileShell ? 'Mis tareas' : 'GTZ CMMS'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('open-global-search'))}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Buscar (Ctrl+K)"
            aria-label="Búsqueda global"
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            onClick={() => setIsVersionModalOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 transition-colors"
            title="Versión, novedades y manual"
            aria-label="Abrir información de versión"
          >
            <Info size={14} />
            v{APP_VERSION}
          </button>
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
      <div
        className={`flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen pt-20 md:pt-8 relative print:ml-0 print:p-0 print:h-auto print:overflow-visible print:pt-0 ${
          isTechMobileShell ? 'pb-24' : ''
        }`}
      >
        <div className="flex md:hidden justify-end mb-3 print:hidden">
          <OfflineBanner />
        </div>

        <div className="hidden md:flex justify-end items-center gap-4 mb-6 z-20 print:hidden">
          <GlobalSearchTrigger />
          <div className="bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 transition-colors duration-200">
            <NotificationsBell />
          </div>
          <OfflineBanner />
          {isOnline && isSyncing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-full shadow-sm text-sm font-medium animate-pulse">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
              Sincronizando...
            </div>
          )}
        </div>

        <div className={isWidePage ? 'max-w-none' : 'max-w-6xl mx-auto'}>
          {children}
        </div>
      </div>

      {isTechMobileShell && <TechnicianBottomNav />}

      <UpdateBanner />
      <GlobalSearchModal />
      <VersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
      />
    </div>
  );
};
