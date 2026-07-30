-- Zone sections (subzonas) + asset.zone_section_id; migrate L1–L5 A–E.

ALTER TABLE "Zone" ADD COLUMN "has_sections" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "ZoneSection" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ZoneSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ZoneSection_zone_id_name_key" ON "ZoneSection"("zone_id", "name");
CREATE INDEX "ZoneSection_zone_id_idx" ON "ZoneSection"("zone_id");

ALTER TABLE "ZoneSection"
  ADD CONSTRAINT "ZoneSection_zone_id_fkey"
  FOREIGN KEY ("zone_id") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset" ADD COLUMN "zone_section_id" UUID;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_zone_section_id_fkey"
  FOREIGN KEY ("zone_section_id") REFERENCES "ZoneSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Non production-line zones: Sin secciones (matches prior behavior outside L1–L5).
UPDATE "Zone"
SET "has_sections" = false
WHERE UPPER(TRIM("name")) NOT IN ('L1', 'L2', 'L3', 'L4', 'L5');

-- Create A–E sections for production lines L1–L5 and link existing assets.
DO $$
DECLARE
  z RECORD;
  sec TEXT;
  sid UUID;
BEGIN
  FOR z IN
    SELECT id, name FROM "Zone"
    WHERE UPPER(TRIM(name)) IN ('L1', 'L2', 'L3', 'L4', 'L5')
  LOOP
    UPDATE "Zone" SET "has_sections" = true WHERE id = z.id;
    FOREACH sec IN ARRAY ARRAY['A', 'B', 'C', 'D', 'E']
    LOOP
      sid := gen_random_uuid();
      INSERT INTO "ZoneSection" ("id", "zone_id", "name", "created_at", "updated_at")
      VALUES (sid, z.id, sec, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("zone_id", "name") DO NOTHING;

      SELECT id INTO sid FROM "ZoneSection" WHERE zone_id = z.id AND name = sec;

      UPDATE "Asset"
      SET "zone_section_id" = sid
      WHERE zone_id = z.id AND section::text = sec;
    END LOOP;
  END LOOP;
END $$;
