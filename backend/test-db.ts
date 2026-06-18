import prisma from './src/config/prisma';
async function test() {
  const items = await prisma.item.findMany();
  console.log(items);
}
test();
