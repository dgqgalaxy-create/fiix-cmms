import prisma from './src/config/prisma';
prisma.asset.count().then(c => console.log('DB ASSET COUNT:', c)).catch(console.error);
