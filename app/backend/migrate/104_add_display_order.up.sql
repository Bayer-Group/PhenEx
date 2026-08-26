BEGIN;

-- Add display_order column to study table
ALTER TABLE "study"
ADD COLUMN "display_order" integer DEFAULT 0;

-- Add display_order column to cohort table
ALTER TABLE "cohort"
ADD COLUMN "display_order" integer DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_study_user_display_order" 
ON "study" ("user_id", "display_order");

CREATE INDEX IF NOT EXISTS "idx_study_public_display_order" 
ON "study" ("is_public", "display_order") WHERE "is_public" = TRUE;

CREATE INDEX IF NOT EXISTS "idx_cohort_study_display_order" 
ON "cohort" ("study_id", "display_order");

COMMIT;
