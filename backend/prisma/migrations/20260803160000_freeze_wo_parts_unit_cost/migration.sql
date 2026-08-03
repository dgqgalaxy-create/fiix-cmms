-- Congelar costos históricos de consumo OT: una sola vez desde el catálogo actual,
-- luego ya no se relee purchase_cost en reportes (resolvePartsUnitCost estricto).

-- 1) Si unit_cost es NULL o 0 y el catálogo tiene precio > 0 → snapshot del catálogo.
UPDATE "InventoryTransaction" AS t
SET "unit_cost" = i."purchase_cost"
FROM "Item" AS i
WHERE t."item_id" = i."id"
  AND t."work_order_id" IS NOT NULL
  AND (t."unit_cost" IS NULL OR t."unit_cost" = 0)
  AND i."purchase_cost" IS NOT NULL
  AND i."purchase_cost" > 0;

-- 2) Cualquier consumo OT que siga en NULL → 0 explícito (congelado sin precio).
UPDATE "InventoryTransaction"
SET "unit_cost" = 0
WHERE "work_order_id" IS NOT NULL
  AND "unit_cost" IS NULL;
