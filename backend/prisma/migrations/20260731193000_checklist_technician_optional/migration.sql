-- AlterTable: technician_id opcional (claim con «Iniciar checklist»)
ALTER TABLE "DailyChecklist" ALTER COLUMN "technician_id" DROP NOT NULL;
