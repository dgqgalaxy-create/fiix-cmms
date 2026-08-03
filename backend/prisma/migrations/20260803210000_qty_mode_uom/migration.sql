-- CreateEnum
CREATE TYPE "QtyMode" AS ENUM ('INTEGER', 'DECIMAL');

-- AlterTable UnitOfMeasure
ALTER TABLE "UnitOfMeasure" ADD COLUMN IF NOT EXISTS "default_qty_mode" "QtyMode" NOT NULL DEFAULT 'INTEGER';

-- AlterTable Item
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "qty_mode" "QtyMode" NOT NULL DEFAULT 'INTEGER';

-- Backfill: ítems con stock o mínimo fraccionario → DECIMAL
UPDATE "Item"
SET "qty_mode" = 'DECIMAL'
WHERE ("stock" <> FLOOR("stock"))
   OR ("minimum_inventory" <> FLOOR("minimum_inventory"));
