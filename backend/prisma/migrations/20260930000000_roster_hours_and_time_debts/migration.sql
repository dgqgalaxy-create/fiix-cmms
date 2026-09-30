CREATE TABLE "TechnicianTimeDebt" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "total_minutes" INTEGER NOT NULL CHECK ("total_minutes" > 0),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicianTimeDebt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TechnicianTimeDebt_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TechnicianTimeDebt_user_id_idx" ON "TechnicianTimeDebt"("user_id");
ALTER TABLE "TechnicianException"
  ADD COLUMN "start_time" TEXT,
  ADD COLUMN "end_time" TEXT,
  ADD COLUMN "paid_minutes" INTEGER,
  ADD COLUMN "time_debt_id" UUID;
ALTER TABLE "TechnicianException" ADD CONSTRAINT "TechnicianException_time_debt_id_fkey"
  FOREIGN KEY ("time_debt_id") REFERENCES "TechnicianTimeDebt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
