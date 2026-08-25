/**
 * Wipe total de la base de datos (equivale al botón «Borrar base de datos» de
 * Opciones de Desarrollador), útil si no puedes entrar por el candado de contraseña.
 *
 * ¡DESTRUCTIVO! Borra TODOS los datos (usuarios, activos, OTs, inventario, turnos,
 * compras, etc.) y deja solo un administrador: admin@fiix.com / password123
 * (al entrar te pedirá cambiarla).
 *
 * Se conserva: el catálogo de actividades de checklist (ChecklistActivity) y las
 * migraciones de Prisma (_prisma_migrations).
 *
 * Uso:
 *   cd ~/fiix-cmms/backend
 *   node scripts/wipe_database.js --yes
 */
require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function main() {
  const confirmed = process.argv.includes('--yes');
  if (!confirmed) {
    console.log('');
    console.log('⚠️  Esto BORRA TODA la base de datos (usuarios, activos, OTs, inventario, turnos, etc.).');
    console.log('   Se conserva el catálogo de checklist y se vuelve a crear un admin.');
    console.log('');
    console.log('   Para continuar: node scripts/wipe_database.js --yes');
    console.log('');
    return;
  }

  console.log('Borrando todas las tablas...');
  const tablenames = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklist" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "DailyChecklistRow" CASCADE;`);

  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations' && tablename !== 'ChecklistActivity') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
    }
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@fiix.com',
      password_hash: passwordHash,
      role: 'ADMINISTRADOR',
      is_active: true,
      must_change_password: true,
    },
  });

  console.log('✅ Base de datos borrada.');
  console.log('   Admin creado: admin@fiix.com / password123 (te pedirá cambiarla al entrar).');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Error:', e.message);
    return prisma.$disconnect().then(() => process.exit(1));
  });
