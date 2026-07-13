BEGIN;

-- ============================================================================
-- Add display_order to codelistfile table and remove cohort_id completely
-- ============================================================================

-- First, populate study_id for any records that have cohort_id but not study_id
UPDATE "codelistfile"
SET study_id = cohort.study_id
FROM "cohort"
WHERE "codelistfile".cohort_id = cohort.cohort_id
  AND "codelistfile".study_id IS NULL
  AND "codelistfile".cohort_id IS NOT NULL;

-- Add display_order column for UI sorting/drag-drop
ALTER TABLE "codelistfile" 
ADD COLUMN IF NOT EXISTS "display_order" integer DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_codelistfile_display_order 
ON "codelistfile" ("study_id", "display_order");

-- Initialize display_order for existing records (ordered by created_at)
WITH ordered_files AS (
    SELECT file_id, 
           ROW_NUMBER() OVER (PARTITION BY study_id ORDER BY created_at) - 1 AS order_num
    FROM "codelistfile"
    WHERE study_id IS NOT NULL
)
UPDATE "codelistfile" 
SET display_order = ordered_files.order_num
FROM ordered_files
WHERE "codelistfile".file_id = ordered_files.file_id;

-- Remove the cohort_id column completely
ALTER TABLE "codelistfile" 
DROP COLUMN IF EXISTS "cohort_id";

COMMIT;
