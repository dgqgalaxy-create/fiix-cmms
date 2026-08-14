/** Desglose de IVA sobre un subtotal (precios sin impuesto). */
export type PoTaxBreakdown = {
  subtotal: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
};

export function normalizeIvaPercent(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 100) / 100;
}

export function poTaxBreakdown(subtotal: number, ivaPercent: unknown): PoTaxBreakdown {
  const pct = normalizeIvaPercent(ivaPercent);
  const base = Number.isFinite(subtotal) ? subtotal : 0;
  const ivaAmount = Math.round(base * (pct / 100) * 100) / 100;
  const total = Math.round((base + ivaAmount) * 100) / 100;
  return { subtotal: base, ivaPercent: pct, ivaAmount, total };
}
