/** Legacy A–E letters still used in MTTO codes when ZoneSection.name is A–E. */
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

/** Production line zone names (stoppage KPIs). */
const PRODUCTION_LINES = new Set(['L1', 'L2', 'L3', 'L4', 'L5']);

export function isProductionLineZoneName(zoneName: string | null | undefined): boolean {
  if (!zoneName) return false;
  return PRODUCTION_LINES.has(zoneName.trim().toUpperCase());
}

/** @deprecated Prefer zone.has_sections + sections.length; kept for filters/KPIs. */
export function isSectionZoneName(zoneName: string | null | undefined): boolean {
  return isProductionLineZoneName(zoneName);
}

/** Letter used in MTTO code for section (A–E or X). */
export function sectionCodeLetter(section: string | null | undefined, _zoneName?: string | null): string {
  if (section && ASSET_SECTIONS.includes(section.trim().toUpperCase() as AssetSectionValue)) {
    return section.trim().toUpperCase();
  }
  return 'X';
}

export function zoneNeedsSections(zone: {
  has_sections?: boolean;
  sections?: { id: string; name: string }[];
} | null | undefined): boolean {
  return Boolean(zone?.has_sections && (zone.sections?.length ?? 0) > 0);
}
