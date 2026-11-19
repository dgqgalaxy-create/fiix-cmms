-- Categorías de activos y de órdenes de trabajo (clasificación).
-- Aditivo e idempotente: seguro reejecutar en cualquier instalación.

CREATE TABLE IF NOT EXISTS "AssetCategory" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AssetCategory_name_key" ON "AssetCategory" ("name");

CREATE TABLE IF NOT EXISTS "WorkOrderCategory" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrderCategory_name_key" ON "WorkOrderCategory" ("name");

ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "category_id" UUID;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "category_id" UUID;

CREATE INDEX IF NOT EXISTS "Asset_category_id_idx" ON "Asset" ("category_id");
CREATE INDEX IF NOT EXISTS "WorkOrder_category_id_idx" ON "WorkOrder" ("category_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Asset_category_id_fkey'
  ) THEN
    ALTER TABLE "Asset"
      ADD CONSTRAINT "Asset_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "AssetCategory" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkOrder_category_id_fkey'
  ) THEN
    ALTER TABLE "WorkOrder"
      ADD CONSTRAINT "WorkOrder_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "WorkOrderCategory" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
