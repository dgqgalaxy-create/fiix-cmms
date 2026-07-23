import prisma from '../src/config/prisma';
import { generateAssetInternalCode } from '../src/utils/assetCodeGenerator';
import { AssetKind } from '@prisma/client';

// Código interno: MTTO-NNNN-S-DDD-T (generado automáticamente).
async function upsertAssetByName(data: {
  name: string;
  brand: string;
  model: string;
  status: 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO';
  description?: string;
}) {
  const existing = await prisma.asset.findFirst({ where: { name: data.name } });
  if (existing) return existing;

  // Seed sin zona: usa una zona placeholder o la primera disponible.
  let zone = await prisma.zone.findFirst({ orderBy: { name: 'asc' } });
  if (!zone) {
    zone = await prisma.zone.create({ data: { name: 'SIN ZONA' } });
  }

  const internal_code = await generateAssetInternalCode({
    name: data.name,
    zoneId: zone.id,
    section: null,
    assetKind: AssetKind.FIJO,
  });
  return prisma.asset.create({
    data: {
      ...data,
      internal_code,
      asset_kind: AssetKind.FIJO,
      zone_id: zone.id,
    },
  });
}

async function main() {
  const asset1 = await upsertAssetByName({
    name: 'Bomba Centrífuga Principal',
    brand: 'Goulds',
    model: '3196',
    status: 'OPERATIVO',
    description: 'Bomba de agua principal para la torre de enfriamiento',
  });

  const asset2 = await upsertAssetByName({
    name: 'Motor Eléctrico 50HP',
    brand: 'Siemens',
    model: '1LA7',
    status: 'EN_MANTENIMIENTO',
    description: 'Motor de repuesto / línea B',
  });

  const asset3 = await upsertAssetByName({
    name: 'Unidad de Aire Acondicionado Central',
    brand: 'Carrier',
    model: 'WeatherMaker',
    status: 'OPERATIVO',
  });

  console.log('Activos inyectados con éxito:', { asset1: asset1.name, asset2: asset2.name, asset3: asset3.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
