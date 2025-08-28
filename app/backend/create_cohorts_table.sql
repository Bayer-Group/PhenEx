-- SQL script to create the cohorts table for PhenEx
-- Run this against your PostgreSQL database to set up the cohorts storage

-- Drop table if it exists (be careful in production!)
-- DROP TABLE IF EXISTS api.cohort;

CREATE TABLE IF NOT EXISTS api.cohort (
    cohort_id VARCHAR(16) NOT NULL,
    user_id UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    cohort_data JSONB NOT NULL,
    is_provisional BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Primary key includes version to allow multiple versions per cohort
    PRIMARY KEY (cohort_id, user_id, version),
    
    -- Foreign key constraint to auth.users table
    CONSTRAINT fk_cohort_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Ensure unique combination of cohort_id, user_id, and version for each provisional state
    CONSTRAINT unique_cohort_version_provisional UNIQUE (cohort_id, user_id, version)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cohorts_user_id ON api.cohort(user_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_cohort_id ON api.cohort(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_user_id_cohort_id ON api.cohort(user_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_latest_version ON api.cohort(cohort_id, user_id, version DESC);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cohorts_updated_at 
    BEFORE UPDATE ON api.cohort 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant all permissions to postgres role
GRANT ALL PRIVILEGES ON TABLE api.cohort TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO postgres;
