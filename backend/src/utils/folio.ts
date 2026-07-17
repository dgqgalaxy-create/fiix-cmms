/** Prefijo visible e inmutable del folio de órdenes de trabajo. */
export const WORK_ORDER_FOLIO_PREFIX = 'FOL-';

export const formatWorkOrderFolio = (folio: number | null | undefined, padding = 4): string => {
  const n = Number(folio) || 0;
  return `${WORK_ORDER_FOLIO_PREFIX}${n.toString().padStart(padding, '0')}`;
};

/** Acepta FOL-0042, WO-0042, FOL42 o solo 42. */
export const parseWorkOrderFolio = (raw: string | number | null | undefined): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (raw == null) return null;
  const match = String(raw).trim().match(/^(?:FOL-|WO-)?(\d+)$/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
