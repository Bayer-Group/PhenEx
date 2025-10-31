BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS "idx_study_user_display_order";
DROP INDEX IF EXISTS "idx_study_public_display_order";
DROP INDEX IF EXISTS "idx_cohort_study_display_order";

-- Remove display_order column from cohort table
ALTER TABLE "cohort"
DROP COLUMN IF EXISTS "display_order";

-- Remove display_order column from study table
ALTER TABLE "study"
DROP COLUMN IF EXISTS "display_order";

COMMIT;
