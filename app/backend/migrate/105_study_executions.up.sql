BEGIN;

CREATE TABLE IF NOT EXISTS "study_execution" (
    "execution_id" character varying NOT NULL,
    "study_id" character varying NOT NULL,
    "user_id" uuid NOT NULL,
    "status" character varying NOT NULL DEFAULT 'running',  -- running, success, failure
    "started_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "ended_at" timestamp with time zone,
    "manifest_path" character varying,
    "error_message" text,
    PRIMARY KEY ("execution_id"),
    FOREIGN KEY ("study_id") REFERENCES "study" ("study_id"),
    FOREIGN KEY ("user_id") REFERENCES "user" ("id")
);

COMMIT;
