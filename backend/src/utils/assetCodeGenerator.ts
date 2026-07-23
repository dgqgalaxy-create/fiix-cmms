import { AssetKind, AssetSection, Prisma } from '@prisma/client';
import prisma from '../config/prisma';

/** MTTO-NNNN-S-DDD-T — S = A–E|X, T = F|C */
export const MTTO_CODE_RE = /^MTTO-(\d{4})-([A-EX])-(\d{3})-([FC])$/i;

export type ParsedMttoCode = {
  nnnn: number;
  section: string;
  ddd: number;
  kind: 'F' | 'C';
};

export function normalizeEquipmentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function parseMttoCode(code: string | null | undefined): ParsedMttoCode | null {
  if (!code) return null;
  const m = code.trim().match(MTTO_CODE_RE);
  if (!m) return null;
  return {
    nnnn: parseInt(m[1], 10),
    section: m[2].toUpperCase(),
    ddd: parseInt(m[3], 10),
    kind: m[4].toUpperCase() as 'F' | 'C',
  };
}

export function sectionLetter(section: AssetSection | null | undefined): string {
  return section ?? 'X';
}

export function kindLetter(kind: AssetKind): 'F' | 'C' {
  return kind === AssetKind.CONTROLABLE ? 'C' : 'F';
}

export function formatMttoCode(
  nnnn: number,
  section: AssetSection | null | undefined,
  ddd: number,
  kind: AssetKind
): string {
  return `MTTO-${String(nnnn).padStart(4, '0')}-${sectionLetter(section)}-${String(ddd).padStart(3, '0')}-${kindLetter(kind)}`;
}

export function normalizeAssetKind(value: unknown): AssetKind | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const upper = String(value).trim().toUpperCase();
  if (upper === 'FIJO' || upper === 'F') return AssetKind.FIJO;
  if (upper === 'CONTROLABLE' || upper === 'C') return AssetKind.CONTROLABLE;
  return null; // invalid
}

type AssetCodeRow = {
  id: string;
  name: string;
  internal_code: string;
  zone_id: string | null;
};

/** Next DDD for same normalized name + same zone (section does not reset the index). */
function nextDuplicateIndex(sameName: AssetCodeRow[], zoneId: string): number {
  const sameZone = sameName.filter((a) => a.zone_id === zoneId);
  let maxDdd = 0;
  for (const a of sameZone) {
    const parsed = parseMttoCode(a.internal_code);
    if (parsed) maxDdd = Math.max(maxDdd, parsed.ddd);
  }
  // Non-MTTO siblings (p. ej. ACT-####) also occupy a slot in the sequence.
  return Math.max(maxDdd, sameZone.length) + 1;
}

function nextGlobalNnnn(assets: AssetCodeRow[]): number {
  let maxN = 0;
  for (const a of assets) {
    const parsed = parseMttoCode(a.internal_code);
    if (parsed) maxN = Math.max(maxN, parsed.nnnn);
  }
  return maxN + 1;
}

export type GenerateAssetCodeParams = {
  name: string;
  zoneId: string;
  section: AssetSection | null;
  assetKind: AssetKind;
  /** On update: exclude self from name/zone counts. */
  excludeAssetId?: string;
  previousCode?: string;
  previousName?: string;
  previousZoneId?: string | null;
  tx?: Prisma.TransactionClient;
};

/**
 * Builds MTTO-{NNNN}-{S}-{DDD}-{T}.
 * NNNN is shared by normalized equipment name; DDD is per name+zone.
 * If only S/T change (same name+zone), NNNN and DDD are preserved.
 * If the candidate code already exists, DDD is bumped until unique.
 */
export async function generateAssetInternalCode(
  params: GenerateAssetCodeParams
): Promise<string> {
  const client = params.tx ?? prisma;
  const assets = await client.asset.findMany({
    select: { id: true, name: true, internal_code: true, zone_id: true },
  });

  const norm = normalizeEquipmentName(params.name);
  const others = assets.filter((a) => a.id !== params.excludeAssetId);
  const sameName = others.filter((a) => normalizeEquipmentName(a.name) === norm);

  let nnnn: number | null = null;
  for (const a of sameName) {
    const parsed = parseMttoCode(a.internal_code);
    if (parsed) {
      nnnn = parsed.nnnn;
      break;
    }
  }

  const nameUnchanged =
    params.previousName != null &&
    normalizeEquipmentName(params.previousName) === norm;

  if (nnnn === null && nameUnchanged) {
    const parsed = parseMttoCode(params.previousCode);
    if (parsed) nnnn = parsed.nnnn;
  }

  if (nnnn === null) {
    nnnn = nextGlobalNnnn(assets);
  }

  const zoneUnchanged =
    params.previousZoneId != null && params.previousZoneId === params.zoneId;

  let ddd: number;
  if (nameUnchanged && zoneUnchanged) {
    const parsed = parseMttoCode(params.previousCode);
    if (parsed) {
      // Solo cambió S y/o T → conservar DDD
      ddd = parsed.ddd;
    } else {
      // Era ACT-* u otro formato → asignar al esquema MTTO
      ddd = nextDuplicateIndex(sameName, params.zoneId);
    }
  } else {
    ddd = nextDuplicateIndex(sameName, params.zoneId);
  }

  const used = new Set(others.map((a) => a.internal_code.toUpperCase()));
  let code = formatMttoCode(nnnn, params.section, ddd, params.assetKind);
  while (used.has(code.toUpperCase())) {
    ddd += 1;
    code = formatMttoCode(nnnn, params.section, ddd, params.assetKind);
  }
  return code;
}
