import { addDays, addMinutes, startOfMonth, startOfWeek } from 'date-fns';
import es from 'date-fns/locale/es';
import { Views } from 'react-big-calendar';

/**
 * Resolve a calendar slot date from a pointer position over react-big-calendar DOM.
 * Used for touch/pointer drops (HTML5 DnD does not fire drop on most mobile browsers).
 */
export function resolveCalendarDropDate(
  clientX: number,
  clientY: number,
  currentDate: Date,
  currentView: string | typeof Views[keyof typeof Views]
): Date | null {
  const view = String(currentView);

  if (view === Views.AGENDA || view === 'agenda') return null;

  const monthView = document.querySelector('.rbc-month-view');
  if (monthView && (view === Views.MONTH || view === 'month')) {
    const rows = Array.from(monthView.querySelectorAll('.rbc-month-row'));
    for (let r = 0; r < rows.length; r++) {
      const days = Array.from(rows[r].querySelectorAll('.rbc-day-bg'));
      for (let c = 0; c < days.length; c++) {
        const rect = days[c].getBoundingClientRect();
        if (clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom) {
          const gridStart = startOfWeek(startOfMonth(currentDate), { locale: es });
          const day = addDays(gridStart, r * 7 + c);
          day.setHours(8, 0, 0, 0);
          return day;
        }
      }
    }
  }

  const timeContent = document.querySelector('.rbc-time-content');
  if (timeContent && (view === Views.WEEK || view === Views.DAY || view === 'week' || view === 'day')) {
    const daySlots = Array.from(timeContent.querySelectorAll('.rbc-day-slot'));
    for (let i = 0; i < daySlots.length; i++) {
      const slotEl = daySlots[i];
      const rect = slotEl.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom) {
        const yRatio = Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(rect.height, 1)));
        const minutesFromMidnight = Math.floor(yRatio * 24 * 60);
        const snapped = Math.floor(minutesFromMidnight / 30) * 30;

        let day: Date;
        if (view === Views.DAY || view === 'day') {
          day = new Date(currentDate);
        } else {
          const weekStart = startOfWeek(currentDate, { locale: es });
          day = addDays(weekStart, i);
        }
        day.setHours(0, 0, 0, 0);
        return addMinutes(day, snapped);
      }
    }

    // All-day header row (week/day)
    const allDayRow = document.querySelector('.rbc-allday-cell, .rbc-time-header-content');
    if (allDayRow) {
      const headers = Array.from(document.querySelectorAll('.rbc-time-header-content .rbc-header'));
      for (let i = 0; i < headers.length; i++) {
        const rect = headers[i].getBoundingClientRect();
        if (clientX >= rect.left && clientX < rect.right && clientY >= rect.top && clientY < rect.bottom) {
          let day: Date;
          if (view === Views.DAY || view === 'day') {
            day = new Date(currentDate);
          } else {
            const weekStart = startOfWeek(currentDate, { locale: es });
            day = addDays(weekStart, i);
          }
          day.setHours(8, 0, 0, 0);
          return day;
        }
      }
    }
  }

  return null;
}
