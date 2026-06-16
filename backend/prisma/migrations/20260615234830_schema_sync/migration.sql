/*
  Warnings:

  - You are about to drop the column `assigned_to_id` on the `WorkOrder` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('URGENTE', 'NORMAL', 'BAJO');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('SERVICIO', 'PREVENTIVO', 'CORRECTIVO');

-- CreateEnum
CREATE TYPE "ProductionGroup" AS ENUM ('A', 'B', 'C', 'D', 'NA');

-- AlterEnum
ALTER TYPE "WorkOrderStatus" ADD VALUE 'ANULADO';

-- DropForeignKey
ALTER TABLE "WorkOrder" DROP CONSTRAINT "WorkOrder_assigned_to_id_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "document_url" TEXT,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "zone_id" UUID;

-- AlterTable
ALTER TABLE "WorkOrder" DROP COLUMN "assigned_to_id",
ADD COLUMN     "accumulated_time_ms" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "folio" SERIAL NOT NULL,
ADD COLUMN     "last_resumed_at" TIMESTAMP(3),
ADD COLUMN     "machine_stopped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenance_type" "MaintenanceType" NOT NULL DEFAULT 'CORRECTIVO',
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "production_group" "ProductionGroup" NOT NULL DEFAULT 'NA',
ADD COLUMN     "request_image_url" TEXT,
ADD COLUMN     "requester_name" TEXT,
ADD COLUMN     "signature_clean_area" TEXT,
ADD COLUMN     "signature_delivery" TEXT,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "zone_id" UUID;

-- CreateTable
CREATE TABLE "Zone" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KPIGoal" (
    "id" UUID NOT NULL,
    "metricKey" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KPIGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "permissions" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AssignedOrders" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_AssignedOrders_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Zone_name_key" ON "Zone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "KPIGoal_metricKey_key" ON "KPIGoal"("metricKey");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_key" ON "RolePermission"("role");

-- CreateIndex
CREATE INDEX "_AssignedOrders_B_index" ON "_AssignedOrders"("B");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssignedOrders" ADD CONSTRAINT "_AssignedOrders_A_fkey" FOREIGN KEY ("A") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssignedOrders" ADD CONSTRAINT "_AssignedOrders_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
