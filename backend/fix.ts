import prisma from './src/config/prisma';

async function fix() {
  const locs = await prisma.itemLocation.findMany();
  const emptyLocs = locs.filter(l => !l.name.trim() || !l.internal_id.trim());
  if(emptyLocs.length === 0) {
    console.log('No empty locs');
    return;
  }
  let unassigned = locs.find(l => l.name === 'Sin Asignación');
  if(!unassigned) {
    const count = await prisma.itemLocation.count();
    const fallbackId = `LOC-${String(count + 1000).padStart(3, '0')}`;
    unassigned = await prisma.itemLocation.create({
      data: { name: 'Sin Asignación', internal_id: fallbackId }
    });
  }
  for(const el of emptyLocs) {
    await prisma.item.updateMany({
      where: { location_id: el.id },
      data: { location_id: unassigned.id }
    });
    await prisma.itemLocation.delete({ where: { id: el.id } });
    console.log('Fixed loc', el.id);
  }
}
fix().catch(console.error);
