-- AlterEnum
ALTER TYPE "ChecklistStatus" ADD VALUE 'NON_COMPLIANCE';

-- CreateEnum
CREATE TYPE "ChecklistContinuationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "DailyChecklist" ADD COLUMN "non_compliance_at" TIMESTAMP(3),
ADD COLUMN "reopened_from_non_compliance" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChecklistContinuationRequest" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" "ChecklistContinuationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "resolved_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "ChecklistContinuationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistContinuationRequest_checklist_id_status_idx" ON "ChecklistContinuationRequest"("checklist_id", "status");

-- CreateIndex
CREATE INDEX "ChecklistContinuationRequest_requested_by_id_status_idx" ON "ChecklistContinuationRequest"("requested_by_id", "status");

-- Max one PENDING continuation request per checklist
CREATE UNIQUE INDEX "ChecklistContinuationRequest_checklist_id_pending_uidx"
  ON "ChecklistContinuationRequest"("checklist_id")
  WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "ChecklistContinuationRequest" ADD CONSTRAINT "ChecklistContinuationRequest_checklist_id_fkey"
  FOREIGN KEY ("checklist_id") REFERENCES "DailyChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistContinuationRequest" ADD CONSTRAINT "ChecklistContinuationRequest_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChecklistContinuationRequest" ADD CONSTRAINT "ChecklistContinuationRequest_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
