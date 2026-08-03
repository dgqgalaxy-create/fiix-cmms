-- CreateEnum
CREATE TYPE "OperationalTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "PersonalNote" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "remind_at" TIMESTAMP(3),
    "reminded_at" TIMESTAMP(3),
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalTask" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "created_by_id" UUID NOT NULL,
    "assignee_id" UUID NOT NULL,
    "work_order_id" UUID,
    "asset_id" UUID,
    "due_at" TIMESTAMP(3),
    "reminded_at" TIMESTAMP(3),
    "status" "OperationalTaskStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalNote_user_id_is_done_idx" ON "PersonalNote"("user_id", "is_done");
CREATE INDEX "PersonalNote_remind_at_idx" ON "PersonalNote"("remind_at");
CREATE INDEX "OperationalTask_assignee_id_status_idx" ON "OperationalTask"("assignee_id", "status");
CREATE INDEX "OperationalTask_created_by_id_status_idx" ON "OperationalTask"("created_by_id", "status");
CREATE INDEX "OperationalTask_due_at_idx" ON "OperationalTask"("due_at");
CREATE INDEX "OperationalTask_work_order_id_idx" ON "OperationalTask"("work_order_id");
CREATE INDEX "OperationalTask_asset_id_idx" ON "OperationalTask"("asset_id");

-- AddForeignKey
ALTER TABLE "PersonalNote" ADD CONSTRAINT "PersonalNote_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationalTask" ADD CONSTRAINT "OperationalTask_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OperationalTask" ADD CONSTRAINT "OperationalTask_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OperationalTask" ADD CONSTRAINT "OperationalTask_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationalTask" ADD CONSTRAINT "OperationalTask_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
