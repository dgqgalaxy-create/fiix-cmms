export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

/** Map common CMMS statuses to badge tones */
export const statusTone = (status: string): BadgeTone => {
  const s = status.toUpperCase();
  if (['FINALIZADO', 'COMPLETADO', 'APROBADO', 'OPERATIVO', 'ACTIVO'].some((x) => s.includes(x))) return 'success';
  if (['PENDIENTE', 'PROGRAMADO', 'BORRADOR'].some((x) => s.includes(x))) return 'warning';
  if (['EN_PROCESO', 'EN PROCESO', 'PROCESO'].some((x) => s.includes(x))) return 'info';
  if (['ANULADO', 'CANCELADO', 'FUERA', 'CRITICO', 'URGENTE'].some((x) => s.includes(x))) return 'danger';
  if (['ESPERA', 'PAUSA'].some((x) => s.includes(x))) return 'warning';
  return 'neutral';
};
