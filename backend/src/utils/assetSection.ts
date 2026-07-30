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

/** Sync MTTO letter A–E from ZoneSection.name when it is exactly A–E; else null → X. */
export function sectionEnumFromName(name: string | null | undefined): AssetSection | null {
  if (!name) return null;
  const upper = name.trim().toUpperCase();
  if (VALID_SECTIONS.has(upper)) return upper as AssetSection;
  return null;
}

export type ZoneForSection = {
  id: string;
  name: string;
  has_sections: boolean;
  sections: { id: string; name: string }[];
};

/**
 * Resolves zone_section_id + legacy AssetSection for create/update.
 * - has_sections=false or no section rows → null (Sin sección)
 * - has_sections with rows → zone_section_id required (or legacy A–E name match)
 */
export function resolveAssetZoneSection(params: {
  zone: ZoneForSection;
  zoneSectionIdInput: unknown;
  /** Legacy: A–E string from older clients. */
  sectionInput?: unknown;
  existingZoneSectionId?: string | null;
  existingSection?: AssetSection | null;
  isUpdate?: boolean;
}): { zone_section_id: string | null; section: AssetSection | null } | { error: string } {
  const { zone } = params;
  const configured = zone.has_sections && zone.sections.length > 0;

  if (!configured) {
    return { zone_section_id: null, section: null };
  }

  let zoneSectionId: string | null | undefined;

  if (params.zoneSectionIdInput !== undefined) {
    if (params.zoneSectionIdInput === null || params.zoneSectionIdInput === '') {
      zoneSectionId = null;
    } else {
      const id = String(params.zoneSectionIdInput).trim();
      const found = zone.sections.find((s) => s.id === id);
      if (!found) {
        return { error: 'La sección no pertenece a la zona seleccionada' };
      }
      zoneSectionId = found.id;
    }
  } else if (params.sectionInput !== undefined) {
    // Legacy path: match by A–E name
    if (params.sectionInput === null || params.sectionInput === '') {
      zoneSectionId = null;
    } else {
      const letter = normalizeAssetSection(params.sectionInput);
      if (letter === undefined) {
        return { error: 'La sección indicada no es válida' };
      }
      if (letter === null) {
        zoneSectionId = null;
      } else {
        const found = zone.sections.find(
          (s) => s.name.trim().toUpperCase() === letter
        );
        if (!found) {
          return { error: `No existe la sección «${letter}» en esta zona` };
        }
        zoneSectionId = found.id;
      }
    }
  } else if (params.isUpdate) {
    zoneSectionId = params.existingZoneSectionId ?? null;
    if (zoneSectionId) {
      const stillValid = zone.sections.some((s) => s.id === zoneSectionId);
      if (!stillValid) zoneSectionId = null;
    }
  } else {
    zoneSectionId = null;
  }

  if (!zoneSectionId) {
    return { error: 'Debes seleccionar una sección de la zona' };
  }

  const matched = zone.sections.find((s) => s.id === zoneSectionId)!;
  return {
    zone_section_id: zoneSectionId,
    section: sectionEnumFromName(matched.name),
  };
}

/**
 * @deprecated Prefer resolveAssetZoneSection. Kept for callers that only had zone name + A–E.
 */
export function resolveAssetSection(params: {
  zoneName: string | null | undefined;
  sectionInput: unknown;
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
