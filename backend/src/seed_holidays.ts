import prisma from './config/prisma';

const currentYear = new Date().getFullYear();

// Mexican holidays for the current year
const holidays = [
  { name: 'Año Nuevo', date: new Date(`${currentYear}-01-01T00:00:00.000Z`) },
  { name: 'Día de la Constitución', date: new Date(`${currentYear}-02-02T00:00:00.000Z`) }, // Aproximación
  { name: 'Natalicio de Benito Juárez', date: new Date(`${currentYear}-03-16T00:00:00.000Z`) }, // Aproximación
  { name: 'Día del Trabajo', date: new Date(`${currentYear}-05-01T00:00:00.000Z`) },
  { name: 'Día de la Independencia', date: new Date(`${currentYear}-09-16T00:00:00.000Z`) },
  { name: 'Revolución Mexicana', date: new Date(`${currentYear}-11-16T00:00:00.000Z`) }, // Aproximación
  { name: 'Transición de Poder Ejecutivo Federal', date: new Date(`${currentYear}-10-01T00:00:00.000Z`) },
  { name: 'Navidad', date: new Date(`${currentYear}-12-25T00:00:00.000Z`) },
];

async function main() {
  console.log('Seeding holidays...');
  for (const h of holidays) {
    const exists = await prisma.holiday.findFirst({
      where: { name: h.name, date: h.date }
    });
    if (!exists) {
      await prisma.holiday.create({ data: h });
      console.log(`Created holiday: ${h.name}`);
    }
  }
  console.log('Finished seeding holidays.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
