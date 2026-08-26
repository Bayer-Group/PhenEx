BEGIN;

-- Drop the table (cascade will drop indexes automatically)
DROP TABLE IF EXISTS "constant" CASCADE;

COMMIT;
