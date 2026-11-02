import type { WorkOrder } from '../api/workOrders';
import { formatDateOnly, formatDateTime } from './dateUtils';
import { downloadWorkbook, excelDateStamp, type ExcelSheet } from './excelExport';
import { formatWorkOrderFolio } from './folio';

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  EN_ESPERA: 'En espera',
  FINALIZADO: 'Finalizada',
  ANULADO: 'Anulada',
};

const PRIORITY_LABELS: Record<string, string> = {
  URGENTE: 'Urgente',
  NORMAL: 'Normal',
  BAJO: 'Bajo',
};

const TYPE_LABELS: Record<string, string> = {
  SERVICIO: 'Servicio',
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
};

const GROUP_LABELS: Record<string, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  NA: 'No aplica',
};

/** Texto seguro para una celda de Excel (límite de 32,767 caracteres). */
function cellText(value: string | null | undefined, max = 32_000): string {
  const text = value || '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function periodLabel(startDate: string, endDate: string): string {
  if (startDate && endDate) return `${startDate} a ${endDate}`;
  if (startDate) return `Desde ${startDate}`;
  if (endDate) return `Hasta ${endDate}`;
  return 'Histórico completo';
}

export interface PeriodSummaryExportInput {
  startDate: string;
  endDate: string;
  /** Total mostrado en la tarjeta «Total recibidas» (sin invalidadas). */
  totalRecibidas: number;
  summary: Record<string, number>;
  pending: { urgent: number; normal: number; low: number };
  maintenance: { name: string; value: number }[];
  /** Órdenes creadas dentro del periodo seleccionado. */
  orders: WorkOrder[];
}

/**
 * Descarga el «Resumen por periodo» de Inicio en un libro .xlsx:
 * una hoja con las cifras filtradas y otra con todas las órdenes del periodo.
 */
export function exportPeriodSummaryExcel(
  data: PeriodSummaryExportInput,
  generatedAt: Date = new Date(),
): void {
  const { startDate, endDate, totalRecibidas, summary, pending, maintenance, orders } = data;
  const maintenanceTotal = maintenance.reduce((total, item) => total + item.value, 0);
  const sortedOrders = [...orders].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
      b.folio - a.folio,
  );

  const summaryRows: Record<string, string | number>[] = [
    { Concepto: 'Periodo', Valor: periodLabel(startDate, endDate) },
    { Concepto: 'Generado', Valor: formatDateTime(generatedAt) },
    { Concepto: '', Valor: '' },
    { Concepto: 'Total recibidas', Valor: totalRecibidas },
    { Concepto: 'Pendientes', Valor: summary.PENDIENTE || 0 },
    { Concepto: '  Urgentes', Valor: pending.urgent },
    { Concepto: '  Normales', Valor: pending.normal },
    { Concepto: '  Bajo', Valor: pending.low },
    { Concepto: 'En proceso', Valor: summary.EN_PROCESO || 0 },
    { Concepto: 'Pausadas', Valor: summary.EN_ESPERA || 0 },
    { Concepto: 'Finalizadas', Valor: summary.FINALIZADO || 0 },
    { Concepto: 'Invalidadas', Valor: summary.ANULADO || 0 },
    { Concepto: '', Valor: '' },
    { Concepto: 'DISTRIBUCIÓN DE MANTENIMIENTO', Valor: '' },
    ...maintenance.map((item) => ({ Concepto: item.name, Valor: item.value })),
    { Concepto: 'Total (sin invalidadas)', Valor: maintenanceTotal },
    { Concepto: '', Valor: '' },
    { Concepto: 'Órdenes incluidas', Valor: orders.length },
  ];

  const orderRows = sortedOrders.map((wo) => ({
    Folio: formatWorkOrderFolio(wo.folio),
    'Fecha de solicitud': formatDateTime(wo.created_at),
    Estado: STATUS_LABELS[wo.status] || wo.status,
    Prioridad: PRIORITY_LABELS[wo.priority] || wo.priority,
    'Tipo de mantenimiento': TYPE_LABELS[wo.maintenance_type] || wo.maintenance_type,
    Solicitante: cellText(wo.requester_name),
    Zona: wo.zone?.name || '',
    Activo: wo.asset?.name || '',
    'Código del activo': wo.asset?.internal_code || '',
    Título: cellText(wo.title),
    'Técnicos asignados': (wo.assigned_technicians || []).map((tech) => tech.name).join(', '),
    'Fecha programada': wo.scheduled_date ? formatDateOnly(wo.scheduled_date) : '',
    'Fecha límite': wo.due_date ? formatDateOnly(wo.due_date) : '',
    'Inicio de atención': wo.started_at ? formatDateTime(wo.started_at) : '',
    Finalización: wo.completed_at ? formatDateTime(wo.completed_at) : '',
    'Paro de máquina': wo.machine_stopped ? 'Sí' : 'No',
    'Grupo de producción': GROUP_LABELS[wo.production_group] || wo.production_group,
    Descripción: cellText(wo.description),
    'Notas de resolución': cellText(wo.resolution_notes),
  }));

  const sheets: ExcelSheet[] = [
    {
      name: 'Resumen',
      rows: summaryRows,
      columnWidths: [34, 26],
    },
    {
      name: 'Órdenes',
      rows: orderRows,
      columnWidths: [12, 19, 13, 11, 20, 24, 18, 30, 14, 38, 30, 15, 15, 18, 18, 14, 12, 45, 55],
    },
  ];

  const rangeTag = startDate || endDate
    ? `${startDate || 'inicio'}_${endDate || 'fin'}`
    : `historico_${excelDateStamp(generatedAt)}`;

  downloadWorkbook(`resumen_periodo_${rangeTag}.xlsx`, sheets);
}
