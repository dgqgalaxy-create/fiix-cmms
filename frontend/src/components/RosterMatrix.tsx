import { useMemo, useState } from 'react';
import {
  rosterEventColor,
  rosterEventShort,
  rosterShortColor,
  isLightColor,
  type RosterVisualEvent,
} from '../utils/rosterVisuals';

export interface RosterMatrixDay {
  iso: string;
  weekday: string;
  dayNumber: string;
  isWeekend: boolean;
  isToday: boolean;
  holiday?: string;
}

export interface RosterMatrixPerson {
  id: string;
  name: string;
  is_active: boolean;
}

export interface RosterMatrixEvent extends RosterVisualEvent {
  id: string;
  user_id: string;
  dateStr: string;
  exceptionId?: string;
  hoursLabel?: string;
  title: string;
}

interface RosterMatrixProps<T extends RosterMatrixEvent> {
  days: RosterMatrixDay[];
  people: RosterMatrixPerson[];
  events: T[];
  /** Permite soltar incidencias y abrir acciones del día. */
  canManageShifts: boolean;
  /** true mientras el usuario arrastra un bloque de incidencia. */
  draggingException: boolean;
  onSelectDay: (iso: string) => void;
  onSelectEvent: (event: T) => void;
  onDropOnCell: (personId: string, iso: string) => void;
}

/** Orden fijo de los códigos en la fila de cobertura. */
const COVERAGE_ORDER = ['D', 'N', 'M', 'DESC', 'TE', 'TxT', 'D+TE', 'N+TE', 'V', 'F', 'PSG', 'PCG', 'I', 'X', 'CURSO'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

/**
 * Matriz «Personal × Días»: una fila por persona y una columna por día.
 * Muestra todos los turnos a la vez (sin «+N más») y una fila de cobertura diaria.
 */
export function RosterMatrix<T extends RosterMatrixEvent>({
  days,
  people,
  events,
  canManageShifts,
  draggingException,
  onSelectDay,
  onSelectEvent,
  onDropOnCell,
}: RosterMatrixProps<T>) {
  const [hoverCell, setHoverCell] = useState<string | null>(null);

  const byCell = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const event of events) {
      const key = `${event.user_id}|${event.dateStr}`;
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  const coverage = useMemo(
    () =>
      days.map((day) => {
        const counts: Record<string, number> = {};
        for (const person of people) {
          for (const event of byCell.get(`${person.id}|${day.iso}`) ?? []) {
            const code = rosterEventShort(event);
            counts[code] = (counts[code] ?? 0) + 1;
          }
        }
        return counts;
      }),
    [days, people, byCell]
  );

  const orderedCoverage = (counts: Record<string, number>) => {
    const keys = Object.keys(counts).sort((a, b) => {
      const ia = COVERAGE_ORDER.indexOf(a);
      const ib = COVERAGE_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map((key) => ({ key, count: counts[key] }));
  };

  if (people.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
        No hay personal que coincida con el filtro.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto print:overflow-visible">
      <table className="min-w-full border-separate border-spacing-0 text-left">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 w-[190px] min-w-[190px] border-b border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
              Personal
            </th>
            {days.map((day) => (
              <th
                key={day.iso}
                title={day.holiday ? `Día festivo: ${day.holiday}` : undefined}
                className={`min-w-[92px] border-b border-slate-200 px-1 py-1.5 text-center align-top dark:border-slate-700 ${
                  day.isToday
                    ? 'bg-emerald-50 dark:bg-emerald-950/30'
                    : day.isWeekend
                      ? 'bg-slate-50 dark:bg-slate-800/40'
                      : 'bg-white dark:bg-slate-900'
                }`}
              >
                <div className={`text-[10px] font-semibold uppercase ${day.isToday ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {day.weekday}
                </div>
                <div className={`text-base font-bold ${day.isToday ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'}`}>
                  {day.dayNumber}
                </div>
                {day.holiday && <div className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-fuchsia-500" />}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {people.map((person) => (
            <tr key={person.id} className={person.is_active ? undefined : 'opacity-60'}>
              <th
                scope="row"
                className="sticky left-0 z-10 max-w-[190px] border-b border-slate-100 bg-white px-3 py-1 text-left align-middle dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-400 text-[9px] font-bold text-white dark:bg-slate-600">
                    {initials(person.name) || '?'}
                  </span>
                  <span
                    className="line-clamp-2 break-words text-[11px] font-medium leading-tight text-slate-700 dark:text-slate-200"
                    title={person.name}
                  >
                    {person.name}
                  </span>
                </div>
              </th>

              {days.map((day) => {
                const key = `${person.id}|${day.iso}`;
                const cellEvents = byCell.get(key) ?? [];
                const isHover = hoverCell === key;
                return (
                  <td
                    key={day.iso}
                    onClick={() => onSelectDay(day.iso)}
                    onDragOver={(event) => {
                      if (!canManageShifts || !draggingException) return;
                      event.preventDefault();
                      setHoverCell(key);
                    }}
                    onDragLeave={() => setHoverCell((current) => (current === key ? null : current))}
                    onDrop={(event) => {
                      if (!canManageShifts) return;
                      event.preventDefault();
                      setHoverCell(null);
                      onDropOnCell(person.id, day.iso);
                    }}
                    className={`border-b border-slate-100 p-0 align-middle dark:border-slate-800 ${
                      isHover
                        ? 'bg-emerald-100/70 dark:bg-emerald-900/40'
                        : day.isToday
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          : day.isWeekend
                            ? 'bg-slate-50/70 dark:bg-slate-800/30'
                            : ''
                    }`}
                  >
                    <div className="flex min-h-[30px] flex-col items-center justify-center gap-0.5 px-1 py-1">
                      {cellEvents.length === 0 ? (
                        <span className="text-[11px] text-slate-300 dark:text-slate-600">·</span>
                      ) : (
                        cellEvents.map((cellEvent) => {
                          const color = rosterEventColor(cellEvent);
                          const light = isLightColor(color);
                          return (
                            <button
                              key={cellEvent.id}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectEvent(cellEvent);
                              }}
                              title={`${person.name} — ${cellEvent.title}${cellEvent.hoursLabel ? ` · ${cellEvent.hoursLabel}` : ''}`}
                              className={`w-full truncate rounded px-1.5 py-[2px] text-center text-[10px] font-bold leading-tight transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 ${
                                light ? 'text-slate-600' : 'text-white'
                              }`}
                              style={{ backgroundColor: color }}
                            >
                              {rosterEventShort(cellEvent)}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <th
              scope="row"
              className="sticky bottom-0 left-0 z-30 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              Cobertura
            </th>
            {days.map((day, index) => (
              <td
                key={day.iso}
                className={`sticky bottom-0 z-20 border-t border-slate-200 bg-slate-50 px-1 py-1.5 text-center align-top dark:border-slate-700 dark:bg-slate-800 ${
                  day.isToday ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[9px] leading-tight text-slate-500 dark:text-slate-400">
                  {orderedCoverage(coverage[index]).map(({ key, count }) => (
                    <span key={key} className="inline-flex items-center gap-0.5 whitespace-nowrap">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: rosterShortColor(key) }}
                      />
                      <span className="font-bold text-slate-600 dark:text-slate-300">{key}</span>
                      <span>{count}</span>
                    </span>
                  ))}
                </div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
