import { AssetSection } from '@prisma/client';

const SECTION_ZONES = new Set(['L1', 'L2', 'L3', 'L4', 'L5']);
const VALID_SECTIONS = new Set<string>(Object.values(AssetSection));

/** Exact match on trimmed zone name (case-insensitive): L1…L5. */
export function isSectionZoneName(zoneName: string | null | undefined): boolean {
  if (!zoneName) return false;
  return SECTION_ZONES.has(zoneName.trim().toUpperCase());
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
