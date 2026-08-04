-- Soft-delete for chat messages (author hide; content kept in DB for audit)
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
