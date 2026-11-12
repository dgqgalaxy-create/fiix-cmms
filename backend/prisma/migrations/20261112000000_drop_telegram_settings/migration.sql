-- Retiro de la integración con Telegram: se eliminan las columnas de credenciales.
-- Idempotente: si el esquema ya no las tiene, no hace nada.
ALTER TABLE "SystemSettings" DROP COLUMN IF EXISTS "telegram_enabled";
ALTER TABLE "SystemSettings" DROP COLUMN IF EXISTS "telegram_bot_token";
ALTER TABLE "SystemSettings" DROP COLUMN IF EXISTS "telegram_chat_id";
