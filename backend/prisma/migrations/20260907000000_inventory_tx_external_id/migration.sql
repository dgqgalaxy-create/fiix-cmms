-- AlterTable
ALTER TABLE "InventoryTransaction" ADD COLUMN     "external_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_external_id_key" ON "InventoryTransaction"("external_id");

