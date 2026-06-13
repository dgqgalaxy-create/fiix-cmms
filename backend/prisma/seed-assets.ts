import prisma from '../src/config/prisma';

async function main() {
  const asset1 = await prisma.asset.upsert({
    where: { internal_code: 'BMB-001' },
    update: {},
    create: {
      internal_code: 'BMB-001',
      name: 'Bomba Centrífuga Principal',
      brand: 'Goulds',
      model: '3196',
      status: 'OPERATIVO',
      description: 'Bomba de agua principal para la torre de enfriamiento',
    },
  });

  const asset2 = await prisma.asset.upsert({
    where: { internal_code: 'MTR-042' },
    update: {},
    create: {
      internal_code: 'MTR-042',
      name: 'Motor Eléctrico 50HP',
      brand: 'Siemens',
      model: '1LA7',
      status: 'EN_MANTENIMIENTO',
      description: 'Motor de repuesto / línea B',
    },
  });

  const asset3 = await prisma.asset.upsert({
    where: { internal_code: 'HVAC-01' },
    update: {},
    create: {
      internal_code: 'HVAC-01',
      name: 'Unidad de Aire Acondicionado Central',
      brand: 'Carrier',
      model: 'WeatherMaker',
      status: 'OPERATIVO',
    },
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
