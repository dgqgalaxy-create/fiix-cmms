import { jsPDF } from 'jspdf';
import type { WorkOrder } from '../api/workOrders';
import { formatWorkOrderFolio } from './folio';
import { monthDays, monthLabel, addDays, REPORT_LABELS, REPORT_STATUSES, REPORT_TYPES, REPORT_TZ, repairMs, weekNumber, weeklyCompletions, weeklyReport } from './weeklyReport';

export interface WeeklyPdfInput {
  monthly?: boolean;
  monday: string;
  today: string;
  orders: WorkOrder[];
  completed: WorkOrder[];
  updatedAt: string;
  now: number;
}
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('es-MX', { timeZone: REPORT_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' });

/** Vector text and tables stay sharp and paginate independently of screen size. */
export function buildWeeklyReportPdf(input: WeeklyPdfInput) {
  const { monday, today, orders, completed, updatedAt, now } = input;
  const monthly = input.monthly ?? false;
  const title = monthly ? 'Informe mensual' : 'Informe semanal';
  const count = monthly ? monthDays(monday) : 7;
  const end = addDays(monday, count - 1);
  const report = weeklyReport(orders, monday, today, count);
  const completions = weeklyCompletions(completed, monday, today, count);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = 273;
  let y = 0;
  const text = (value: string, x: number, top: number, size = 9, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor('#1e293b');
    doc.text(value, x, top);
  };
  const header = () => {
    text(title, 12, 15, 18, true);
    text(monthly ? 'MES' : 'SEMANA', 190, 13, 10, true);
    text(monthly ? monday.slice(5, 7) : String(weekNumber(monday)), 195, 23, 19, true);
    text(`${monday} al ${end} | Hora de planta: Ciudad de México`, 12, 22);
    text(`Datos actualizados: ${dateTime(updatedAt)}`, 12, 28, 8);
    doc.setDrawColor('#cbd5e1'); doc.line(12, 32, 285, 32);
    y = 39;
  };
  const newPage = () => { doc.addPage(); header(); };
  const note = (value: string) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const lines: string[] = doc.splitTextToSize(value, width);
    if (y + lines.length * 4 > 193) newPage();
    for (const line of lines) { text(line, 12, y, 8); y += 4; }
    y += 3;
  };
  // Split oversized cells across pages and repeat column headers on each page.
  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const lineHeight = 3.4;
    const split = (cells: string[], bold = false): string[][] => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8);
      return cells.map((cell, i) => doc.splitTextToSize(cell || '-', widths[i] - 4));
    };
    const paint = (cells: string[][], height: number, heading: boolean) => {
      let x = 12;
      cells.forEach((lines, i) => {
        doc.setFillColor(heading ? '#e2e8f0' : '#ffffff');
        doc.setDrawColor('#cbd5e1');
        doc.rect(x, y, widths[i], height, 'FD');
        lines.forEach((line, j) => text(line, x + 2, y + 4 + j * lineHeight, 8, heading));
        x += widths[i];
      });
      y += height;
    };
    const heads = split(headers, true);
    const headHeight = Math.max(...heads.map(lines => lines.length)) * lineHeight + 4;
    const drawHead = () => paint(heads, headHeight, true);
    if (y + headHeight + 10 > 193) newPage();
    drawHead();
    for (const row of rows) {
      const cells = split(row);
      const count = Math.max(...cells.map(lines => lines.length));
      const fullHeight = count * lineHeight + 4;
      if (y + fullHeight > 193 && fullHeight <= 154 - headHeight) { newPage(); drawHead(); }
      let offset = 0;
      while (offset < count) {
        const fits = Math.floor((193 - y - 4) / lineHeight);
        if (fits < 1) { newPage(); drawHead(); continue; }
        const take = Math.min(fits, count - offset);
        paint(cells.map(lines => lines.slice(offset, offset + take)), take * lineHeight + 4, false);
        offset += take;
        if (offset < count) { newPage(); drawHead(); }
      }
    }
    y += 6;
  };
  const renderTotals = () => {
  text(monthly ? 'Totales mensuales' : 'Totales semanales', 12, y, 12, true); y += 6;
  table(['Indicador', 'Cantidad', 'Porcentaje'], [
    ['Total levantadas', String(report.total), '-'],
    ['Solicitudes válidas', String(report.valid), report.valid ? '100 %' : '-'],
    ...REPORT_STATUSES.map(status => [REPORT_LABELS[status], String(report.totals[status]), status === 'ANULADO' ? 'Fuera del porcentaje' : report.valid ? `${(report.totals[status] / report.valid * 100).toFixed(1)} %` : '-']),
  ], [130, 60, 83]);
  note('Las invalidadas se excluyen del cálculo de porcentajes. Las OT conservan su fecha de levantamiento y muestran su estado actualizado.');
  };
  header();
  text('CUMPLIMIENTO', 227, 13, 10, true);
  text(report.valid ? `${(report.totals.FINALIZADO / report.valid * 100).toFixed(1)} %` : '-', 237, 23, 19, true);
  text('Órdenes finalizadas por día', 12, y, 12, true);
  text(`Total: ${completions.reduce((sum, day) => sum + day.PREVENTIVO + day.CORRECTIVO + day.SERVICIO, 0)} OT`, 240, y, 10, true); y += 6;
  note('Por fecha de finalización; incluye OT levantadas en periodos anteriores.');
  const colors = ['#10b981', '#ef4444', '#3b82f6'];
  const maximum = Math.max(1, ...completions.flatMap(day => REPORT_TYPES.map(type => day[type])));
  const ceiling = Math.ceil(maximum / 4) * 4;
  const base = y + 39;
  for (let tick = 0; tick <= 4; tick++) {
    const top = base - tick * 9;
    doc.setDrawColor('#e2e8f0'); doc.line(24, top, 280, top);
    text(String(ceiling * tick / 4), 14, top + 1, 8);
  }
  completions.forEach((day, i) => {
    const step = 252 / count;
    const bar = Math.min(7, step / 4);
    const x = 28 + i * step;
    REPORT_TYPES.forEach((type, j) => {
      const height = day[type] / ceiling * 36;
      doc.setFillColor(colors[j]);
      if (height > 0) doc.rect(x + j * bar, base - height, bar * 0.85, height, 'F');
      if (day[type] && !monthly) text(String(day[type]), x + j * bar, base - height - 1, 7);
    });
    text(monthly ? day.date.slice(8) : dayLabel(day.date), x - 1, base + 5, monthly ? 6 : 8);
  });
  y = base + 12;
  ['Preventivo', 'Correctivo', 'Servicio'].forEach((label, i) => {
    doc.setFillColor(colors[i]); doc.rect(85 + i * 40, y - 3, 3, 3, 'F');
    text(label, 90 + i * 40, y, 8);
  });
  y += 8;
  if (monthly) {
    renderTotals();
    newPage();
    text(`Resumen de ${monthLabel(monday)}`, 12, y, 12, true); y += 6;
    table(['Día', ...REPORT_STATUSES.map(status => REPORT_LABELS[status]), 'Backlog', 'OT levantadas'], report.days.map(day => [dayLabel(day.date), ...REPORT_STATUSES.map(status => day.future ? '-' : REPORT_TYPES.map(type => day.counts[status][type]).join(' / ')), day.future ? '-' : String(day.backlog), day.future ? '-' : String(day.items.length)]), [35, ...Array(7).fill(34)]);
  } else {
  text('Resumen de la semana seleccionada', 12, y, 12, true); y += 6;
  table(['Estado de OT', ...report.days.map(day => dayLabel(day.date))], [
    ...REPORT_STATUSES.map(status => [REPORT_LABELS[status], ...report.days.map(day => day.future ? '-' : REPORT_TYPES.map(type => day.counts[status][type]).join(' / '))]),
    ['Backlog', ...report.days.map(day => day.future ? '-' : String(day.backlog))],
    ['OT levantadas', ...report.days.map(day => day.future ? '-' : String(day.items.length))],
  ], [35, ...Array(7).fill(34)]);
  }
  note('Cada celda: Preventivo / Correctivo / Servicio. Backlog: OT levantadas ese día aún pendientes, en proceso o pausadas. Días futuros: -.');
  newPage();
  if (!monthly) renderTotals();
  text('Resumen de solicitudes por día', 12, y, 12, true); y += 7;
  for (const day of report.days) {
    if (y + 35 > 193) newPage();
    text(`${dayLabel(day.date)} | ${day.future ? 'Día por transcurrir' : `${day.items.length} OT`}`, 12, y, 10, true); y += 6;
    if (!day.items.length) { note(day.future ? 'La actividad aparecerá cuando llegue este día.' : 'Sin solicitudes levantadas este día.'); continue; }
    table(['Folio', 'Levantamiento', 'Zona', 'Equipo', 'Estado', 'Inicio', 'Finalizado', 'Reparación', 'Paro', 'Técnico', 'Solicitante'], day.items.map(order => {
      const ms = repairMs(order, now);
      const minutes = ms === null ? null : Math.floor(ms / 60000);
      return [formatWorkOrderFolio(order.folio), dateTime(order.created_at), order.zone?.name || '-', order.asset?.name || '-', REPORT_LABELS[order.status], dateTime(order.started_at), dateTime(order.completed_at), minutes === null ? '-' : `${Math.floor(minutes / 60)} h ${minutes % 60} min`, order.machine_stopped ? 'Sí' : 'No', order.assigned_technicians?.map(tech => tech.name).join(', ') || 'Sin asignar', order.requester_name || '-'];
    }), [22, 27, 20, 35, 23, 27, 27, 20, 12, 30, 30]);
  }
  note('Tiempo de reparación: trabajo acumulado sin pausas; incluye el tramo activo de OT en proceso.');
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    text(`${title} | ${monday} | Página ${page} de ${pages}`, 12, 203, 8);
  }
  return doc;
}

export function downloadWeeklyReportPdf(input: WeeklyPdfInput) {
  buildWeeklyReportPdf(input).save(`Informe-${input.monthly ? 'mensual' : 'semanal'}_${input.monday}_al_${addDays(input.monday, input.monthly ? monthDays(input.monday) - 1 : 6)}.pdf`);
}
