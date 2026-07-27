import { Views, type View } from 'react-big-calendar';

function parseSlotDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateFromMonthDayBg(dayBg: Element, currentDate: Date): Date | null {
  const fromAttr = parseSlotDate(dayBg.getAttribute('data-date'));
  if (fromAttr) {
    const d = new Date(fromAttr);
    d.setHours(8, 0, 0, 0);
    return d;
  }

  const rowBg = dayBg.parentElement;
  const monthRow = rowBg?.parentElement;
  if (!rowBg || !monthRow) return null;

  const idx = Array.from(rowBg.children).indexOf(dayBg);
  if (idx < 0) return null;

  const contentRow = monthRow.querySelector('.rbc-row-content .rbc-row');
  const cells = contentRow
    ? Array.from(contentRow.querySelectorAll('.rbc-date-cell'))
    : [];
  const cell = cells[idx];
  if (!cell) return null;

  const label = (cell.querySelector('button, a')?.textContent || cell.textContent || '').trim();
  const dayNum = parseInt(label, 10);
  if (Number.isNaN(dayNum) || dayNum < 1 || dayNum > 31) return null;

  const offRange = cell.classList.contains('rbc-off-range') || dayBg.classList.contains('rbc-off-range-bg');
  let year = currentDate.getFullYear();
  let month = currentDate.getMonth();
  if (offRange) {
    if (dayNum > 15) {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
    } else {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }
  }
  return new Date(year, month, dayNum, 8, 0, 0, 0);
}

/** Fecha bajo el dedo/cursor al soltar una OT pendiente sobre el calendario. */
export function resolveCalendarDropDate(
  clientX: number,
  clientY: number,
  currentDate: Date,
  currentView: View
): Date | null {
  const blockers = Array.from(
    document.querySelectorAll<HTMLElement>('[data-calendar-drop-ignore="true"]')
  );
  const prev = blockers.map((el) => el.style.pointerEvents);
  blockers.forEach((el) => {
    el.style.pointerEvents = 'none';
  });

  let hit: Element | null = null;
  try {
    hit = document.elementFromPoint(clientX, clientY);
  } finally {
    blockers.forEach((el, i) => {
      el.style.pointerEvents = prev[i] || '';
    });
  }

  if (!hit) return null;

  const daySlot = hit.closest('.rbc-day-slot') as HTMLElement | null;
  if (daySlot) {
    const fromAttr = parseSlotDate(daySlot.getAttribute('data-date'));
    const rect = daySlot.getBoundingClientRect();
    if (rect.height > 0) {
      const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      const minutesFromMidnight = Math.round((ratio * 24 * 60) / 15) * 15;
      const base =
        fromAttr ||
        parseSlotDate(daySlot.closest('.rbc-time-column')?.getAttribute('data-date') || null) ||
        new Date(currentDate);
      const d = new Date(base);
      d.setHours(0, 0, 0, 0);
      d.setMinutes(minutesFromMidnight);
      return d;
    }
    if (fromAttr) return fromAttr;
  }

  const dayBg = hit.closest('.rbc-day-bg') as HTMLElement | null;
  if (dayBg) {
    const monthDate = dateFromMonthDayBg(dayBg, currentDate);
    if (monthDate) return monthDate;
    const fromAttr = parseSlotDate(dayBg.getAttribute('data-date'));
    if (fromAttr) return fromAttr;
  }

  const dateCell = hit.closest('.rbc-date-cell') as HTMLElement | null;
  if (dateCell) {
    const label = (dateCell.querySelector('button, a')?.textContent || dateCell.textContent || '').trim();
    const dayNum = parseInt(label, 10);
    if (!Number.isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
      const offRange = dateCell.classList.contains('rbc-off-range');
      let year = currentDate.getFullYear();
      let month = currentDate.getMonth();
      if (offRange) {
        if (dayNum > 15) {
          month -= 1;
          if (month < 0) {
            month = 11;
            year -= 1;
          }
        } else {
          month += 1;
          if (month > 11) {
            month = 0;
            year += 1;
          }
        }
      }
      const d = new Date(year, month, dayNum, 8, 0, 0, 0);
      if (currentView === Views.MONTH || String(currentView) === 'month') {
        return d;
      }
      return d;
    }
  }

  const cells = Array.from(document.querySelectorAll('.rbc-day-bg'));
  for (const cell of cells) {
    const rect = cell.getBoundingClientRect();
    if (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    ) {
      const monthDate = dateFromMonthDayBg(cell, currentDate);
      if (monthDate) return monthDate;
      const fromAttr = parseSlotDate(cell.getAttribute('data-date'));
      if (fromAttr) return fromAttr;
    }
  }

  return null;
}

export function defaultScheduleEnd(start: Date): Date {
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return end;
}
