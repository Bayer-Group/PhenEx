BEGIN;

ALTER TABLE cohort ADD COLUMN IF NOT EXISTS name character varying;
ALTER TABLE cohort ADD COLUMN IF NOT EXISTS description text;

-- Backfill from existing cohort_data JSON
UPDATE cohort SET
    name = cohort_data->>'name',
    description = cohort_data->>'description'
WHERE name IS NULL;

COMMIT;
