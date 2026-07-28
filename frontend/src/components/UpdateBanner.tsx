import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import api from '../api/axios';
import { APP_VERSION } from './VersionModal';
import { useAuth } from '../context/AuthContext';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';
import { compareSemver } from '../utils/semver';

type VersionStatus = {
  deployed: string;
  github: string | null;
  updateAvailable: boolean;
  checkedAt?: string;
  error?: string;
};

const DISMISS_GH_KEY = 'fiix_dismiss_github_update';
const RELOAD_ONCE_KEY = 'fiix_reload_for_deployed';

/**
 * Avisos de actualización:
 * 1) GitHub > servidor → pendiente de ./update.sh (ámbar)
 * 2) Servidor (o SW) > JS de esta pestaña → hay que recargar (azul)
 *
 * El caso (2) evita quedarse en una PWA cacheada (p. ej. ver 1.43.7 con dist 1.43.9).
 */
export function UpdateBanner() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';
  const isTechMobileShell = useTechnicianMobileShell();
  const bottomClass = isTechMobileShell ? 'bottom-24' : 'bottom-4';

  const [ghStatus, setGhStatus] = useState<VersionStatus | null>(null);
  const [ghDismissed, setGhDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_GH_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [clientStale, setClientStale] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [swUpdateFn, setSwUpdateFn] = useState<(() => void) | null>(null);

  const applyReload = useCallback((deployed: string, updateSW?: (() => void) | null) => {
    try {
      const already = sessionStorage.getItem(RELOAD_ONCE_KEY);
      if (already === deployed) {
        // Ya recargamos una vez para esta versión; mostrar banner por si el SW sigue viejo
        setClientStale(true);
        setServerVersion(deployed);
        return;
      }
      sessionStorage.setItem(RELOAD_ONCE_KEY, deployed);
    } catch {
      /* ignore */
    }
    if (updateSW) {
      updateSW();
      return;
    }
    window.location.reload();
  }, []);

  const checkVersions = useCallback(async () => {
    try {
      const { data } = await api.get<VersionStatus>('/version/status');
      setGhStatus(data);

      if (!data.updateAvailable) {
        try {
          sessionStorage.removeItem(DISMISS_GH_KEY);
        } catch {
          /* ignore */
        }
        setGhDismissed(false);
      }

      const deployed = (data.deployed || '').trim();
      if (deployed && compareSemver(deployed, APP_VERSION) > 0) {
        // Servidor más nuevo que el JS cargado → recarga (PWA cacheada)
        applyReload(deployed, swUpdateFn);
      } else if (deployed && compareSemver(deployed, APP_VERSION) === 0) {
        try {
          sessionStorage.removeItem(RELOAD_ONCE_KEY);
        } catch {
          /* ignore */
        }
        setClientStale(false);
      }
    } catch {
      /* silencioso */
    }
  }, [applyReload, swUpdateFn]);

  useEffect(() => {
    void checkVersions();
    const id = window.setInterval(() => void checkVersions(), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [checkVersions]);

  useEffect(() => {
    const onNeedRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ updateSW?: () => void }>).detail;
      const fn = detail?.updateSW || null;
      if (fn) setSwUpdateFn(() => fn);
      setClientStale(true);
      // Intentar aplicar de inmediato
      try {
        const deployed = serverVersion || ghStatus?.deployed || APP_VERSION;
        applyReload(deployed, fn);
      } catch {
        /* banner queda visible */
      }
    };
    window.addEventListener('fiix-sw-need-refresh', onNeedRefresh);
    return () => window.removeEventListener('fiix-sw-need-refresh', onNeedRefresh);
  }, [applyReload, ghStatus?.deployed, serverVersion]);

  const showGh = Boolean(ghStatus?.updateAvailable && ghStatus.github && !ghDismissed);
  const showReload = clientStale;

  if (!showGh && !showReload) return null;

  return (
    <div
      className={`print:hidden fixed ${bottomClass} left-4 right-4 z-[90] flex flex-col gap-2 md:left-auto md:right-6 md:max-w-md pointer-events-none`}
    >
      {showReload && (
        <div className="pointer-events-auto rounded-xl border border-sky-200 bg-sky-50 shadow-lg dark:border-sky-800 dark:bg-sky-950/95 px-3 py-2.5 flex items-start gap-2">
          <RefreshCw className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-sky-900 dark:text-sky-100">Nueva versión lista</p>
            <p className="text-xs text-sky-800/90 dark:text-sky-200/90 mt-0.5">
              Esta pestaña aún muestra v{APP_VERSION}
              {serverVersion ? `; el servidor ya tiene v${serverVersion}` : ''}. Recarga para actualizar.
            </p>
            <button
              type="button"
              onClick={() => {
                if (swUpdateFn) swUpdateFn();
                else window.location.reload();
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5"
            >
              <RefreshCw size={14} /> Recargar ahora
            </button>
          </div>
        </div>
      )}

      {showGh && (
        <div className="pointer-events-auto rounded-xl border border-amber-200 bg-amber-50 shadow-lg dark:border-amber-800 dark:bg-amber-950/95 px-3 py-2.5 flex items-start gap-2">
          <Download className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">
              Actualización disponible (v{ghStatus!.github})
            </p>
            <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-0.5">
              {isAdmin
                ? `En GitHub hay v${ghStatus!.github} y este servidor reporta v${ghStatus!.deployed || APP_VERSION}. Si Actions no desplegó, ejecuta ./update.sh.`
                : `Hay una versión más nueva (v${ghStatus!.github}). El administrador la aplicará en el servidor pronto.`}
            </p>
          </div>
          <button
            type="button"
            className="p-1 text-amber-500 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
            aria-label="Cerrar"
            onClick={() => {
              try {
                sessionStorage.setItem(DISMISS_GH_KEY, '1');
              } catch {
                /* ignore */
              }
              setGhDismissed(true);
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
