CREATE TYPE "Coalition" AS ENUM ('GOLD_LIGHT', 'CRIMSON', 'MONO', 'NONE');

ALTER TABLE "users"
  ADD COLUMN "coalition" "Coalition" NOT NULL DEFAULT 'NONE';
