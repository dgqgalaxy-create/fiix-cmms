import prisma from '../config/prisma';

export const ASSET_CODE_PREFIX = 'ACT-';
export const ASSET_CODE_PADDING = 4;
const ACT_CODE_REGEX = /^ACT-\d+$/;

export type AssetCodeMapping = {
  id: string;
  name: string;
  old_code: string;
  new_code: string;
  changed: boolean;
};

export type AssetCodeMigrationResult = {
  total: number;
  to_change: number;
  unchanged: number;
  already_compliant: number;
  mappings: AssetCodeMapping[];
};

function formatActCode(num: number): string {
  return `${ASSET_CODE_PREFIX}${num.toString().padStart(ASSET_CODE_PADDING, '0')}`;
}

/**
 * Planifica la migración de códigos internos de activos al formato ACT-0001.
 * Conserva los códigos ya conformes (`ACT-N`) y reasigna el resto de forma
 * incremental a partir del máximo ACT existente, en orden estable
 * (created_at ASC, luego name ASC).
 */
export async function planAssetCodeMigration(): Promise<AssetCodeMigrationResult> {
  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      name: true,
      internal_code: true,
      created_at: true,
    },
    orderBy: [{ created_at: 'asc' }, { name: 'asc' }],
  });

  const compliant = assets.filter((a) => ACT_CODE_REGEX.test(a.internal_code));
  const nonCompliant = assets.filter((a) => !ACT_CODE_REGEX.test(a.internal_code));

  let maxAct = 0;
  for (const asset of compliant) {
    const num = parseInt(asset.internal_code.replace(ASSET_CODE_PREFIX, ''), 10);
    if (!isNaN(num) && num > maxAct) maxAct = num;
  }

  const mappings: AssetCodeMapping[] = [];

  for (const asset of compliant) {
    mappings.push({
      id: asset.id,
      name: asset.name,
      old_code: asset.internal_code,
      new_code: asset.internal_code,
      changed: false,
    });
  }

  let nextNum = maxAct;
  for (const asset of nonCompliant) {
    nextNum += 1;
    const newCode = formatActCode(nextNum);
    mappings.push({
      id: asset.id,
      name: asset.name,
      old_code: asset.internal_code,
      new_code: newCode,
      changed: asset.internal_code !== newCode,
    });
  }

  // Ordenar mapping por new_code para lectura humana
  mappings.sort((a, b) => a.new_code.localeCompare(b.new_code, undefined, { numeric: true }));

  const toChange = mappings.filter((m) => m.changed).length;

  return {
    total: assets.length,
    to_change: toChange,
    unchanged: assets.length - toChange,
    already_compliant: compliant.length,
    mappings,
  };
}

/**
 * Ejecuta la migración en dos fases para evitar colisiones del índice único
 * de `internal_code`.
 */
export async function executeAssetCodeMigration(): Promise<AssetCodeMigrationResult> {
  const plan = await planAssetCodeMigration();
  const changes = plan.mappings.filter((m) => m.changed);

  if (changes.length === 0) {
    return plan;
  }

  await prisma.$transaction(async (tx) => {
    // Fase 1: códigos temporales únicos
    for (const change of changes) {
      await tx.asset.update({
        where: { id: change.id },
        data: { internal_code: `TMP-MIG-${change.id}` },
      });
    }

    // Fase 2: códigos finales ACT-XXXX
    for (const change of changes) {
      await tx.asset.update({
        where: { id: change.id },
        data: { internal_code: change.new_code },
      });
    }
  });

  return plan;
}
