BEGIN;

-- Add dedicated database column to study table
ALTER TABLE "study" ADD COLUMN IF NOT EXISTS "database" jsonb;

-- Remove analysis column from study table (unused)
ALTER TABLE "study" DROP COLUMN IF EXISTS "analysis";

-- Add dedicated database column to cohort table (for cohort-level override)
ALTER TABLE "cohort" ADD COLUMN IF NOT EXISTS "database" jsonb;

COMMIT;
