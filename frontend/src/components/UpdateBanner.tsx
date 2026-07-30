import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import api from '../api/axios';
import { APP_VERSION } from './VersionModal';
import { useAuth } from '../context/AuthContext';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';
import { compareSemver } from '../utils/semver';
import { forceClientUpdate } from '../utils/forceClientUpdate';

type VersionStatus = {
  deployed: string;
  github: string | null;
  updateAvailable: boolean;
  checkedAt?: string;
  error?: string;
};

const DISMISS_GH_KEY = 'fiix_dismiss_github_update';
const RELOAD_ONCE_KEY = 'fiix_reload_for_deployed';
const HARD_RELOAD_ONCE_KEY = 'fiix_hard_reload_for_deployed';

type SwUpdateFn = (reloadPage?: boolean) => Promise<void | boolean | undefined>;

/**
 * Avisos de actualización:
 * 1) GitHub > servidor → pendiente de ./update.sh (ámbar)
 * 2) Servidor (o SW) > JS de esta pestaña → hay que recargar (azul)
 *
 * El caso (2) evita quedarse en una PWA cacheada (p. ej. ver 1.44.3 con dist 1.44.11).
 * Soft reload no basta: hay que desregistrar SW + limpiar Cache Storage.
 * Tras un hard reload automático, el banner queda para clic manual (evita loop si dist no se rebuildió).
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
  const [swUpdateFn, setSwUpdateFn] = useState<SwUpdateFn | null>(null);
  const [updating, setUpdating] = useState(false);

  const hardReload = useCallback(async (deployed: string) => {
    setUpdating(true);
    try {
      sessionStorage.setItem(HARD_RELOAD_ONCE_KEY, deployed);
    } catch {
      /* ignore */
    }
    await forceClientUpdate(deployed);
  }, []);

  const applyReload = useCallback(
    async (deployed: string, updateSW?: SwUpdateFn | null) => {
      let softTried = false;
      let hardTried = false;
      try {
        softTried = sessionStorage.getItem(RELOAD_ONCE_KEY) === deployed;
        hardTried = sessionStorage.getItem(HARD_RELOAD_ONCE_KEY) === deployed;
      } catch {
        /* ignore */
      }

      setClientStale(true);
      setServerVersion(deployed);

      // Ya hicimos hard reload automático: dejar banner para clic (no loop infinito).
      if (hardTried) return;

      if (!softTried) {
        try {
          sessionStorage.setItem(RELOAD_ONCE_KEY, deployed);
        } catch {
          /* ignore */
        }
        if (updateSW) {
          try {
            await updateSW(true);
          } catch {
            /* fall through */
          }
          // Si no había waiting worker, updateSW puede no recargar: forzar.
          window.setTimeout(() => {
            void hardReload(deployed);
          }, 1500);
          return;
        }
      }

      await hardReload(deployed);
    },
    [hardReload]
  );

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
        await applyReload(deployed, swUpdateFn);
      } else if (deployed && compareSemver(deployed, APP_VERSION) === 0) {
        try {
          sessionStorage.removeItem(RELOAD_ONCE_KEY);
          sessionStorage.removeItem(HARD_RELOAD_ONCE_KEY);
        } catch {
          /* ignore */
        }
        setClientStale(false);
        setServerVersion(null);
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
      const detail = (e as CustomEvent<{ updateSW?: SwUpdateFn }>).detail;
      const fn = detail?.updateSW || null;
      if (fn) setSwUpdateFn(() => fn);
      setClientStale(true);
      try {
        const deployed = serverVersion || ghStatus?.deployed || APP_VERSION;
        void applyReload(deployed, fn);
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
              disabled={updating}
              onClick={() => {
                const deployed = serverVersion || ghStatus?.deployed || APP_VERSION;
                void hardReload(deployed);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs font-bold px-3 py-1.5"
            >
              <RefreshCw size={14} className={updating ? 'animate-spin' : undefined} />
              {updating ? 'Actualizando…' : 'Recargar ahora'}
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
