-- CreateEnum
CREATE TYPE "ChecklistTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ChecklistTransfer" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "status" "ChecklistTransferStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "ChecklistTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTransfer_checklist_id_status_idx" ON "ChecklistTransfer"("checklist_id", "status");

-- CreateIndex
CREATE INDEX "ChecklistTransfer_to_user_id_status_idx" ON "ChecklistTransfer"("to_user_id", "status");

-- Max one PENDING transfer per checklist
CREATE UNIQUE INDEX "ChecklistTransfer_checklist_id_pending_uidx"
  ON "ChecklistTransfer"("checklist_id")
  WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "ChecklistTransfer" ADD CONSTRAINT "ChecklistTransfer_checklist_id_fkey"
  FOREIGN KEY ("checklist_id") REFERENCES "DailyChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistTransfer" ADD CONSTRAINT "ChecklistTransfer_from_user_id_fkey"
  FOREIGN KEY ("from_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChecklistTransfer" ADD CONSTRAINT "ChecklistTransfer_to_user_id_fkey"
  FOREIGN KEY ("to_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
