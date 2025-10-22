BEGIN;

CREATE TABLE IF NOT EXISTS "study" (
    "study_id" character varying NOT NULL,
    "user_id" uuid NOT NULL, -- created_by user
    "visible_by" uuid[] DEFAULT '{}', -- array of user_ids who can see this study
    "is_public" boolean DEFAULT FALSE,
    "name" character varying NOT NULL,
    "description" text,
    "baseline_characteristics" jsonb,
    "outcomes" jsonb,
    "analysis" jsonb,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("study_id"),
    FOREIGN KEY("user_id") REFERENCES "user" ("id")
);


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

COMMIT;