#!/usr/bin/env python3
"""
Database initialization script to create the cohorts table and related structures.
This script is designed to be run by the backend service on startup.
"""

import asyncio
import sys
import os
import asyncpg
import logging
from typing import Optional

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CohortTableInitializer:
    def __init__(self):
        self.host = os.getenv("POSTGRES_HOST", "localhost")
        self.port = int(os.getenv("POSTGRES_PORT", "5432"))
        self.database = os.getenv("POSTGRES_DB", "postgres")
        self.user = os.getenv("POSTGRES_USER", "postgres")
        self.password = os.getenv("POSTGRES_PASSWORD")

        if not self.password:
            raise ValueError("POSTGRES_PASSWORD environment variable is required")

    async def wait_for_database(
        self, max_retries: int = 30, delay: float = 2.0
    ) -> bool:
        """Wait for database to be available."""
        for attempt in range(max_retries):
            try:
                conn = await asyncpg.connect(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.user,
                    password=self.password,
                    timeout=5.0,
                )
                await conn.close()
                logger.info("✅ Database connection established")
                return True
            except Exception as e:
                logger.warning(
                    f"Attempt {attempt + 1}/{max_retries}: Database not ready - {e}"
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(delay)

        logger.error("❌ Failed to connect to database after all retries")
        return False

    async def check_api_schema_exists(self) -> bool:
        """Check if api schema exists."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            schema_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'api')"
            )

            await conn.close()
            return bool(schema_exists)

        except Exception as e:
            logger.error(f"❌ Error checking api schema: {e}")
            return False

    async def check_cohort_table_exists(self) -> bool:
        """Check if cohort table exists."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            table_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'api' AND table_name = 'cohort')"
            )

            await conn.close()
            return bool(table_exists)

        except Exception as e:
            logger.error(f"❌ Error checking cohort table: {e}")
            return False

    async def create_api_schema(self) -> bool:
        """Create the api schema."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            await conn.execute("CREATE SCHEMA IF NOT EXISTS api;")
            logger.info("✅ API schema created/verified")

            await conn.close()
            return True

        except Exception as e:
            logger.error(f"❌ Error creating api schema: {e}")
            return False

    async def create_cohort_table(self) -> bool:
        """Create the cohort table with all constraints and indexes."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            # Create the cohort table
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS api.cohort (
                cohort_id VARCHAR(16) NOT NULL,
                user_id UUID NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                cohort_data JSONB NOT NULL,
                is_provisional BOOLEAN DEFAULT FALSE,
                is_public BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                
                -- Primary key includes version and is_provisional to allow both provisional and non-provisional at same version
                PRIMARY KEY (cohort_id, user_id, version, is_provisional)
            );
            """

            await conn.execute(create_table_sql)
            logger.info("✅ Cohort table created/verified")

            await conn.close()
            return True

        except Exception as e:
            logger.error(f"❌ Error creating cohort table: {e}")
            return False

    async def create_foreign_key_constraint(self) -> bool:
        """Create foreign key constraint to auth.users table if it doesn't exist."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            # Check if foreign key constraint already exists
            constraint_exists = await conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE table_schema = 'api' 
                    AND table_name = 'cohort' 
                    AND constraint_name = 'fk_cohort_user_id'
                )
            """
            )

            if not constraint_exists:
                # Check if auth.users table exists before creating foreign key
                auth_users_exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')"
                )

                if auth_users_exists:
                    await conn.execute(
                        """
                        ALTER TABLE api.cohort 
                        ADD CONSTRAINT fk_cohort_user_id 
                        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
                    """
                    )
                    logger.info("✅ Foreign key constraint to auth.users created")
                else:
                    logger.warning(
                        "⚠️ auth.users table not found, skipping foreign key constraint"
                    )
            else:
                logger.info("✅ Foreign key constraint already exists")

            await conn.close()
            return True

        except Exception as e:
            logger.warning(
                f"⚠️ Could not create foreign key constraint (this is OK if auth schema isn't ready yet): {e}"
            )
            return True  # Don't fail initialization for this

    async def create_indexes(self) -> bool:
        """Create indexes for better query performance."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_cohorts_user_id ON api.cohort(user_id);",
                "CREATE INDEX IF NOT EXISTS idx_cohorts_cohort_id ON api.cohort(cohort_id);",
                "CREATE INDEX IF NOT EXISTS idx_cohorts_user_id_cohort_id ON api.cohort(user_id, cohort_id);",
                "CREATE INDEX IF NOT EXISTS idx_cohorts_latest_version ON api.cohort(cohort_id, user_id, version DESC);",
            ]

            for index_sql in indexes:
                await conn.execute(index_sql)

            logger.info("✅ Indexes created/verified")

            await conn.close()
            return True

        except Exception as e:
            logger.error(f"❌ Error creating indexes: {e}")
            return False

    async def create_update_trigger(self) -> bool:
        """Create trigger to update the updated_at timestamp."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            # Create the function for updating timestamp
            function_sql = """
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
            """

            await conn.execute(function_sql)

            # Create the trigger
            trigger_sql = """
            DROP TRIGGER IF EXISTS update_cohorts_updated_at ON api.cohort;
            CREATE TRIGGER update_cohorts_updated_at 
                BEFORE UPDATE ON api.cohort 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column();
            """

            await conn.execute(trigger_sql)
            logger.info("✅ Update trigger created/verified")

            await conn.close()
            return True

        except Exception as e:
            logger.error(f"❌ Error creating update trigger: {e}")
            return False

    async def grant_permissions(self) -> bool:
        """Grant necessary permissions to postgres role."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            permissions_sql = [
                "GRANT ALL PRIVILEGES ON TABLE api.cohort TO postgres;",
                "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO postgres;",
            ]

            for permission_sql in permissions_sql:
                await conn.execute(permission_sql)

            logger.info("✅ Permissions granted")

            await conn.close()
            return True

        except Exception as e:
            logger.error(f"❌ Error granting permissions: {e}")
            return False

    async def initialize(self) -> bool:
        """Main initialization process."""
        logger.info("🚀 Starting cohort table initialization...")

        # Wait for database to be available
        if not await self.wait_for_database():
            return False

        # Check if table already exists
        if await self.check_cohort_table_exists():
            logger.info("✅ Cohort table already exists")
            # Still try to create foreign key constraint in case auth schema was created later
            await self.create_foreign_key_constraint()
            return True

        # Create api schema
        if not await self.create_api_schema():
            return False

        # Create cohort table
        if not await self.create_cohort_table():
            return False

        # Create foreign key constraint (may fail if auth schema not ready, that's OK)
        await self.create_foreign_key_constraint()

        # Create indexes
        if not await self.create_indexes():
            return False

        # Create update trigger
        if not await self.create_update_trigger():
            return False

        # Grant permissions
        if not await self.grant_permissions():
            return False

        logger.info("🎉 Cohort table initialization completed successfully!")
        return True


async def main():
    """Main function."""
    initializer = CohortTableInitializer()

    try:
        success = await initializer.initialize()
        if success:
            logger.info("🎉 Cohort table initialization completed successfully!")
            sys.exit(0)
        else:
            logger.error("❌ Cohort table initialization failed!")
            sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Unexpected error during initialization: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
