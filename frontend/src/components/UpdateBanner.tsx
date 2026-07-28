import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import api from '../api/axios';
import { APP_VERSION } from './VersionModal';
import { useAuth } from '../context/AuthContext';
import { useTechnicianMobileShell } from '../hooks/useTechnicianMobileShell';

type VersionStatus = {
  deployed: string;
  github: string | null;
  updateAvailable: boolean;
  checkedAt?: string;
  error?: string;
};

const DISMISS_GH_KEY = 'fiix_dismiss_github_update';
const DISMISS_SW_KEY = 'fiix_dismiss_sw_update';

/**
 * Avisos de actualización:
 * 1) GitHub tiene versión mayor que la desplegada → pendiente de ./update.sh
 * 2) Service worker con build nuevo ya desplegado → recargar la pestaña
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
  const [swReady, setSwReady] = useState(false);
  const [swUpdateFn, setSwUpdateFn] = useState<(() => void) | null>(null);
  const [swDismissed, setSwDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_SW_KEY) === '1';
    } catch {
      return false;
    }
  });

  const checkGithub = useCallback(async () => {
    try {
      const { data } = await api.get<VersionStatus>('/version/status');
      setGhStatus(data);
      // Si ya alcanzó a GitHub, limpiar dismiss
      if (!data.updateAvailable) {
        try {
          sessionStorage.removeItem(DISMISS_GH_KEY);
        } catch {
          /* ignore */
        }
        setGhDismissed(false);
      }
    } catch {
      /* silencioso: sin red / API */
    }
  }, []);

  useEffect(() => {
    void checkGithub();
    const id = window.setInterval(() => void checkGithub(), 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [checkGithub]);

  useEffect(() => {
    const onNeedRefresh = (e: Event) => {
      const detail = (e as CustomEvent<{ updateSW?: () => void }>).detail;
      setSwReady(true);
      if (detail?.updateSW) {
        setSwUpdateFn(() => detail.updateSW);
      }
    };
    window.addEventListener('fiix-sw-need-refresh', onNeedRefresh);
    return () => window.removeEventListener('fiix-sw-need-refresh', onNeedRefresh);
  }, []);

  const showGh = Boolean(ghStatus?.updateAvailable && ghStatus.github && !ghDismissed);
  const showSw = swReady && !swDismissed;

  if (!showGh && !showSw) return null;

  return (
    <div className={`print:hidden fixed ${bottomClass} left-4 right-4 z-[90] flex flex-col gap-2 md:left-auto md:right-6 md:max-w-md pointer-events-none`}>
      {showSw && (
        <div className="pointer-events-auto rounded-xl border border-sky-200 bg-sky-50 shadow-lg dark:border-sky-800 dark:bg-sky-950/95 px-3 py-2.5 flex items-start gap-2">
          <RefreshCw className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" size={18} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-sky-900 dark:text-sky-100">Nueva versión lista</p>
            <p className="text-xs text-sky-800/90 dark:text-sky-200/90 mt-0.5">
              El servidor ya tiene la actualización. Recarga para usarla (versión actual en esta pestaña: v{APP_VERSION}).
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
          <button
            type="button"
            className="p-1 text-sky-500 hover:text-sky-800 dark:hover:text-sky-200 shrink-0"
            aria-label="Cerrar"
            onClick={() => {
              try {
                sessionStorage.setItem(DISMISS_SW_KEY, '1');
              } catch {
                /* ignore */
              }
              setSwDismissed(true);
            }}
          >
            <X size={16} />
          </button>
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
                ? `En GitHub hay v${ghStatus!.github} y este servidor corre v${ghStatus!.deployed || APP_VERSION}. En el servidor ejecuta ./update.sh para aplicarla.`
                : `Hay una versión más nueva (v${ghStatus!.github}). El administrador la aplicará en el servidor pronto. Esta pestaña sigue en v${APP_VERSION}.`}
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
