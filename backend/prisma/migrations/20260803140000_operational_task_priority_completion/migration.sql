-- CreateEnum
CREATE TYPE "OperationalTaskPriority" AS ENUM ('NORMAL', 'ALTA');

-- AlterTable
ALTER TABLE "OperationalTask" ADD COLUMN "priority" "OperationalTaskPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "completion_note" TEXT;

-- CreateIndex
CREATE INDEX "OperationalTask_priority_status_idx" ON "OperationalTask"("priority", "status");
