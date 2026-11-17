-- Parámetros del tablero «Desempeño del equipo» y rastreo de asignaciones.
-- Aditivo e idempotente: seguro reejecutar en cualquier instalación.
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "performance_config" JSONB;
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMP(3);
ALTER TABLE "WorkOrder" ADD COLUMN IF NOT EXISTS "reassignment_count" INTEGER NOT NULL DEFAULT 0;
