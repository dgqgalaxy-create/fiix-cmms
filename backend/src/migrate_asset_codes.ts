/**
 * Migración CLI: códigos internos de activos → formato ACT-0001.
 *
 * Uso:
 *   npx ts-node src/migrate_asset_codes.ts           # vista previa (dry-run)
 *   npx ts-node src/migrate_asset_codes.ts --apply   # aplica cambios
 */
import prisma from './config/prisma';
import {
  executeAssetCodeMigration,
  planAssetCodeMigration,
} from './utils/migrateAssetCodes';

async function main() {
  const apply = process.argv.includes('--apply');

  if (!apply) {
    const plan = await planAssetCodeMigration();
    console.log('=== Vista previa (sin cambios) ===');
    console.log(`Total activos: ${plan.total}`);
    console.log(`Ya conformes (ACT-): ${plan.already_compliant}`);
    console.log(`A migrar: ${plan.to_change}`);
    console.log(`Sin cambio: ${plan.unchanged}`);
    console.log('\nMapa (muestra hasta 20):');
    for (const row of plan.mappings.filter((m) => m.changed).slice(0, 20)) {
      console.log(`  ${row.old_code}  →  ${row.new_code}  |  ${row.name}`);
    }
    if (plan.to_change > 20) {
      console.log(`  ... y ${plan.to_change - 20} más`);
    }
    console.log('\nPara aplicar: npx ts-node src/migrate_asset_codes.ts --apply');
    return;
  }

  console.log('Aplicando migración de códigos de activos...');
  const result = await executeAssetCodeMigration();
  console.log(`Listo. Migrados: ${result.to_change} de ${result.total}`);
  for (const row of result.mappings.filter((m) => m.changed)) {
    console.log(`  ${row.old_code}  →  ${row.new_code}  |  ${row.name}`);
  }
}

main()
  .catch((error) => {
    console.error('Error en migración de códigos de activos:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
