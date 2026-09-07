-- AlterTable (idempotente: repetir SET DATA TYPE BIGINT es un no-op; update.sh la
-- aplica con prisma db execute ANTES del db push para evitar el aviso de pérdida
-- de datos de Prisma sobre un cambio puramente aditivo/ampliación).
ALTER TABLE "WorkOrder" ALTER COLUMN "accumulated_time_ms" SET DATA TYPE BIGINT;
