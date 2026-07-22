-- Align InventoryTransaction with Prisma schema (work order link + unit cost)
ALTER TABLE "InventoryTransaction" ADD COLUMN IF NOT EXISTS "work_order_id" UUID;
ALTER TABLE "InventoryTransaction" ADD COLUMN IF NOT EXISTS "unit_cost" DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InventoryTransaction_work_order_id_fkey'
  ) THEN
    ALTER TABLE "InventoryTransaction"
      ADD CONSTRAINT "InventoryTransaction_work_order_id_fkey"
      FOREIGN KEY ("work_order_id") REFERENCES "WorkOrder"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "InventoryTransaction_work_order_id_idx"
  ON "InventoryTransaction"("work_order_id");
