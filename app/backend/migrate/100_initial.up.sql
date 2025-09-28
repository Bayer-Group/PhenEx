BEGIN;

CREATE TABLE "user" (
    "id" uuid NOT NULL,
    "email" character varying NULL,
    "password_hash" character varying NULL,
    "external_id" character varying NULL,
    "name" character varying NOT NULL,
    PRIMARY KEY ("id")
);

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

CREATE TABLE IF NOT EXISTS "cohort" (
    "cohort_id" character varying NOT NULL,
    "user_id" uuid NOT NULL,
    "study_id" character varying NOT NULL, -- many cohorts to one study
    "parent_cohort_id" character varying NULL, -- for subcohorts, references parent cohort
    "version" integer NOT NULL DEFAULT 1,
    "cohort_data" jsonb NOT NULL,
    "is_provisional" boolean DEFAULT FALSE,
    "is_public" boolean DEFAULT FALSE,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("cohort_id"),
    FOREIGN KEY("user_id") REFERENCES "user" ("id"),
    FOREIGN KEY("study_id") REFERENCES "study" ("study_id"),
    FOREIGN KEY("parent_cohort_id") REFERENCES "cohort" ("cohort_id")
);

CREATE TABLE IF NOT EXISTS "codelistfile" (
    "codelist_id" character varying NOT NULL,
    "user_id" uuid NOT NULL,
    "cohort_id" character varying NULL, -- Added this column
    "version" integer NOT NULL DEFAULT 1,
    "codelist_data" jsonb NOT NULL,
    "column_mapping" jsonb NOT NULL,
    "codelists" character varying[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("codelist_id"),
    FOREIGN KEY("user_id") REFERENCES "user" ("id"),
    FOREIGN KEY("cohort_id") REFERENCES "cohort" ("cohort_id")
);

COMMIT;
