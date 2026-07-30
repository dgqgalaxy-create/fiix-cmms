/**
 * Maps Fiix inventory Location names to Asset module Zone names.
 * e.g. "LINEA 1 ACTIVOS" → "L1", "TAPANCO" → "TAPANCO"
 */

/** Strip accents, collapse whitespace, uppercase for matching. */
export function normalizeLocationKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Inventory location → Asset zone name.
 * - LINEA N ACTIVOS (accents/spaces/# flexible) → LN (N = 1–5)
 * - TAPANCO → TAPANCO
 * - empty → Sin Zona
 * - other names kept as trimmed original (e.g. TALLER)
 */
export function mapInventoryLocationToAssetZone(
  locationName: string | null | undefined
): string {
  const raw = (locationName ?? '').trim();
  if (!raw) return 'Sin Zona';

  const norm = normalizeLocationKey(raw);

  if (norm === 'TAPANCO' || /^TAPANCO\b/.test(norm)) {
    return 'TAPANCO';
  }

  // LINEA 1 ACTIVOS | LÍNEA #2 ACTIVOS | LINEA3 ACTIVO | LINEA 4
  const linea =
    norm.match(/^LINEA\s*#?\s*([1-5])(?:\s+ACTIVOS?)?$/) ||
    norm.match(/^LINEA\s*#?\s*([1-5])\s+ACTIVOS?$/);
  if (linea) {
    return `L${linea[1]}`;
  }

  // Already short form L1…L5
  if (/^L[1-5]$/.test(norm)) {
    return norm;
  }

  return raw;
}

export function isProductionLineZone(zoneName: string): boolean {
  return /^L[1-5]$/i.test(zoneName.trim());
}

/** Category names that mean the item should also exist in Activos. */
export function isActivosCategoryName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = normalizeLocationKey(name);
  return n === 'ACTIVOS' || n === 'ACTIVO';
}
