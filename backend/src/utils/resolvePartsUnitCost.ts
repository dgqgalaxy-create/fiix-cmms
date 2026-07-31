/** Resolves unit cost for WO parts consumption (snapshot + catalog recovery). */
export type PartsCostTx = {
  unit_cost?: number | null;
  item?: { purchase_cost?: number | null } | null;
};

/**
 * - unit_cost null → catalog purchase_cost
 * - unit_cost === 0 and catalog > 0 → catalog (recover frozen zeros from old closes)
 * - otherwise → unit_cost
 */
export function resolvePartsUnitCost(tx: PartsCostTx): number {
  const catalog = tx.item?.purchase_cost ?? null;
  if (tx.unit_cost == null) return catalog ?? 0;
  if (tx.unit_cost === 0 && catalog != null && catalog > 0) return catalog;
  return tx.unit_cost;
}
