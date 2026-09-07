-- AlterTable (idempotente: update.sh la aplica con prisma db execute ANTES del
-- db push para que el push no la vea como cambio "con posible pérdida de datos").
ALTER TABLE "InventoryTransaction" ADD COLUMN IF NOT EXISTS "external_id" TEXT;

-- CreateIndex (NULLs nunca chocan en un índice único; columna nueva = segura).
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryTransaction_external_id_key" ON "InventoryTransaction"("external_id");
