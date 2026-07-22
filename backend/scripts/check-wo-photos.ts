import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';

async function main() {
  const withBefore = await prisma.workOrder.count({
    where: { before_image_url: { not: null } },
  });
  const withAfter = await prisma.workOrder.count({
    where: { after_image_url: { not: null } },
  });
  const withReq = await prisma.workOrder.count({
    where: { request_image_url: { not: null } },
  });
  const totalWO = await prisma.workOrder.count();
  const sample = await prisma.workOrder.findMany({
    where: {
      OR: [{ before_image_url: { not: null } }, { after_image_url: { not: null } }],
    },
    select: {
      folio: true,
      status: true,
      before_image_url: true,
      after_image_url: true,
      request_image_url: true,
    },
    take: 8,
    orderBy: { folio: 'asc' },
  });

  const uploadRoot = path.join(__dirname, '../uploads');
  const checks = sample.map((s) => {
    const urls = [s.before_image_url, s.after_image_url, s.request_image_url].filter(
      Boolean
    ) as string[];
    return {
      folio: s.folio,
      status: s.status,
      filesExist: urls.map((u) => {
        const rel = u.replace(/^\/uploads\//, '');
        const full = path.join(uploadRoot, rel);
        return { u, exists: fs.existsSync(full) };
      }),
    };
  });

  console.log(JSON.stringify({ withBefore, withAfter, withReq, totalWO, checks }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
