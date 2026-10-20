import { jsPDF } from 'jspdf';
import type { TechnicianPerformanceDetail } from '../api/kpis';
import { formatWorkOrderFolio } from './folio';

type Order = TechnicianPerformanceDetail['orders'][number];

export interface TechnicianPerformancePdfInput {
  data: TechnicianPerformanceDetail;
  periodLabel: string;
  orders: Order[];
  filtersLabel: string;
}

const duration = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const minutes = Math.round(ms / 60_000);
  return minutes < 60 ? `${minutes} min` : `${(minutes / 60).toLocaleString('es-MX', { maximumFractionDigits: 1 })} h`;
};

const date = (value?: string | null) => value
  ? new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const statusLabel: Record<string, string> = {
  PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', EN_ESPERA: 'En espera', FINALIZADO: 'Finalizada', ANULADO: 'Anulada',
};
const typeLabel: Record<string, string> = { CORRECTIVO: 'Correctivo', PREVENTIVO: 'Preventivo', SERVICIO: 'Servicio' };

const colors = {
  ink: '#0f172a', muted: '#64748b', border: '#e2e8f0', pale: '#f8fafc',
  green: '#059669', greenPale: '#ecfdf5', blue: '#0284c7', purple: '#7c3aed', amber: '#d97706', red: '#e11d48',
};

export function buildTechnicianPerformancePdf({ data, periodLabel, orders, filtersLabel }: TechnicianPerformancePdfInput) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const margin = 12;
  const contentW = pageW - margin * 2;
  const metrics = data.metrics;
  const text = (value: string, x: number, y: number, size = 8, bold = false, color = colors.ink) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(value, x, y);
  };
  const header = (subtitle: string) => {
    doc.setFillColor(colors.green);
    doc.rect(0, 0, pageW, 4, 'F');
    text('DESEMPEÑO INDIVIDUAL', margin, 13, 8, true, colors.green);
    text(data.technician.name, margin, 22, 20, true);
    text(`${data.technician.role === 'TECNICO' ? 'Técnico' : 'Gestionador'} · ${periodLabel}`, margin, 29, 9, false, colors.muted);
    text(subtitle, pageW - margin, 14, 8, true, colors.muted);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('CMMS · Informe generado el ' + new Date().toLocaleDateString('es-MX'), pageW - margin, 21, { align: 'right' });
    doc.setDrawColor(colors.border); doc.line(margin, 34, pageW - margin, 34);
  };
  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setDrawColor(colors.border); doc.line(margin, 201, pageW - margin, 201);
      text('Reporte confidencial · Indicadores calculados con la información registrada en las OT', margin, 207, 7, false, colors.muted);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(colors.muted);
      doc.text(`${page} / ${pages}`, pageW - margin, 207, { align: 'right' });
    }
  };

  header('RESUMEN');
  const metricCards = [
    ['OT asignadas', String(metrics.assigned), 'En el periodo', colors.blue],
    ['OT finalizadas', String(metrics.completed), 'Cierre en el periodo', colors.green],
    ['Respuesta promedio', duration(metrics.responseAverageMs), `${metrics.responseSample} OT con inicio`, colors.purple],
    ['Reparación promedio', duration(metrics.repairAverageMs), `${metrics.repairSample} OT finalizadas`, colors.amber],
    ['Ciclo promedio', duration(metrics.cycleAverageMs), 'Creación hasta cierre', '#4f46e5'],
    ['OT abiertas', String(metrics.open), 'Pendiente, proceso o espera', colors.red],
    ['Horas de labor', duration(metrics.totalLaborMs), 'Tiempo registrado', '#0891b2'],
    ['OT vencidas', String(metrics.overdueOpen), 'Abiertas fuera de fecha', '#e11d48'],
    [
      'Lugar entre el grupo',
      data.ranking.place ? `#${data.ranking.place}` : '—',
      `${data.ranking.completed} OT finalizadas · de ${data.ranking.totalPeers} personas`,
      data.ranking.place === 1 ? '#d4a017' : data.ranking.place === 2 ? '#94a3b8' : data.ranking.place === 3 ? '#b45309' : colors.green,
    ],
  ] as const;
  const cardGap = 4;
  const cardW = (contentW - cardGap * 2) / 3;
  metricCards.forEach(([label, value, detail, accent], i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = margin + col * (cardW + cardGap);
    const y = 39 + row * 22;
    doc.setFillColor(colors.pale); doc.setDrawColor(colors.border); doc.roundedRect(x, y, cardW, 19, 2, 2, 'FD');
    doc.setFillColor(accent); doc.roundedRect(x, y, 1.7, 19, 0.8, 0.8, 'F');
    text(label, x + 5, y + 5, 7, true, colors.muted);
    text(value, x + 5, y + 12, label === 'Lugar entre el grupo' ? 14 : 11.5, true);
    text(detail, x + 5, y + 17, 6.5, false, colors.muted);
  });

  // Two vector charts keep the PDF sharp when zoomed or printed.
  const chartY = 107;
  const chartH = 84;
  const leftX = margin;
  const leftW = 160;
  const rightX = leftX + leftW + 6;
  const rightW = contentW - leftW - 6;
  for (const [x, w, title] of [[leftX, leftW, 'Actividad mensual'], [rightX, rightW, 'Mezcla de mantenimiento']] as const) {
    doc.setFillColor('#ffffff'); doc.setDrawColor(colors.border); doc.roundedRect(x, chartY, w, chartH, 2, 2, 'FD');
    text(title, x + 5, chartY + 8, 9, true);
  }
  text('OT creadas y finalizadas · últimos 12 meses', leftX + 5, chartY + 14, 6.5, false, colors.muted);
  const trend = data.trend.slice(-12);
  const maxActivity = Math.max(1, ...trend.flatMap((month) => [month.created, month.completed]));
  const plotX = leftX + 12;
  const plotY = chartY + 22;
  const plotW = leftW - 20;
  const plotH = 45;
  for (let tick = 0; tick <= 3; tick++) {
    const y = plotY + plotH - (plotH * tick / 3);
    doc.setDrawColor('#eef2f7'); doc.line(plotX, y, plotX + plotW, y);
  }
  const step = plotW / Math.max(1, trend.length);
  trend.forEach((month, i) => {
    const x = plotX + i * step + step * 0.2;
    const barW = Math.min(3.2, step * 0.28);
    const createdH = month.created / maxActivity * plotH;
    const completedH = month.completed / maxActivity * plotH;
    doc.setFillColor(colors.blue); if (createdH > 0) doc.rect(x, plotY + plotH - createdH, barW, createdH, 'F');
    doc.setFillColor(colors.green); if (completedH > 0) doc.rect(x + barW + 0.8, plotY + plotH - completedH, barW, completedH, 'F');
    text(month.label, x - 1, plotY + plotH + 6, 5.7, false, colors.muted);
  });
  doc.setFillColor(colors.blue); doc.rect(leftX + 45, chartY + 76, 3, 2, 'F'); text('Creadas', leftX + 50, chartY + 78, 6.3, false, colors.muted);
  doc.setFillColor(colors.green); doc.rect(leftX + 77, chartY + 76, 3, 2, 'F'); text('Finalizadas', leftX + 82, chartY + 78, 6.3, false, colors.muted);

  const typeTotals = new Map<string, number>();
  data.orders.filter((order) => order.status !== 'ANULADO').forEach((order) => typeTotals.set(order.maintenance_type, (typeTotals.get(order.maintenance_type) ?? 0) + 1));
  const types = [...typeTotals.entries()];
  const maxType = Math.max(1, ...types.map(([, value]) => value));
  const typeColors: Record<string, string> = { CORRECTIVO: colors.blue, PREVENTIVO: colors.green, SERVICIO: colors.amber };
  types.forEach(([type, value], i) => {
    const y = chartY + 25 + i * 16;
    text(typeLabel[type] ?? type, rightX + 7, y + 4, 7.5, true);
    doc.setFillColor('#f1f5f9'); doc.roundedRect(rightX + 48, y, rightW - 68, 6, 2, 2, 'F');
    doc.setFillColor(typeColors[type] ?? colors.purple); doc.roundedRect(rightX + 48, y, Math.max(1, (rightW - 68) * value / maxType), 6, 2, 2, 'F');
    text(String(value), rightX + rightW - 14, y + 4.5, 7.5, true);
  });
  if (!types.length) text('Sin órdenes en el periodo', rightX + 7, chartY + 31, 8, false, colors.muted);
  const responsePercent = metrics.responseWithinGoalPercent == null ? '—' : `${metrics.responseWithinGoalPercent.toFixed(1)}%`;
  const repairPercent = metrics.repairWithinGoalPercent == null ? '—' : `${metrics.repairWithinGoalPercent.toFixed(1)}%`;
  text(`Cumplimiento: respuesta ${responsePercent} (meta ≤ ${metrics.responseTargetHours} h) · reparación ${repairPercent} (meta ≤ ${metrics.repairTargetHours} h)`, rightX + 7, chartY + 72, 6.2, false, colors.muted);

  const pageHeader = () => {
    doc.addPage();
    header('HISTORIAL DE ÓRDENES');
    text(`Órdenes en el informe: ${orders.length}`, margin, 41, 9, true);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(colors.muted);
    const lines = doc.splitTextToSize(`Filtros: ${filtersLabel}`, contentW);
    doc.text(lines, margin, 47);
  };
  pageHeader();
  let y = 47 + Math.max(1, doc.splitTextToSize(`Filtros: ${filtersLabel}`, contentW).length) * 3 + 3;
  const widths = [22, 48, 45, 24, 27, 26, 27, 27, 27];
  const headers = ['Folio', 'Descripción', 'Activo / zona', 'Tipo', 'Estado', 'Creada', 'Respuesta', 'Reparación', 'Ciclo'];
  const rowData = orders.map((order) => {
    const response = order.started_at ? new Date(order.started_at).getTime() - new Date(order.created_at).getTime() : null;
    const repair = order.status === 'FINALIZADO' ? order.accumulated_time_ms : null;
    const cycle = order.completed_at ? new Date(order.completed_at).getTime() - new Date(order.created_at).getTime() : null;
    return [formatWorkOrderFolio(order.folio), order.title, `${order.asset.name}\n${order.zone?.name ?? 'Sin zona'}`, typeLabel[order.maintenance_type] ?? order.maintenance_type, statusLabel[order.status] ?? order.status, date(order.created_at), duration(response), duration(repair), duration(cycle)];
  });
  const lineHeight = 3.2;
  const paintRow = (cells: string[][], height: number, isHeading = false) => {
    let x = margin;
    cells.forEach((lines, i) => {
      doc.setFillColor(isHeading ? '#e2e8f0' : '#ffffff'); doc.setDrawColor(colors.border); doc.rect(x, y, widths[i], height, 'FD');
      lines.forEach((line, lineIndex) => text(line, x + 1.5, y + 3.3 + lineIndex * lineHeight, 6.7, isHeading || i === 0, isHeading ? colors.ink : colors.ink));
      x += widths[i];
    });
    y += height;
  };
  const drawTableHead = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.7);
    const split = headers.map((label, i) => doc.splitTextToSize(label, widths[i] - 3));
    paintRow(split, 8, true);
  };
  drawTableHead();
  for (const row of rowData) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.7);
    const lines = row.map((cell, i) => doc.splitTextToSize(cell, widths[i] - 3));
    const height = Math.max(8, Math.max(...lines.map((parts) => parts.length)) * lineHeight + 3);
    if (y + height > 197) { pageHeader(); y = 47 + Math.max(1, doc.splitTextToSize(`Filtros: ${filtersLabel}`, contentW).length) * 3 + 3; drawTableHead(); }
    paintRow(lines, height);
  }
  if (!rowData.length) { text('No hay órdenes que coincidan con los filtros seleccionados.', margin + 2, y + 8, 8, false, colors.muted); }
  footer();
  const safeName = data.technician.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  doc.save(`desempeno-${safeName || 'tecnico'}.pdf`);
}
