-- SQL script to create the cohorts table for PhenEx
-- Run this against your PostgreSQL database to set up the cohorts storage

CREATE TABLE IF NOT EXISTS cohorts (
    cohort_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    cohort_data JSONB NOT NULL,
    is_provisional BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Composite primary key
    PRIMARY KEY (cohort_id, user_id),
    
    -- Ensure unique combination of cohort_id, user_id, and version for each provisional state
    CONSTRAINT unique_cohort_version UNIQUE (cohort_id, user_id, version, is_provisional)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cohorts_user_id ON cohorts(user_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_cohort_id ON cohorts(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_user_id_cohort_id ON cohorts(user_id, cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_version ON cohorts(version);
CREATE INDEX IF NOT EXISTS idx_cohorts_provisional ON cohorts(is_provisional);
CREATE INDEX IF NOT EXISTS idx_cohorts_public ON cohorts(is_public);
CREATE INDEX IF NOT EXISTS idx_cohorts_latest_version ON cohorts(cohort_id, user_id, version DESC);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cohorts_updated_at 
    BEFORE UPDATE ON cohorts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON cohorts TO your_app_user;
