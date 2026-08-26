BEGIN;

CREATE TABLE IF NOT EXISTS "codelistfile" (
    "file_id" character varying NOT NULL,
    "file_name" character varying NOT NULL,
    "user_id" uuid NOT NULL,
    "cohort_id" character varying NULL,
    "version" integer NOT NULL DEFAULT 1,
    "codelist_data" jsonb NOT NULL,
    "column_mapping" jsonb NOT NULL,
    "codelists" character varying[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("file_id"),
    FOREIGN KEY("user_id") REFERENCES "user" ("id")
);

COMMIT;
