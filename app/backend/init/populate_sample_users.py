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

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UserInitializer:
    def __init__(self):
        self.host = os.getenv("POSTGRES_HOST", "localhost")
        self.port = int(os.getenv("POSTGRES_PORT", "5432"))
        self.database = os.getenv("POSTGRES_DB", "postgres")
        self.user = os.getenv("POSTGRES_USER", "postgres")
        self.password = os.getenv("POSTGRES_PASSWORD")
        
        if not self.password:
            raise ValueError("POSTGRES_PASSWORD environment variable is required")

    async def wait_for_database(self, max_retries: int = 30, delay: float = 2.0) -> bool:
        """Wait for database to be available."""
        for attempt in range(max_retries):
            try:
                conn = await asyncpg.connect(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.user,
                    password=self.password,
                    timeout=5.0
                )
                await conn.close()
                logger.info("✅ Database connection established")
                return True
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1}/{max_retries}: Database not ready - {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(delay)
        
        logger.error("❌ Failed to connect to database after all retries")
        return False

    async def wait_for_auth_schema(self, max_retries: int = 30, delay: float = 2.0) -> bool:
        """Wait for auth schema and users table to be available."""
        for attempt in range(max_retries):
            try:
                conn = await asyncpg.connect(
                    host=self.host,
                    port=self.port,
                    database=self.database,
                    user=self.user,
                    password=self.password,
                    timeout=5.0
                )
                
                # Check if auth schema exists
                schema_exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth')"
                )
                
                # Check if auth.users table exists
                table_exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')"
                )
                
                await conn.close()
                
                if schema_exists and table_exists:
                    logger.info("✅ Auth schema and users table available")
                    return True
                else:
                    logger.info(f"Attempt {attempt + 1}/{max_retries}: Auth schema ready: {schema_exists}, users table ready: {table_exists}")
                    
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1}/{max_retries}: Error checking auth schema - {e}")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(delay)
        
        logger.error("❌ Auth schema/table not available after all retries")
        return False

    async def check_users_exist(self) -> bool:
        """Check if test users already exist."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password
            )
            
            test_user_ids = [
                'c0799d5d-2bdf-4da4-8496-4f6d44b8fd26', # PUBLIC USER
                '00000000-0000-0000-0000-000000000000'  # TEST_USER
            ]
            
            existing_users = await conn.fetch(
                "SELECT id FROM auth.users WHERE id = ANY($1)",
                test_user_ids
            )
            
            await conn.close()
            
            exists = len(existing_users) == len(test_user_ids)
            if exists:
                logger.info("✅ All test users already exist")
            else:
                logger.info(f"🔄 Found {len(existing_users)}/{len(test_user_ids)} test users")
            
            return exists
            
        except Exception as e:
            logger.error(f"❌ Error checking existing users: {e}")
            return False

    async def create_test_users(self) -> bool:
        """Create test users in the auth.users table."""
        try:
            conn = await asyncpg.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password
            )
            
            # SQL to create test users
            create_users_sql = """
            -- Ensure the pgcrypto extension is available for password hashing
            CREATE EXTENSION IF NOT EXISTS pgcrypto;

            -- Insert test users into auth.users table
            INSERT INTO auth.users (
                instance_id,
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                recovery_sent_at,
                last_sign_in_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token,
                email_change,
                email_change_token_new,
                recovery_token
            ) VALUES 
            (
                '00000000-0000-0000-0000-000000000000',
                'c0799d5d-2bdf-4da4-8496-4f6d44b8fd26',
                'authenticated',
                'authenticated',
                'test@phenex.ai',
                crypt('12345678', gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                '{"provider": "email", "providers": ["email"]}',
                '{"name": "Test User"}',
                NOW(),
                NOW(),
                '',
                '',
                '',
                ''
            ),
            (
                '00000000-0000-0000-0000-000000000000',
                '00000000-0000-0000-0000-000000000000',
                'authenticated',
                'authenticated',
                'public@phenex.ai',
                crypt('12345678', gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                '{"provider": "email", "providers": ["email"]}',
                '{"name": "Public User"}',
                NOW(),
                NOW(),
                '',
                '',
                '',
                ''
            )
            ON CONFLICT (id) DO NOTHING;
            """
            
            await conn.execute(create_users_sql)
            await conn.close()
            
            logger.info("✅ Test users created successfully")
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
        
        # Wait for auth schema to be ready
        if not await self.wait_for_auth_schema():
            return False
        
        # Check if users already exist
        if await self.check_users_exist():
            return True
        
        # Create test users
        if await self.create_test_users():
            # Verify they were created
            return await self.check_users_exist()
        
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
