import prisma from './src/config/prisma';

async function test() {
  try {
    const tablenames = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
    console.log(tablenames);
  } catch(e) {
    console.error(e);
  }
}
test();
