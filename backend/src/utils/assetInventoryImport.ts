import { AssetKind, AssetStatus, Prisma } from '@prisma/client';
import defaultPrisma from '../config/prisma';
const prisma = defaultPrisma;
import { generateAssetInternalCode } from './assetCodeGenerator';
import {
  isActivosCategoryName,
  isProductionLineZone,
  mapInventoryLocationToAssetZone,
} from './inventoryLocationToZone';

const LINE_SECTIONS = ['A', 'B', 'C', 'D', 'E'] as const;

export type AssetInventoryImportResult = {
  created: number;
  updated: number;
  skipped: number;
  zonesEnsured: string[];
};

type DbClient = Prisma.TransactionClient | typeof prisma;

/**
 * Ensure zone exists with sensible has_sections:
 * - L1–L5: has_sections true + sections A–E (create missing)
 * - TAPANCO / others: has_sections false unless already configured
 */
export async function ensureZoneForAssetImport(
  zoneName: string,
  client: DbClient = prisma
): Promise<{ id: string; name: string }> {
  const raw = zoneName.trim() || 'Sin Zona';
  const isLine = isProductionLineZone(raw);
  const canonical = isLine ? raw.toUpperCase() : raw;

  const all = await client.zone.findMany({
    select: { id: true, name: true, has_sections: true },
  });
  let zone = all.find((z) => z.name.trim().toUpperCase() === canonical.toUpperCase());

  if (!zone) {
    zone = await client.zone.create({
      data: {
        name: canonical,
        has_sections: isLine,
      },
    });
  } else {
    const updates: { name?: string; has_sections?: boolean } = {};
    if (isLine && zone.name !== canonical) updates.name = canonical;
    if (isLine && !zone.has_sections) updates.has_sections = true;
    if (Object.keys(updates).length > 0) {
      zone = await client.zone.update({
        where: { id: zone.id },
        data: updates,
      });
    }
  }

  if (isLine) {
    for (const sec of LINE_SECTIONS) {
      await client.zoneSection.upsert({
        where: {
          zone_id_name: { zone_id: zone.id, name: sec },
        },
        update: {},
        create: { zone_id: zone.id, name: sec },
      });
    }
  }

  return { id: zone.id, name: zone.name };
}

/**
 * After Items CSV upsert: create/update Asset rows for every inventory item
 * whose category is Activo/Activos. Does not delete Item rows.
 *
 * Match by exact asset name only (same as Solicitudes Equipo:).
 * Do NOT use Item ID (Fiix MTTO-####) as Asset.internal_code — that code is for
 * inventory; new assets always get generateAssetInternalCode (MTTO-NNNN-S-DDD-T).
 * Section left null (Sin sección / letra X) — inventory CSV has no section column.
 * Photos are assigned later from the Items_Images zip → uploads/assets/.
 */
export async function syncAssetsFromActivosInventory(prisma: DbClient = defaultPrisma): Promise<AssetInventoryImportResult> {
  const result: AssetInventoryImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    zonesEnsured: [],
  };

  const categories = await prisma.itemCategory.findMany();
  const activoCatIds = new Set(
    categories.filter((c) => isActivosCategoryName(c.name)).map((c) => c.id)
  );
  if (activoCatIds.size === 0) {
    return result;
  }

  const items = await prisma.item.findMany({
    where: { category_id: { in: [...activoCatIds] } },
    include: { location: true },
  });

  const zoneCache = new Map<string, { id: string; name: string }>();
  const ensured = new Set<string>();

  async function zoneForLocation(locName: string | null | undefined) {
    const zoneName = mapInventoryLocationToAssetZone(locName);
    const key = zoneName.toUpperCase();
    let z = zoneCache.get(key);
    if (!z) {
      z = await ensureZoneForAssetImport(zoneName, prisma);
      zoneCache.set(key, z);
      if (!ensured.has(z.name)) {
        ensured.add(z.name);
        result.zonesEnsured.push(z.name);
      }
    }
    return z;
  }

  for (const item of items) {
    const assetName = (item.name || '').trim();
    if (!assetName) {
      result.skipped++;
      continue;
    }

    try {
      const zone = await zoneForLocation(item.location?.name);

      // Solo por nombre exacto — nunca sobrescribir internal_code con Item ID Fiix.
      const existing = await prisma.asset.findFirst({ where: { name: assetName } });

      if (existing) {
        const zoneChanged = existing.zone_id !== zone.id;
        await prisma.asset.update({
          where: { id: existing.id },
          data: {
            zone_id: zone.id,
            ...(zoneChanged
              ? { zone_section_id: null, section: null }
              : {}),
            description: item.description ?? existing.description,
            vendor_id: item.vendor_id ?? existing.vendor_id,
            price: item.purchase_cost ?? existing.price,
            brand: existing.brand || 'N/A',
            model: existing.model || 'N/A',
            // image_url: lo asigna el zip Items_Images → uploads/assets/
          },
        });
        result.updated++;
      } else {
        const internal_code = await generateAssetInternalCode({
          tx: prisma,
          name: assetName,
          zoneId: zone.id,
          section: null,
          assetKind: AssetKind.FIJO,
        });

        await prisma.asset.create({
          data: {
            internal_code,
            name: assetName,
            brand: 'N/A',
            model: 'N/A',
            description: item.description || null,
            status: AssetStatus.OPERATIVO,
            asset_kind: AssetKind.FIJO,
            section: null,
            zone_section_id: null,
            zone_id: zone.id,
            vendor_id: item.vendor_id || null,
            price: item.purchase_cost ?? null,
          },
        });
        result.created++;
      }
    } catch (e) {
      if (prisma !== defaultPrisma) throw e;
      console.error('Asset inventory import row error', item.internal_code, e);
      result.skipped++;
    }
  }

  return result;
}
