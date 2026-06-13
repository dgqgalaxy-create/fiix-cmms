import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma';

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@fiix.com' },
    update: {},
    create: {
      email: 'admin@fiix.com',
      name: 'Admin User',
      password_hash: passwordHash,
      role: 'ADMINISTRADOR',
    },
  });

  const gestionador = await prisma.user.upsert({
    where: { email: 'gestionador@fiix.com' },
    update: {},
    create: {
      email: 'gestionador@fiix.com',
      name: 'Gestionador User',
      password_hash: passwordHash,
      role: 'GESTIONADOR',
    },
  });

  const tecnico = await prisma.user.upsert({
    where: { email: 'tecnico@fiix.com' },
    update: {},
    create: {
      email: 'tecnico@fiix.com',
      name: 'Tecnico User',
      password_hash: passwordHash,
      role: 'TECNICO',
    },
  });

  console.log('Seed exitoso:', { admin, gestionador, tecnico });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
