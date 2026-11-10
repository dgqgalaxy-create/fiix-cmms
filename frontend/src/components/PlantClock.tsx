import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatDate, getDateTimePreferences } from '../utils/dateUtils';

/** Zona de planta por defecto (la preferencia configurada manda). */
export const PLANT_TZ = 'America/Mexico_City';

/**
 * Reloj de la hora que usa la aplicación. Respeta Configuración → Fecha y hora:
 * zona horaria y formato de 12 o 24 horas.
 */
export function PlantClock({
  className = '',
  withIcon = true,
  hideLabel = false,
}: {
  className?: string;
  withIcon?: boolean;
  hideLabel?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const prefs = getDateTimePreferences();
  const timeZone = prefs.time_zone || PLANT_TZ;

  let time = '';
  try {
    time = new Intl.DateTimeFormat('es-MX', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: prefs.time_format === '12',
    }).format(now);
  } catch {
    time = new Intl.DateTimeFormat('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: prefs.time_format === '12',
    }).format(now);
  }

  const date = formatDate(now);

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${className}`}
      title={`Hora de planta · ${date} (${timeZone})`}
      aria-label={`Hora de planta: ${time}`}
    >
      {withIcon && <Clock size={12} className="shrink-0 opacity-80" aria-hidden="true" />}
      <span>{time}</span>
      {!hideLabel && <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Planta</span>}
    </span>
  );
}
