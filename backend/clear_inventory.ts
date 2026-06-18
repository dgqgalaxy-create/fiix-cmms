import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("⚠️  Iniciando el borrado de la base de datos de inventario...");

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Borrar dependencias directas de Items (Repuestos)
      console.log("Borrando transacciones de inventario...");
      await tx.inventoryTransaction.deleteMany({});

      console.log("Borrando refacciones asignadas a planes preventivos (PlanItem)...");
      await tx.planItem.deleteMany({});

      console.log("Borrando partidas de órdenes de compra (PurchaseOrderItem)...");
      await tx.purchaseOrderItem.deleteMany({});

      // Si también quieres borrar las Órdenes de Compra completas, descomenta esta línea:
      // console.log("Borrando Órdenes de Compra...");
      // await tx.purchaseOrder.deleteMany({});

      // 2. Borrar el catálogo principal de Items
      console.log("Borrando catálogo de repuestos (Items)...");
      await tx.item.deleteMany({});

      // 3. Opcional: Borrar catálogos base (Categorías, Ubicaciones, Proveedores)
      // Si solo querías borrar los repuestos pero dejar las categorías, comenta estas líneas.
      console.log("Borrando categorías de repuestos...");
      await tx.itemCategory.deleteMany({});

      console.log("Borrando ubicaciones de repuestos...");
      await tx.itemLocation.deleteMany({});

      // Nota: Si hay órdenes de compra existentes que dependen de los proveedores,
      // fallará al borrar proveedores a menos que borres las órdenes de compra arriba.
      // console.log("Borrando proveedores...");
      // await tx.vendor.deleteMany({});
      
      console.log("✅ ¡Limpieza de inventario completada con éxito dentro de la transacción!");
    });
  } catch (error) {
    console.error("❌ Ocurrió un error al intentar borrar los datos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
