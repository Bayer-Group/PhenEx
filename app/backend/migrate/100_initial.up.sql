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

COMMIT;
