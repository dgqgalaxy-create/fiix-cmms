import { jsPDF } from 'jspdf';
import {
  formatMinutes,
  roleLabel,
  weeklyTotals,
  type WeeklySummaryRow,
} from './rosterWeeklySummary';

/** PDF del Resumen semanal de Horarios (solo lectura). */

const colors = {
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  pale: '#f8fafc',
  green: '#047857',
  greenPale: '#ecfdf5',
  header: '#0f172a',
};

const shortHours = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
};

const dateLabel = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const shortDate = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

export interface RosterWeeklyPdfInput {
  startDay: string;
  endDay: string;
  rows: WeeklySummaryRow[];
}

export function downloadRosterWeeklyPdf({ startDay, endDay, rows }: RosterWeeklyPdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;
  const bottom = pageH - 16;
  const totals = weeklyTotals(rows);

  const text = (value: string, x: number, y: number, size = 8, bold = false, color = colors.ink) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(value, x, y);
  };

  const drawTopBar = () => {
    doc.setFillColor(colors.green);
    doc.rect(0, 0, pageW, 4, 'F');
  };

  const drawPageHeader = (compact = false) => {
    drawTopBar();
    text('RESUMEN SEMANAL DE HORARIOS', margin, 13, 8, true, colors.green);
    text(`Semana del ${dateLabel(startDay)} al ${dateLabel(endDay)}`, margin, 20, 13, true);
    text(
      `Solo lectura · Hora de planta (America/Mexico_City) · ${rows.length} persona(s) con actividad`,
      margin,
      26,
      8,
      false,
      colors.muted,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(colors.muted);
    doc.text(
      `Generado: ${new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}`,
      pageW - margin,
      14,
      { align: 'right' },
    );
    doc.setDrawColor(colors.border);
    doc.line(margin, compact ? 30 : 32, pageW - margin, compact ? 30 : 32);
  };

  const columns = [
    { key: 'name', title: 'Persona', width: 70, align: 'left' as const },
    { key: 'days', title: 'Días prog.', width: 17, align: 'center' as const },
    { key: 'planned', title: 'H. prog.', width: 19, align: 'center' as const },
    { key: 'extra', title: 'H. extra', width: 19, align: 'center' as const },
    { key: 'teCount', title: '# TE', width: 14, align: 'center' as const },
    { key: 'txt', title: 'TxT', width: 18, align: 'center' as const },
    { key: 'faltas', title: 'Faltas', width: 16, align: 'center' as const },
    { key: 'vac', title: 'Vac.', width: 14, align: 'center' as const },
    { key: 'perm', title: 'Perm.', width: 15, align: 'center' as const },
    { key: 'debt', title: 'Deuda', width: 22, align: 'center' as const },
  ];

  const drawTableHeader = (y: number): number => {
    doc.setFillColor(colors.header);
    doc.rect(margin, y, contentW, 7, 'F');
    let x = margin;
    for (const column of columns) {
      const tx = column.align === 'left' ? x + 2 : x + column.width / 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor('#ffffff');
      doc.text(column.title, tx, y + 4.7, { align: column.align === 'left' ? 'left' : 'center' });
      x += column.width;
    }
    return y + 7;
  };

  drawPageHeader();
  let y = drawTableHeader(37);

  rows.forEach((row, index) => {
    if (y + 7.5 > bottom - 10) {
      doc.addPage();
      drawPageHeader(true);
      y = drawTableHeader(34);
    }
    if (index % 2 === 1) {
      doc.setFillColor(colors.pale);
      doc.rect(margin, y, contentW, 7.5, 'F');
    }
    const values: Record<string, string> = {
      name: row.name,
      days: String(row.scheduledDays),
      planned: shortHours(row.scheduledMinutes),
      extra: shortHours(row.overtimeMinutes),
      teCount: String(row.overtimeEntries),
      txt: shortHours(row.txtMinutes),
      faltas: String(row.faltas),
      vac: String(row.vacaciones),
      perm: String(row.permisos),
      debt: shortHours(row.debtMinutes),
    };
    let x = margin;
    columns.forEach((column, columnIndex) => {
      const value = values[column.key] ?? '';
      doc.setFont('helvetica', column.key === 'name' ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.setTextColor(colors.ink);
      const tx = column.align === 'left' ? x + 2 : x + column.width / 2;
      doc.text(value, tx, y + 5, { align: column.align === 'left' ? 'left' : 'center' });
      if (columnIndex === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(colors.muted);
        doc.text(roleLabel(row.role), x + 2, y + 8.2 - 1.6);
      }
      x += column.width;
    });
    doc.setDrawColor('#eef2f7');
    doc.line(margin, y + 7.5, pageW - margin, y + 7.5);
    y += 7.5;
  });

  // Totales
  if (y + 10 > bottom) {
    doc.addPage();
    drawPageHeader(true);
    y = 34;
  }
  doc.setFillColor(colors.greenPale);
  doc.rect(margin, y, contentW, 8, 'F');
  text('TOTALES', margin + 2, y + 5.4, 8, true, colors.green);
  const totalsText =
    `Horas extra: ${formatMinutes(totals.overtimeMinutes)} · TxT tomado: ${formatMinutes(totals.txtMinutes)} · ` +
    `Faltas: ${totals.faltas} · Deuda pendiente: ${formatMinutes(totals.debtMinutes)}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(colors.green);
  doc.text(totalsText, pageW - margin - 2, y + 5.4, { align: 'right' });
  y += 14;

  // Detalle de incidencias
  const peopleWithEvents = rows.filter((row) => row.events.length > 0);
  if (peopleWithEvents.length > 0) {
    if (y + 20 > bottom) {
      doc.addPage();
      drawPageHeader(true);
      y = 34;
    }
    text('DETALLE DE INCIDENCIAS Y TIEMPOS', margin, y, 10, true, colors.green);
    y += 7;
    for (const person of peopleWithEvents) {
      if (y + 14 > bottom) {
        doc.addPage();
        drawPageHeader(true);
        y = 34;
        text('DETALLE DE INCIDENCIAS Y TIEMPOS (continuación)', margin, y - 1, 9, true, colors.green);
        y += 6;
      }
      text(`${person.name} · ${roleLabel(person.role)}`, margin, y, 8.5, true);
      y += 5;
      for (const event of person.events) {
        if (y + 8 > bottom) {
          doc.addPage();
          drawPageHeader(true);
          y = 34;
          text('DETALLE DE INCIDENCIAS Y TIEMPOS (continuación)', margin, y - 1, 9, true, colors.green);
          y += 6;
        }
        const range = event.start || event.end ? ` · ${event.start ?? '—'}–${event.end ?? '—'}` : '';
        const duration = event.minutes > 0 ? ` · ${formatMinutes(event.minutes)}` : '';
        const notes = event.notes ? ` · ${event.notes}` : '';
        text(`${shortDate(event.date)}  ·  ${event.label}${range}${duration}${notes}`, margin + 4, y, 7.5, false, colors.muted);
        y += 4.6;
      }
      y += 3;
    }
  }

  // Pie de página
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(colors.border);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    text('Resumen semanal · Solo lectura · Información registrada en Horarios (CMMS)', margin, pageH - 7, 7, false, colors.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(colors.muted);
    doc.text(`${page} / ${pages}`, pageW - margin, pageH - 7, { align: 'right' });
  }

  doc.save(`Resumen_Horarios_${startDay}_${endDay}.pdf`);
}
