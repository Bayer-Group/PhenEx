BEGIN;

CREATE TABLE "user" (
    "id" uuid NOT NULL,
    "email" character varying NULL,
    "password_hash" character varying NULL,
    "external_id" character varying NULL,
    "name" character varying NOT NULL,
    PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cohort" (
    "cohort_id" character varying NOT NULL,
    "user_id" uuid NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    "cohort_data" jsonb NOT NULL,
    "is_provisional" boolean DEFAULT FALSE,
    "is_public" boolean DEFAULT FALSE,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("cohort_id"),
    FOREIGN KEY("user_id") REFERENCES "user" ("id")
);

CREATE TABLE IF NOT EXISTS "codelistfile" (
    "codelist_id" character varying NOT NULL,
    "user_id" uuid NOT NULL,
    "version" integer NOT NULL DEFAULT 1,
    "codelist_data" jsonb NOT NULL,
    "column_mapping" jsonb NOT NULL, -- JSON object mapping column names to the default column names used by PhenEx
    "codelists" character varying[] NOT NULL,  -- Array of strings which lists codelist names contained in the file
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("codelist_id"),
    FOREIGN KEY("user_id") REFERENCES "user" ("id")
    FOREIGN KEY("cohort_id") REFERENCES "cohort" ("cohort_id")
);

COMMIT;
