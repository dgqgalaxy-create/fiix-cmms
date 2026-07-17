-- Configurable checklist machine columns (L1..Ln)
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "checklist_column_count" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "DailyChecklist" ADD COLUMN IF NOT EXISTS "column_count" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "DailyChecklistRow" ADD COLUMN IF NOT EXISTS "line_statuses" JSONB NOT NULL DEFAULT '{}';

-- Migrate legacy L1..L5 into line_statuses
UPDATE "DailyChecklistRow"
SET "line_statuses" = jsonb_strip_nulls(jsonb_build_object(
  '1', "L1_status",
  '2', "L2_status",
  '3', "L3_status",
  '4', "L4_status",
  '5', "L5_status"
))
WHERE COALESCE("line_statuses", '{}'::jsonb) = '{}'::jsonb
  AND (
    "L1_status" IS NOT NULL OR
    "L2_status" IS NOT NULL OR
    "L3_status" IS NOT NULL OR
    "L4_status" IS NOT NULL OR
    "L5_status" IS NOT NULL
  );

ALTER TABLE "DailyChecklistRow" DROP COLUMN IF EXISTS "L1_status";
ALTER TABLE "DailyChecklistRow" DROP COLUMN IF EXISTS "L2_status";
ALTER TABLE "DailyChecklistRow" DROP COLUMN IF EXISTS "L3_status";
ALTER TABLE "DailyChecklistRow" DROP COLUMN IF EXISTS "L4_status";
ALTER TABLE "DailyChecklistRow" DROP COLUMN IF EXISTS "L5_status";
