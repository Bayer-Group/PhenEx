ALTER TABLE "cohort"
ADD COLUMN "study_id" character varying NOT NULL;

ALTER TABLE "cohort"
ADD COLUMN "parent_cohort_id" character varying NULL;

ALTER TABLE "cohort"
ADD CONSTRAINT "cohort_study_id_fkey"
FOREIGN KEY ("study_id") REFERENCES "study" ("study_id");

ALTER TABLE "cohort"
ADD CONSTRAINT "cohort_parent_cohort_id_fkey"
FOREIGN KEY ("parent_cohort_id") REFERENCES "cohort" ("cohort_id");