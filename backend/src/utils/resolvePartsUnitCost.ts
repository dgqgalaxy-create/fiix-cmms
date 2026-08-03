/** Unit cost for WO parts / inventory consumption lines. */
export type PartsCostTx = {
  unit_cost?: number | null;
  item?: { purchase_cost?: number | null } | null;
};

export type ResolvePartsCostOptions = {
  /**
   * Solo para previsualización (p. ej. antes de cerrar).
   * En histórico / OT cerrada / KPI / activo: dejar en false (congelado).
   */
  allowCatalogFallback?: boolean;
};

/**
 * Costo unitario para reportes e histórico.
 * Por defecto usa solo el snapshot (`unit_cost`); `null` → 0 (congelado sin precio al cerrar).
 * Con `allowCatalogFallback: true` puede leer el catálogo actual (solo preview).
 *
 * Semántica del snapshot:
 * - número > 0 → precio congelado al consumir/cerrar
 * - 0 → congelado en cero (sin costo de catálogo o costo cero real al momento del cierre)
 * - null (legado) → se trata como 0 tras migración; ya no se relee el catálogo
 */
export function resolvePartsUnitCost(
  tx: PartsCostTx,
  opts?: ResolvePartsCostOptions
): number {
  if (opts?.allowCatalogFallback) {
    const catalog = tx.item?.purchase_cost ?? null;
    if (tx.unit_cost == null) return catalog ?? 0;
    if (tx.unit_cost === 0 && catalog != null && catalog > 0) return catalog;
    return tx.unit_cost;
  }
  return tx.unit_cost ?? 0;
}

/** Precio de lista actual del catálogo (preview; no usar en históricos). */
export function previewCatalogUnitCost(
  item: { purchase_cost?: number | null } | null | undefined
): number {
  const n = item?.purchase_cost;
  return n != null && Number.isFinite(n) ? n : 0;
}
