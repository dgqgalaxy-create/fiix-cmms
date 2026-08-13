/**
 * One-off: invent local Purchase Orders for Compras UI testing.
 * Uses DATABASE_URL from backend/.env (localhost). Does not delete data.
 */
import 'dotenv/config';
import prisma from '../src/config/prisma';

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

function pick<T>(arr: T[], n: number, offset: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(offset + i) % arr.length]);
  return out;
}

async function main() {
  const hostHint = process.env.DATABASE_URL || '';
  if (!/localhost|127\.0\.0\.1/i.test(hostHint)) {
    throw new Error('Refusing to seed: DATABASE_URL is not localhost');
  }

  let vendors = await prisma.vendor.findMany({
    where: { is_active: true },
    take: 20,
    orderBy: { name: 'asc' },
  });
  let items = await prisma.item.findMany({
    where: { is_active: true },
    take: 80,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      vendor_id: true,
      purchase_cost: true,
    },
  });
  const user =
    (await prisma.user.findFirst({
      where: { role: 'ADMINISTRADOR', is_active: true },
    })) || (await prisma.user.findFirst({ where: { is_active: true } }));

  if (!user) {
    throw new Error('No users in local DB');
  }

  if (vendors.length === 0) {
    vendors = [
      await prisma.vendor.create({
        data: { internal_id: 'TEST-V001', name: 'Proveedor Demo Alfa' },
      }),
      await prisma.vendor.create({
        data: { internal_id: 'TEST-V002', name: 'Proveedor Demo Beta' },
      }),
    ];
    console.log('Created dummy vendors');
  }

  if (items.length === 0) {
    items = await Promise.all(
      [
        { code: 'TEST-IT-001', name: 'Filtro hidráulico demo', cost: 850 },
        { code: 'TEST-IT-002', name: 'Aceite ISO 68 demo', cost: 420 },
        { code: 'TEST-IT-003', name: 'Rodamiento 6205 demo', cost: 210 },
        { code: 'TEST-IT-004', name: 'Sello mecánico demo', cost: 1350 },
        { code: 'TEST-IT-005', name: 'Correa dentada demo', cost: 390 },
      ].map((row, i) =>
        prisma.item.create({
          data: {
            internal_code: row.code,
            name: row.name,
            uom: 'PZA',
            purchase_cost: row.cost,
            vendor_id: vendors[i % vendors.length].id,
          },
          select: { id: true, name: true, vendor_id: true, purchase_cost: true },
        })
      )
    );
    console.log('Created dummy items');
  }

  const statuses = [
    'BORRADOR',
    'BORRADOR',
    'APROBADA',
    'APROBADA',
    'APROBADA',
    'ENVIADA',
    'ENVIADA',
    'ENVIADA',
    'RECIBIDA',
    'BORRADOR',
  ] as const;

  const created: { folio: number; status: string; sap_sp: string | null; sap_oc: string | null }[] =
    [];

  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const vendor = vendors[i % vendors.length];
    const vendorItems = items.filter((it) => it.vendor_id === vendor.id);
    const pool = vendorItems.length >= 2 ? vendorItems : items;
    const nLines = 2 + (i % 4); // 2–5
    const lines = pick(pool, nLines, i * 3).map((it, li) => {
      const qty = 2 + ((i + li) % 8);
      const unit = it.purchase_cost && it.purchase_cost > 0 ? it.purchase_cost : 100 + i * 15 + li * 7;
      return {
        item_id: it.id,
        quantity: qty,
        unit_cost: Math.round(unit * 100) / 100,
        received_quantity: status === 'RECIBIDA' ? qty : undefined,
      };
    });

    const withSap = status !== 'BORRADOR';
    const sapSp = withSap ? `SP-4500${123 + i}` : i % 3 === 0 ? `SP-4500${200 + i}` : null;
    const sapOc = status === 'ENVIADA' || status === 'RECIBIDA' ? `450000${1234 + i}` : null;

    const po = await prisma.purchaseOrder.create({
      data: {
        vendor_id: vendor.id,
        created_by_id: user.id,
        status,
        expected_date: daysFromNow(7 + i * 2),
        sap_sp_folio: sapSp,
        sap_oc_folio: sapOc,
        received_at: status === 'RECIBIDA' ? new Date() : null,
        items: {
          create: lines.map(({ item_id, quantity, unit_cost, received_quantity }) => ({
            item_id,
            quantity,
            unit_cost,
            received_quantity: received_quantity ?? null,
          })),
        },
      },
      select: { folio: true, status: true, sap_sp_folio: true, sap_oc_folio: true },
    });

    created.push({
      folio: po.folio,
      status: po.status,
      sap_sp: po.sap_sp_folio,
      sap_oc: po.sap_oc_folio,
    });
  }

  const total = await prisma.purchaseOrder.count();
  console.log(JSON.stringify({ created_count: created.length, total_pos: total, created }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
