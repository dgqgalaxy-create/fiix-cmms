-- IVA a nivel de orden de compra (líneas siguen sin IVA).
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "iva_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;
