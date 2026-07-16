import prisma from '../src/config/prisma';
import { generateInventoryCode } from '../src/utils/codeGenerator';

// El código interno de los Activos es inmutable y sigue el formato incremental
// ACT-0001, ACT-0002, ... Cualquier migración/seed de datos debe generarlo con
// generateInventoryCode() en vez de asignar códigos manuales (ej. "BMB-001").
async function upsertAssetByName(data: {
  name: string;
  brand: string;
  model: string;
  status: 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO';
  description?: string;
}) {
  const existing = await prisma.asset.findFirst({ where: { name: data.name } });
  if (existing) return existing;

  const internal_code = await generateInventoryCode('Asset', 'ACT-', 4);
  return prisma.asset.create({ data: { ...data, internal_code } });
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
