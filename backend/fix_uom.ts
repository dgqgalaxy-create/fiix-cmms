import prisma from './src/config/prisma';
async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "Item" ALTER COLUMN uom TYPE text USING uom::text');
  await prisma.$executeRawUnsafe('DROP TYPE IF EXISTS "UnitOfMeasure" CASCADE');
  console.log('Done altering UOM');
}
main().finally(() => prisma.$disconnect());
