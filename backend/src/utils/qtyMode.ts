export type QtyMode = 'INTEGER' | 'DECIMAL';

/** Valida cantidad según modo del ítem. `allowZero` para stock/mínimo iniciales. */
export function parseQty(
  raw: unknown,
  mode: QtyMode | string | null | undefined,
  opts: { allowZero?: boolean; fieldLabel?: string } = {}
): { ok: true; value: number } | { ok: false; error: string } {
  const label = opts.fieldLabel || 'La cantidad';
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} debe ser un número válido` };
  }
  if (opts.allowZero ? n < 0 : n <= 0) {
    return {
      ok: false,
      error: opts.allowZero
        ? `${label} debe ser mayor o igual a 0`
        : `${label} debe ser mayor a 0`,
    };
  }
  const isIntegerMode = (mode || 'INTEGER') === 'INTEGER';
  if (isIntegerMode && !Number.isInteger(n)) {
    return {
      ok: false,
      error: `${label} debe ser un número entero (este artículo no admite decimales)`,
    };
  }
  return { ok: true, value: n };
}

export function assertQtyOrThrow(
  raw: unknown,
  mode: QtyMode | string | null | undefined,
  opts?: { allowZero?: boolean; fieldLabel?: string }
): number {
  const r = parseQty(raw, mode, opts);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
