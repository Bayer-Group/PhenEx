BEGIN;

ALTER TABLE "codelistfile"
    ADD COLUMN IF NOT EXISTS "study_id" character varying NULL;

-- Migrate existing rows: derive study_id from the cohort's study_id
UPDATE "codelistfile" cf
SET study_id = c.study_id
FROM (
    SELECT DISTINCT ON (cohort_id) cohort_id, study_id
    FROM cohort
    ORDER BY cohort_id, version DESC
) c
WHERE cf.cohort_id = c.cohort_id
  AND cf.study_id IS NULL;

COMMIT;
