import os
import asyncpg
from typing import List, Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.connection_string = self._build_connection_string()
        self.cohorts_table = os.getenv('COHORTS_TABLE', 'cohorts')
        self.cohorts_schema = os.getenv('COHORTS_SCHEMA', 'public')
        self.full_table_name = f"{self.cohorts_schema}.{self.cohorts_table}"
    
    def _build_connection_string(self) -> str:
        """Build PostgreSQL connection string from environment variables."""
        host = os.getenv('POSTGRES_HOST', 'localhost')
        port = os.getenv('POSTGRES_PORT', '5432')
        database = os.getenv('POSTGRES_DB', 'postgres')
        user = os.getenv('POSTGRES_USER', 'postgres')
        password = os.getenv('POSTGRES_PASSWORD')
        
        if not password:
            raise ValueError("POSTGRES_PASSWORD environment variable is required")
        
        return f"postgresql://{user}:{password}@{host}:{port}/{database}"
    
    async def get_connection(self):
        """Get a database connection."""
        try:
            conn = await asyncpg.connect(self.connection_string)
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    async def get_all_cohorts_for_user(self, user_id: str) -> List[Dict]:
        """
        Retrieve all cohorts for a specific user from the database.
        Returns only the latest version of each cohort.
        
        Args:
            user_id (str): The user ID (UUID) whose cohorts to retrieve.
            
        Returns:
            List[Dict]: A list of cohort objects with id and name.
        """
        conn = None
        try:
            conn = await self.get_connection()
            
            # Query to get the latest version of each cohort for the user
            query = f"""
                WITH latest_cohorts AS (
                    SELECT cohort_id, MAX(version) as max_version
                    FROM {self.full_table_name} 
                    WHERE user_id = $1
                    GROUP BY cohort_id
                )
                SELECT c.cohort_id, c.cohort_data->>'name' as name, c.version, c.is_provisional, c.created_at, c.updated_at 
                FROM {self.full_table_name} c
                INNER JOIN latest_cohorts lc ON c.cohort_id = lc.cohort_id AND c.version = lc.max_version
                WHERE c.user_id = $1
                ORDER BY c.updated_at DESC
            """
            
            rows = await conn.fetch(query, user_id)
            
            cohorts = []
            for row in rows:
                cohorts.append({
                    "id": row['cohort_id'],
                    "name": row['name'] or f"Cohort {row['cohort_id']}",
                    "version": row['version'],
                    "is_provisional": row['is_provisional'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                    "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
                })
            
            logger.info(f"Retrieved {len(cohorts)} cohorts for user {user_id}")
            return cohorts
            
        except Exception as e:
            logger.error(f"Failed to retrieve cohorts for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()
    
    async def get_cohort_for_user(self, user_id: str, cohort_id: str, provisional: bool = False) -> Optional[Dict]:
        """
        Retrieve a specific cohort for a user from the database.
        Returns the latest version of the cohort.
        
        Args:
            user_id (str): The user ID (UUID) whose cohort to retrieve.
            cohort_id (str): The ID of the cohort to retrieve.
            provisional (bool): Whether to retrieve the provisional version (ignored, returns latest version).
            
        Returns:
            Optional[Dict]: The cohort data or None if not found.
        """
        conn = None
        try:
            conn = await self.get_connection()
            
            # Get the latest version of the cohort for the user
            query = f"""
                SELECT cohort_data, version, is_provisional, created_at, updated_at 
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2
                ORDER BY version DESC
                LIMIT 1
            """
            logger.info(query)
            logger.info(user_id)
            logger.info(cohort_id)
            
            row = await conn.fetchrow(query, user_id, cohort_id)
            if not len(row):
                return None
            
            # Get JSON
            cohort_data = {
                "cohort_data": row['cohort_data'] if row['cohort_data'] else {},
                "version": row['version'],
                "is_provisional": row['is_provisional'],
                "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
            }
            
            return cohort_data
            
        except Exception as e:
            logger.error(f"Failed to retrieve cohort {cohort_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()
    
    async def update_cohort_for_user(self, user_id: str, cohort_id: str, cohort_data: Dict, provisional: bool = False) -> bool:
        """
        Update or create a cohort for a user in the database.
        When creating a new cohort, version starts at 1.
        When updating an existing cohort, version is incremented.
        
        Args:
            user_id (str): The user ID (UUID) whose cohort to update.
            cohort_id (str): The ID of the cohort to update.
            cohort_data (Dict): The cohort data.
            provisional (bool): Whether to save as provisional.
            
        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()
            
            # Get the current max version for this cohort
            version_query = f"""
                SELECT MAX(version) as max_version 
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2
            """
            
            version_row = await conn.fetchrow(version_query, user_id, cohort_id)
            current_max_version = version_row['max_version'] if version_row and version_row['max_version'] else 0
            new_version = current_max_version + 1
            
            # Insert the new version
            insert_query = f"""
                INSERT INTO {self.full_table_name} (cohort_id, user_id, version, cohort_data, is_provisional, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            """
            
            await conn.execute(insert_query, cohort_id, user_id, new_version, json.dumps(cohort_data), provisional)
            
            logger.info(f"Successfully created cohort {cohort_id} version {new_version} for user {user_id} (provisional: {provisional})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update cohort {cohort_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()
    
    async def delete_cohort_for_user(self, user_id: str, cohort_id: str) -> bool:
        """
        Delete all versions of a cohort for a user from the database.
        
        Args:
            user_id (str): The user ID (UUID) whose cohort to delete.
            cohort_id (str): The ID of the cohort to delete.
            
        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()
            
            query = f"""
                DELETE FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2
            """
            
            result = await conn.execute(query, user_id, cohort_id)
            
            if result == "DELETE 0":
                return False  # Cohort not found
            
            logger.info(f"Successfully deleted all versions of cohort {cohort_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete cohort {cohort_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def accept_changes(self, user_id: str, cohort_id: str) -> bool:
        """
        Accept provisional changes by setting is_provisional to False for the latest version.
        
        Args:
            user_id (str): The user ID (UUID).
            cohort_id (str): The ID of the cohort.
            
        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()
            
            # Get the latest version that is provisional
            query = f"""
                UPDATE {self.full_table_name} 
                SET is_provisional = FALSE, updated_at = NOW()
                WHERE user_id = $1 AND cohort_id = $2 
                AND version = (
                    SELECT MAX(version) 
                    FROM {self.full_table_name} 
                    WHERE user_id = $1 AND cohort_id = $2 AND is_provisional = TRUE
                )
                AND is_provisional = TRUE
            """
            
            result = await conn.execute(query, user_id, cohort_id)
            
            if result == "UPDATE 0":
                return False  # No provisional version found
            
            logger.info(f"Successfully accepted changes for cohort {cohort_id} for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to accept changes for cohort {cohort_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def reject_changes(self, user_id: str, cohort_id: str) -> bool:
        """
        Reject provisional changes by deleting all provisional versions.
        
        Args:
            user_id (str): The user ID (UUID).
            cohort_id (str): The ID of the cohort.
            
        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()
            
            query = f"""
                DELETE FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2 AND is_provisional = TRUE
            """
            
            result = await conn.execute(query, user_id, cohort_id)
            
            logger.info(f"Successfully rejected changes for cohort {cohort_id} for user {user_id} (deleted {result.split()[1]} rows)")
            return True
            
        except Exception as e:
            logger.error(f"Failed to reject changes for cohort {cohort_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_public_cohorts(self) -> List[Dict]:
        """
        Retrieve all public cohorts (latest versions only).
        
        Returns:
            List[Dict]: A list of public cohort objects.
        """
        conn = None
        try:
            conn = await self.get_connection()
            
            # Query to get the latest version of each public cohort
            query = f"""
                WITH latest_public_cohorts AS (
                    SELECT cohort_id, user_id, MAX(version) as max_version
                    FROM {self.full_table_name} 
                    WHERE is_public = TRUE
                    GROUP BY cohort_id, user_id
                )
                SELECT c.cohort_id, c.user_id, c.cohort_data->>'name' as name, c.version, c.created_at, c.updated_at 
                FROM {self.full_table_name} c
                INNER JOIN latest_public_cohorts lpc ON c.cohort_id = lpc.cohort_id 
                    AND c.user_id = lpc.user_id 
                    AND c.version = lpc.max_version
                WHERE c.is_public = TRUE
                ORDER BY c.updated_at DESC
            """
            
            rows = await conn.fetch(query)
            
            cohorts = []
            for row in rows:
                cohorts.append({
                    "id": row['cohort_id'],
                    "user_id": row['user_id'],
                    "name": row['name'] or f"Cohort {row['cohort_id']}",
                    "version": row['version'],
                    "created_at": row['created_at'].isoformat() if row['created_at'] else None,
                    "updated_at": row['updated_at'].isoformat() if row['updated_at'] else None
                })
            
            logger.info(f"Retrieved {len(cohorts)} public cohorts")
            return cohorts
            
        except Exception as e:
            logger.error(f"Failed to retrieve public cohorts: {e}")
            raise
        finally:
            if conn:
                await conn.close()

# Global instance
db_manager = DatabaseManager()
