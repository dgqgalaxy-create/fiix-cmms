CREATE TABLE "WeeklyWorkOrderPlan" (
  "week_start" TEXT NOT NULL PRIMARY KEY,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "late_start" BOOLEAN NOT NULL DEFAULT false,
  "baseline" JSONB NOT NULL,
  "carryover" JSONB NOT NULL
);
CREATE TABLE "WeeklyWorkOrderCut" (
  "id" UUID NOT NULL PRIMARY KEY,
  "week_start" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" TEXT,
  "source" TEXT NOT NULL,
  "auto_key" TEXT,
  "orders" JSONB NOT NULL,
  CONSTRAINT "WeeklyWorkOrderCut_week_start_fkey" FOREIGN KEY ("week_start") REFERENCES "WeeklyWorkOrderPlan"("week_start") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WeeklyWorkOrderCut_auto_key_key" ON "WeeklyWorkOrderCut"("auto_key");
CREATE INDEX "WeeklyWorkOrderCut_week_start_captured_at_idx" ON "WeeklyWorkOrderCut"("week_start", "captured_at");
