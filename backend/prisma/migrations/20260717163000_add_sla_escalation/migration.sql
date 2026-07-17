-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "sla_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "sla_policy" JSONB;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SlaEventType" AS ENUM (
    'REMINDER_RESPONSE',
    'ESCALATE_RESPONSE',
    'REMINDER_HOLD',
    'ESCALATE_HOLD',
    'REMINDER_RESOLUTION',
    'ESCALATE_RESOLUTION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkOrderSlaEvent" (
    "id" UUID NOT NULL,
    "work_order_id" UUID NOT NULL,
    "event_type" "SlaEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderSlaEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrderSlaEvent_work_order_id_event_type_key"
  ON "WorkOrderSlaEvent"("work_order_id", "event_type");

CREATE INDEX IF NOT EXISTS "WorkOrderSlaEvent_work_order_id_idx"
  ON "WorkOrderSlaEvent"("work_order_id");

DO $$ BEGIN
  ALTER TABLE "WorkOrderSlaEvent"
    ADD CONSTRAINT "WorkOrderSlaEvent_work_order_id_fkey"
    FOREIGN KEY ("work_order_id") REFERENCES "WorkOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
