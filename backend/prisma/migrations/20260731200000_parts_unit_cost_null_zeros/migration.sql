-- Unfreeze bogus unit_cost=0 on WO-linked consumptions so catalog fallback can apply.
UPDATE "InventoryTransaction"
SET "unit_cost" = NULL
WHERE "work_order_id" IS NOT NULL
  AND "unit_cost" = 0;

-- Snapshot current catalog cost where still null and the item has a positive cost.
UPDATE "InventoryTransaction" AS t
SET "unit_cost" = i."purchase_cost"
FROM "Item" AS i
WHERE t."item_id" = i."id"
  AND t."work_order_id" IS NOT NULL
  AND t."unit_cost" IS NULL
  AND i."purchase_cost" IS NOT NULL
  AND i."purchase_cost" > 0;
