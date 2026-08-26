BEGIN;

-- ============================================================================
-- Constants Table (Study-level)
-- ============================================================================
-- Constants are study-wide filters (RelativeTimeRangeFilter, CategoricalFilter, 
-- DateFilter) that can be referenced by name in cohort phenotypes.
-- They are resolved at execution time.

CREATE TABLE "constant" (
    "constant_id" character varying NOT NULL,
    "study_id" character varying NOT NULL,
    "user_id" uuid NOT NULL,
    
    -- Constant identity
    "name" character varying(255) NOT NULL,
    "description" text,
    
    -- Constant type (RelativeTimeRangeFilter, CategoricalFilter, DateFilter, array)
    "constant_type" character varying(100) NOT NULL,
    
    -- Type-specific value (stored as JSONB for flexibility)
    "value" jsonb NOT NULL,
    
    -- Display order within type (for UI sorting/drag-drop)
    "display_order" integer DEFAULT 0,
    
    -- Metadata
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    
    -- Primary key
    PRIMARY KEY ("constant_id"),
    
    -- Foreign keys
    FOREIGN KEY("study_id") REFERENCES "study" ("study_id") ON DELETE CASCADE,
    FOREIGN KEY("user_id") REFERENCES "user" ("id") ON DELETE CASCADE,
    
    -- Constraints
    UNIQUE("study_id", "name"),  -- Constant names must be unique within a study
    CHECK(constant_type IN (
        'RelativeTimeRangeFilter',
        'CategoricalFilter', 
        'DateFilter',
        'array'
    ))
);

-- Indexes for performance
CREATE INDEX idx_constant_study_id ON "constant" ("study_id");
CREATE INDEX idx_constant_user_id ON "constant" ("user_id");
CREATE INDEX idx_constant_type ON "constant" ("study_id", "constant_type", "display_order");
CREATE INDEX idx_constant_name ON "constant" ("study_id", "name");

COMMIT;
