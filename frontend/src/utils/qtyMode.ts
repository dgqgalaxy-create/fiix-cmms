export type QtyMode = 'INTEGER' | 'DECIMAL';

export const qtyStep = (mode?: QtyMode | string | null) =>
  mode === 'DECIMAL' ? 'any' : '1';

export const qtyInputMode = (mode?: QtyMode | string | null) =>
  mode === 'DECIMAL' ? 'decimal' : 'numeric';

/** true si el valor viola el modo (p. ej. 1.5 en INTEGER). */
export function isInvalidQty(
  raw: string | number,
  mode?: QtyMode | string | null,
  opts: { allowZero?: boolean } = {}
): string | null {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return 'Cantidad inválida';
  if (opts.allowZero ? n < 0 : n <= 0) {
    return opts.allowZero ? 'Debe ser ≥ 0' : 'Debe ser mayor a 0';
  }
  if ((mode || 'INTEGER') === 'INTEGER' && !Number.isInteger(n)) {
    return 'Este artículo solo admite cantidades enteras';
  }
  return null;
}
