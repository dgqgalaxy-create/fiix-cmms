/** Exact match on trimmed zone name (case-insensitive): L1…L5. */
export const ASSET_SECTIONS = ['A', 'B', 'C', 'D', 'E'] as const;
export type AssetSectionValue = (typeof ASSET_SECTIONS)[number];

export const ASSET_KINDS = ['FIJO', 'CONTROLABLE'] as const;
export type AssetKindValue = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_LABELS: Record<AssetKindValue, string> = {
  FIJO: 'Activo fijo',
  CONTROLABLE: 'Controlable',
};

export function assetKindLetter(kind: AssetKindValue | null | undefined): 'F' | 'C' | '?' {
  if (kind === 'CONTROLABLE') return 'C';
  if (kind === 'FIJO') return 'F';
  return '?';
}

const SECTION_ZONES = new Set(['L1', 'L2', 'L3', 'L4', 'L5']);

export function isSectionZoneName(zoneName: string | null | undefined): boolean {
  if (!zoneName) return false;
  return SECTION_ZONES.has(zoneName.trim().toUpperCase());
}

/** Letter used in MTTO code for section (A–E or X). */
export function sectionCodeLetter(section: string | null | undefined, zoneName?: string | null): string {
  if (section && ASSET_SECTIONS.includes(section as AssetSectionValue)) return section;
  if (zoneName && isSectionZoneName(zoneName) && section) return section;
  return 'X';
}
