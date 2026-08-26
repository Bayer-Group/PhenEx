#!/usr/bin/env python3
"""
Database initialization script to ensure test users exist.
This script is designed to be run by the backend service on startup.
"""

import asyncio
import sys
import os
import asyncpg
import logging
from argon2 import PasswordHasher

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class UserInitializer:
    def __init__(self):
        self.host = os.getenv("POSTGRES_HOST", "localhost")
        self.port = int(os.getenv("POSTGRES_PORT", "5432"))
        self.database = os.getenv("POSTGRES_DB", "phenex")
        self.user = os.getenv("POSTGRES_USER", "postgres")
        self.password = os.getenv("POSTGRES_PASSWORD")
        self.default_user_password = os.getenv("DEFAULT_USER_PASSWORD", "phenex")
        self.default_user_email_public = os.getenv(
            "DEFAULT_USER_EMAIL_PUBLIC", "public@phenex.ai"
        )
        self.default_user_email_1 = os.getenv("DEFAULT_USER_EMAIL_1", "test@phenex.ai")
        self.default_user_email_2 = os.getenv("DEFAULT_USER_EMAIL_2", "test2@phenex.ai")

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

    async def check_user_exist(self) -> bool:
        """Check if test users already exist."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            test_user_ids = [
                "c0799d5d-2bdf-4da4-8496-4f6d44b8fd26",  # PUBLIC USER
                "00000000-0000-0000-0000-000000000000",  # TEST_USER
                "00000000-0000-0000-0000-000000000001",  # TEST_USER_2
            ]

            existing_user = await conn.fetch(
                "SELECT id FROM public.user WHERE id = ANY($1)", test_user_ids
            )

            await conn.close()

            exists = len(existing_user) == len(test_user_ids)
            if exists:
                logger.info("✅ All test users already exist")
            else:
                logger.info(
                    f"🔄 Found {len(existing_user)}/{len(test_user_ids)} test users"
                )

            return exists

        except Exception as e:
            logger.error(f"❌ Error checking existing users: {e}")
            return False

    async def create_test_users(self) -> bool:
        """Create test users in the users table."""
        try:
            # Hash the default password
            ph = PasswordHasher()
            password_hash = ph.hash(self.default_user_password)

            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password,
            )

            # SQL to create test users
            create_user_sql = """
            -- Insert test users into user table
            INSERT INTO public.user (
                id,
                email,
                password_hash,
                external_id,
                name
            ) VALUES 
            (
                $1,
                $2,
                $3,
                NULL,
                'Public User'
            ),
            (
                $4,
                $5,
                $3,
                NULL,
                'Test User 1'
            ),
            (
                $6,
                $7,
                $3,
                NULL,
                'Test User 2'
            )
            ON CONFLICT (id) DO NOTHING;
            """

            await conn.execute(
                create_user_sql,
                "c0799d5d-2bdf-4da4-8496-4f6d44b8fd26",
                self.default_user_email_public,
                password_hash,
                "00000000-0000-0000-0000-000000000000",
                self.default_user_email_1,
                "00000000-0000-0000-0000-000000000001",
                self.default_user_email_2,
            )
            await conn.close()

            logger.info(
                f"✅ Test users created successfully with password from DEFAULT_USER_PASSWORD env var"
            )
            return True

        except Exception as e:
            logger.error(f"❌ Error creating test users: {e}")
            return False

    async def initialize(self) -> bool:
        """Main initialization process."""
        logger.info("🚀 Starting user initialization...")

        # Wait for database to be available
        if not await self.wait_for_database():
            return False

        # Check if users already exist
        if await self.check_user_exist():
            return True

        # Create test users
        if await self.create_test_users():
            # Verify they were created
            return await self.check_user_exist()

        return False


async def main():
    """Main function."""
    initializer = UserInitializer()

    try:
        success = await initializer.initialize()
        if success:
            logger.info("🎉 User initialization completed successfully!")
            sys.exit(0)
        else:
            logger.error("❌ User initialization failed!")
            sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Unexpected error during initialization: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
