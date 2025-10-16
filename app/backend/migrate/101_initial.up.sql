BEGIN;

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
