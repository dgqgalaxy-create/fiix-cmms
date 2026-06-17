import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const workOrderCount = await prisma.workOrder.count();
  console.log(`Users: ${userCount}`);
  console.log(`Work Orders: ${workOrderCount}`);
  
  if (workOrderCount > 0) {
    const latestWO = await prisma.workOrder.findFirst({ orderBy: { created_at: 'desc' } });
    console.log('Latest WO:', latestWO);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
