import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateMyPreferences } from '../api/users';
import {
  disableDevicePush,
  enableDevicePush,
  getPushSupportInfo,
  refreshPushStatus,
} from '../utils/webPushClient';

type Props = {
  /** Clase extra en el contenedor */
  className?: string;
  /** Versión corta para el menú de la campana */
  compact?: boolean;
};

/**
 * Interruptor opt-in para notificaciones del sistema (Web Push / PWA).
 */
export function DevicePushToggle({ className = '', compact = false }: Props) {
  const { user, updateUserPreferences } = useAuth();
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(Boolean(user?.preferences?.push_enabled));
  const [hint, setHint] = useState<string | null>(null);
  const [serverConfigured, setServerConfigured] = useState(true);

  const support = getPushSupportInfo();

  useEffect(() => {
    setEnabled(Boolean(user?.preferences?.push_enabled));
  }, [user?.preferences?.push_enabled]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await refreshPushStatus();
      if (cancelled) return;
      setServerConfigured(status.configured);
      if (status.subscribed) setEnabled(true);
      if (!status.configured) {
        setHint('El servidor aún no tiene claves VAPID configuradas.');
      } else if (!support.supported) {
        setHint(support.reason || null);
      } else if (support.permission === 'denied') {
        setHint('Permiso denegado en el navegador. Actívalo en la configuración del sitio o reinstala la PWA.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [support.supported, support.permission, support.reason]);

  const persistPref = async (push_enabled: boolean) => {
    const newPreferences = { ...(user?.preferences || {}), push_enabled };
    await updateMyPreferences(newPreferences);
    updateUserPreferences(newPreferences);
  };

  const handleToggle = async () => {
    if (busy) return;
    setBusy(true);
    setHint(null);
    try {
      if (enabled) {
        const res = await disableDevicePush();
        if (!res.ok) {
          setHint(res.error);
          return;
        }
        await persistPref(false);
        setEnabled(false);
      } else {
        if (!support.supported) {
          setHint(support.reason || 'No soportado en este dispositivo.');
          return;
        }
        const res = await enableDevicePush();
        if (!res.ok) {
          setHint(res.error);
          return;
        }
        await persistPref(true);
        setEnabled(true);
      }
    } catch (err: any) {
      setHint(err?.message || 'No se pudo actualizar la preferencia.');
    } finally {
      setBusy(false);
    }
  };

  const toggleDisabled =
    busy || (!enabled && (!support.supported || !serverConfigured || support.permission === 'denied'));

  return (
    <div className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={`font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 ${
              compact ? 'text-sm' : ''
            }`}
          >
            {!compact && (
              <BellRing size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            Notificaciones del dispositivo
          </h3>
          {!compact && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Avisos del sistema aunque la pestaña esté en segundo plano (nuevas OT y recordatorios SLA).
              Requiere HTTPS (o localhost). En iPhone/iPad: instala la app en Inicio e iOS 16.4+.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={toggleDisabled}
          aria-pressed={enabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
            enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
          } ${toggleDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      {hint && (
        <p className={`mt-2 text-amber-700 dark:text-amber-400 ${compact ? 'text-[10px] leading-snug' : 'text-xs'}`}>
          {hint}
        </p>
      )}
    </div>
  );
}
