-- SystemSettings historically existed only via `db push` on some installs;
-- create it here so fresh `migrate dev` / shadow DB can succeed.
CREATE TABLE IF NOT EXISTS "SystemSettings" (
    "id" UUID NOT NULL,
    "dev_menu_password_hash" TEXT,
    "telegram_enabled" BOOLEAN NOT NULL DEFAULT true,
    "telegram_bot_token" TEXT,
    "telegram_chat_id" TEXT,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "sla_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sla_policy" JSONB,
    "checklist_column_count" INTEGER NOT NULL DEFAULT 5,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- AlterTable (DBs that already had SystemSettings without SLA columns)
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "sla_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "sla_policy" JSONB;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "checklist_column_count" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "dev_menu_password_hash" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "telegram_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "telegram_bot_token" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "email_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

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
