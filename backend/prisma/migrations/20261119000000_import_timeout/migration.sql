-- Tope de tiempo configurable de la importación (CSV / Sheets / Drive), en minutos.
-- Aditivo e idempotente: seguro reejecutar en cualquier instalación.
ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS "import_timeout_min" INTEGER NOT NULL DEFAULT 45;
