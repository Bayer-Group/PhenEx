BEGIN;

-- Reverse the changes from 111_codelists_display_order.up.sql

-- Re-add cohort_id column
ALTER TABLE "codelistfile" 
ADD COLUMN "cohort_id" varchar;

-- Drop the display_order index
DROP INDEX IF EXISTS idx_codelistfile_display_order;

-- Remove the display_order column
ALTER TABLE "codelistfile" 
DROP COLUMN IF EXISTS "display_order";

COMMIT;
