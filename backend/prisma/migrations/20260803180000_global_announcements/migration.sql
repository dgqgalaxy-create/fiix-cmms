-- Avisos globales + lecturas por usuario
CREATE TABLE IF NOT EXISTS "GlobalAnnouncement" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "image_url" TEXT,
    "created_by_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GlobalAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GlobalAnnouncementRead" (
    "id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalAnnouncementRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GlobalAnnouncement_is_active_created_at_idx" ON "GlobalAnnouncement"("is_active", "created_at");
CREATE INDEX IF NOT EXISTS "GlobalAnnouncement_created_by_id_idx" ON "GlobalAnnouncement"("created_by_id");
CREATE INDEX IF NOT EXISTS "GlobalAnnouncementRead_user_id_idx" ON "GlobalAnnouncementRead"("user_id");
CREATE INDEX IF NOT EXISTS "GlobalAnnouncementRead_announcement_id_idx" ON "GlobalAnnouncementRead"("announcement_id");

CREATE UNIQUE INDEX IF NOT EXISTS "GlobalAnnouncementRead_announcement_id_user_id_key" ON "GlobalAnnouncementRead"("announcement_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "GlobalAnnouncement" ADD CONSTRAINT "GlobalAnnouncement_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GlobalAnnouncementRead" ADD CONSTRAINT "GlobalAnnouncementRead_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "GlobalAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GlobalAnnouncementRead" ADD CONSTRAINT "GlobalAnnouncementRead_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
