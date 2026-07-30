import { AssetSection } from '@prisma/client';

/** Production lines used for stoppage / streak indicators on Home. */
export const PRODUCTION_LINES = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;
export type ProductionLine = (typeof PRODUCTION_LINES)[number];

const SECTION_ZONES = new Set<string>(PRODUCTION_LINES);
const VALID_SECTIONS = new Set<string>(Object.values(AssetSection));

/** Exact match on trimmed zone name (case-insensitive): L1…L5. */
export function isSectionZoneName(zoneName: string | null | undefined): boolean {
  if (!zoneName) return false;
  return SECTION_ZONES.has(zoneName.trim().toUpperCase());
}

/** Returns L1–L5 if the zone name matches a production line; otherwise null. */
export function resolveProductionLine(zoneName: string | null | undefined): ProductionLine | null {
  if (!zoneName) return null;
  const upper = zoneName.trim().toUpperCase();
  return SECTION_ZONES.has(upper) ? (upper as ProductionLine) : null;
}

export function normalizeAssetSection(
  value: unknown
): AssetSection | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const upper = String(value).trim().toUpperCase();
  if (VALID_SECTIONS.has(upper)) return upper as AssetSection;
  return undefined; // invalid
}

/**
 * Resolves section for create/update given the target zone name.
 * - L1–L5: section required (A–E)
 * - other zones: forces null
 * Returns { section } or { error }.
 */
export function resolveAssetSection(params: {
  zoneName: string | null | undefined;
  sectionInput: unknown;
  /** On update, if sectionInput is undefined, keep existing (unless zone no longer needs it). */
  existingSection?: AssetSection | null;
  isUpdate?: boolean;
}): { section: AssetSection | null } | { error: string } {
  const needsSection = isSectionZoneName(params.zoneName);

  if (!needsSection) {
    return { section: null };
  }

  let resolved: AssetSection | null | undefined;
  if (params.sectionInput !== undefined) {
    resolved = normalizeAssetSection(params.sectionInput);
    if (resolved === undefined) {
      return { error: 'La sección debe ser A, B, C, D o E' };
    }
  } else if (params.isUpdate) {
    resolved = params.existingSection ?? null;
  } else {
    resolved = null;
  }

  if (!resolved) {
    return { error: 'La sección (A–E) es obligatoria para zonas L1–L5' };
  }

  return { section: resolved };
}
