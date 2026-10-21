import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

export const PLANT_TZ = 'America/Mexico_City';

const timeFmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: PLANT_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const dateFmt = new Intl.DateTimeFormat('es-MX', {
  timeZone: PLANT_TZ,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/**
 * Reloj de la hora que usa la aplicación (hora de planta, America/Mexico_City).
 * Sirve para saber con qué hora se calculan turnos, KPIs y periodos.
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

  const time = timeFmt.format(now);
  const date = dateFmt.format(now);

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${className}`}
      title={`Hora de planta · ${date} (${PLANT_TZ})`}
      aria-label={`Hora de planta: ${time}`}
    >
      {withIcon && <Clock size={12} className="shrink-0 opacity-80" aria-hidden="true" />}
      <span>{time}</span>
      {!hideLabel && <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">Planta</span>}
    </span>
  );
}
