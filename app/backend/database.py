import os
import asyncpg
from typing import List, Dict, Optional
import json
import logging

logger = logging.getLogger(__name__)


class DatabaseManager:
    def __init__(self):
        self.connection_string = self._build_connection_string()
        self.cohorts_table = os.getenv("COHORTS_TABLE", "cohort")
        self.cohorts_schema = os.getenv("COHORTS_SCHEMA", "public")
        self.full_table_name = f"{self.cohorts_schema}.{self.cohorts_table}"

    def _build_connection_string(self) -> str:
        """Build PostgreSQL connection string from environment variables."""
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        database = os.getenv("POSTGRES_DB", "postgres")
        user = os.getenv("POSTGRES_USER", "postgres")
        password = os.getenv("POSTGRES_PASSWORD")

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
        Returns only the latest version of each cohort, prioritizing provisional versions
        when they exist at the highest version number.

        Args:
            user_id (str): The user ID (UUID) whose cohorts to retrieve.

        Returns:
            List[Dict]: A list of cohort objects with id and name.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Query to get the latest version of each cohort, prioritizing provisional versions
            query = f"""
                WITH latest_cohorts AS (
                    SELECT cohort_id, MAX(version) as max_version
                    FROM {self.full_table_name} 
                    WHERE user_id = $1
                    GROUP BY cohort_id
                ),
                prioritized_cohorts AS (
                    SELECT DISTINCT ON (c.cohort_id) 
                           c.cohort_id, c.cohort_data->>'name' as name, c.version, c.is_provisional, c.created_at, c.updated_at
                    FROM {self.full_table_name} c
                    INNER JOIN latest_cohorts lc ON c.cohort_id = lc.cohort_id AND c.version = lc.max_version
                    WHERE c.user_id = $1
                    ORDER BY c.cohort_id, c.is_provisional DESC  -- TRUE comes before FALSE, so provisional is prioritized
                )
                SELECT * FROM prioritized_cohorts
                ORDER BY updated_at DESC
            """

            rows = await conn.fetch(query, user_id)

            cohorts = []
            for row in rows:
                cohorts.append(
                    {
                        "id": row["cohort_id"],
                        "name": row["name"] or f"Cohort {row['cohort_id']}",
                        "version": row["version"],
                        "is_provisional": row["is_provisional"],
                        "created_at": (
                            row["created_at"].isoformat() if row["created_at"] else None
                        ),
                        "updated_at": (
                            row["updated_at"].isoformat() if row["updated_at"] else None
                        ),
                    }
                )

            logger.info(f"Retrieved {len(cohorts)} cohorts for user {user_id}")
            return cohorts

        except Exception as e:
            logger.error(f"Failed to retrieve cohorts for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_cohort_for_user(self, user_id: str, cohort_id: str) -> Optional[Dict]:
        """
        Retrieve a specific cohort for a user from the database.
        Returns the latest cohort, which is either:
        - The highest version number non-provisional, if no provisional exists at the highest version number
        - The highest version number provisional if that exists

        Args:
            user_id (str): The user ID (UUID) whose cohort to retrieve.
            cohort_id (str): The ID of the cohort to retrieve.

        Returns:
            Optional[Dict]: The cohort data or None if not found.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # First, get the highest version number
            max_version_query = f"""
                SELECT MAX(version) as max_version
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2
            """

            max_version_row = await conn.fetchrow(max_version_query, user_id, cohort_id)

            if not max_version_row or max_version_row["max_version"] is None:
                return None

            max_version = max_version_row["max_version"]

            # Check if there's a provisional version at the highest version number
            provisional_query = f"""
                SELECT cohort_data, version, is_provisional, created_at, updated_at 
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2 AND version = $3 AND is_provisional = TRUE
            """

            provisional_row = await conn.fetchrow(
                provisional_query, user_id, cohort_id, max_version
            )

            if provisional_row:
                # Return the provisional version at the highest version number
                cohort_data = {
                    "cohort_data": (
                        provisional_row["cohort_data"]
                        if provisional_row["cohort_data"]
                        else {}
                    ),
                    "version": provisional_row["version"],
                    "is_provisional": provisional_row["is_provisional"],
                    "created_at": (
                        provisional_row["created_at"].isoformat()
                        if provisional_row["created_at"]
                        else None
                    ),
                    "updated_at": (
                        provisional_row["updated_at"].isoformat()
                        if provisional_row["updated_at"]
                        else None
                    ),
                }
                return cohort_data

            # No provisional at highest version, get the highest version non-provisional
            non_provisional_query = f"""
                SELECT cohort_data, version, is_provisional, created_at, updated_at 
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2 AND version = $3 AND is_provisional = FALSE
            """

            non_provisional_row = await conn.fetchrow(
                non_provisional_query, user_id, cohort_id, max_version
            )

            if not non_provisional_row:
                return None

            # Return the non-provisional version at the highest version number
            cohort_data = {
                "cohort_data": (
                    non_provisional_row["cohort_data"]
                    if non_provisional_row["cohort_data"]
                    else {}
                ),
                "version": non_provisional_row["version"],
                "is_provisional": non_provisional_row["is_provisional"],
                "created_at": (
                    non_provisional_row["created_at"].isoformat()
                    if non_provisional_row["created_at"]
                    else None
                ),
                "updated_at": (
                    non_provisional_row["updated_at"].isoformat()
                    if non_provisional_row["updated_at"]
                    else None
                ),
            }

            return cohort_data

        except Exception as e:
            logger.error(
                f"Failed to retrieve cohort {cohort_id} for user {user_id}: {e}"
            )
            raise
        finally:
            if conn:
                await conn.close()

    async def update_cohort_for_user(
        self,
        user_id: str,
        cohort_id: str,
        cohort_data: Dict,
        provisional: bool = False,
        new_version: bool = False,
    ) -> bool:
        """
        Update or create a cohort for a user in the database.

        Args:
            user_id (str): The user ID (UUID) whose cohort to update.
            cohort_id (str): The ID of the cohort to update.
            cohort_data (Dict): The cohort data.
            provisional (bool): Whether to save as provisional.
            new_version (bool): If True, increment version. If False, replace existing version.

        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()

            if new_version:
                # Original behavior: increment version
                version_query = f"""
                    SELECT MAX(version) as max_version 
                    FROM {self.full_table_name} 
                    WHERE user_id = $1 AND cohort_id = $2
                """

                version_row = await conn.fetchrow(version_query, user_id, cohort_id)
                current_max_version = (
                    version_row["max_version"]
                    if version_row and version_row["max_version"]
                    else 0
                )
                target_version = current_max_version + 1

                # Insert the new version
                insert_query = f"""
                    INSERT INTO {self.full_table_name} (cohort_id, user_id, version, cohort_data, is_provisional, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                """

                await conn.execute(
                    insert_query,
                    cohort_id,
                    user_id,
                    target_version,
                    json.dumps(cohort_data),
                    provisional,
                )

                logger.info(
                    f"Successfully created cohort {cohort_id} version {target_version} for user {user_id} (provisional: {provisional})"
                )
            else:
                # New behavior: replace existing version or create at version 1
                # First, get the current max version
                version_query = f"""
                    SELECT MAX(version) as max_version 
                    FROM {self.full_table_name} 
                    WHERE user_id = $1 AND cohort_id = $2
                """

                version_row = await conn.fetchrow(version_query, user_id, cohort_id)
                current_max_version = (
                    version_row["max_version"]
                    if version_row and version_row["max_version"]
                    else 0
                )

                if current_max_version == 0:
                    # No existing cohort, create version 1
                    target_version = 1

                    insert_query = f"""
                        INSERT INTO {self.full_table_name} (cohort_id, user_id, version, cohort_data, is_provisional, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                    """

                    await conn.execute(
                        insert_query,
                        cohort_id,
                        user_id,
                        target_version,
                        json.dumps(cohort_data),
                        provisional,
                    )

                    logger.info(
                        f"Successfully created new cohort {cohort_id} version {target_version} for user {user_id} (provisional: {provisional})"
                    )
                else:
                    target_version = current_max_version

                    if provisional:
                        # If provisional, first try to update existing provisional row, otherwise insert new one
                        update_provisional_query = f"""
                            UPDATE {self.full_table_name} 
                            SET cohort_data = $3, updated_at = NOW()
                            WHERE user_id = $1 AND cohort_id = $2 AND version = $4 AND is_provisional = TRUE
                        """

                        result = await conn.execute(
                            update_provisional_query,
                            user_id,
                            cohort_id,
                            json.dumps(cohort_data),
                            target_version,
                        )

                        if result == "UPDATE 0":
                            # No existing provisional row found, insert new one
                            insert_query = f"""
                                INSERT INTO {self.full_table_name} (cohort_id, user_id, version, cohort_data, is_provisional, created_at, updated_at)
                                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                            """

                            await conn.execute(
                                insert_query,
                                cohort_id,
                                user_id,
                                target_version,
                                json.dumps(cohort_data),
                                True,  # Always provisional for this case
                            )

                            logger.info(
                                f"Successfully created provisional cohort {cohort_id} version {target_version} for user {user_id}"
                            )
                        else:
                            logger.info(
                                f"Successfully updated existing provisional cohort {cohort_id} version {target_version} for user {user_id}"
                            )
                    else:
                        # Replace existing version (update the existing row)
                        update_query = f"""
                            UPDATE {self.full_table_name} 
                            SET cohort_data = $3, updated_at = NOW()
                            WHERE user_id = $1 AND cohort_id = $2 AND version = $4 AND is_provisional = FALSE
                        """

                        result = await conn.execute(
                            update_query,
                            user_id,
                            cohort_id,
                            json.dumps(cohort_data),
                            target_version,
                        )

                        if result == "UPDATE 0":
                            # No non-provisional version found, insert new one
                            insert_query = f"""
                                INSERT INTO {self.full_table_name} (cohort_id, user_id, version, cohort_data, is_provisional, created_at, updated_at)
                                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                            """

                            await conn.execute(
                                insert_query,
                                cohort_id,
                                user_id,
                                target_version,
                                json.dumps(cohort_data),
                                False,
                            )

                            logger.info(
                                f"Successfully created cohort {cohort_id} version {target_version} for user {user_id} (no existing non-provisional version)"
                            )
                        else:
                            logger.info(
                                f"Successfully updated cohort {cohort_id} version {target_version} for user {user_id}"
                            )

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

            logger.info(
                f"Successfully deleted all versions of cohort {cohort_id} for user {user_id}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to delete cohort {cohort_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def accept_changes(self, user_id: str, cohort_id: str) -> bool:
        """
        Accept provisional changes by setting is_provisional to False for the provisional cohort
        and deleting any existing non-provisional cohort at the same version.

        Args:
            user_id (str): The user ID (UUID).
            cohort_id (str): The ID of the cohort.

        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Begin transaction
            async with conn.transaction():
                # Get the latest provisional version and its data
                provisional_query = f"""
                    SELECT version, cohort_data
                    FROM {self.full_table_name} 
                    WHERE user_id = $1 AND cohort_id = $2 AND is_provisional = TRUE
                    ORDER BY version DESC
                    LIMIT 1
                """

                provisional_row = await conn.fetchrow(
                    provisional_query, user_id, cohort_id
                )

                if not provisional_row:
                    return False  # No provisional version found

                target_version = provisional_row["version"]

                # Delete any existing non-provisional cohort at the same version
                delete_query = f"""
                    DELETE FROM {self.full_table_name} 
                    WHERE user_id = $1 AND cohort_id = $2 AND version = $3 AND is_provisional = FALSE
                """

                await conn.execute(delete_query, user_id, cohort_id, target_version)

                # Set the provisional cohort to non-provisional
                update_query = f"""
                    UPDATE {self.full_table_name} 
                    SET is_provisional = FALSE, updated_at = NOW()
                    WHERE user_id = $1 AND cohort_id = $2 AND version = $3 AND is_provisional = TRUE
                """

                result = await conn.execute(
                    update_query, user_id, cohort_id, target_version
                )

                if result == "UPDATE 0":
                    return False  # No provisional version found

            logger.info(
                f"Successfully accepted changes for cohort {cohort_id} version {target_version} for user {user_id}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to accept changes for cohort {cohort_id} for user {user_id}: {e}"
            )
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

            logger.info(
                f"Successfully rejected changes for cohort {cohort_id} for user {user_id} (deleted {result.split()[1]} rows)"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to reject changes for cohort {cohort_id} for user {user_id}: {e}"
            )
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
                cohorts.append(
                    {
                        "id": row["cohort_id"],
                        "user_id": row["user_id"],
                        "name": row["name"] or f"Cohort {row['cohort_id']}",
                        "version": row["version"],
                        "created_at": (
                            row["created_at"].isoformat() if row["created_at"] else None
                        ),
                        "updated_at": (
                            row["updated_at"].isoformat() if row["updated_at"] else None
                        ),
                    }
                )

            logger.info(f"Retrieved {len(cohorts)} public cohorts")
            return cohorts

        except Exception as e:
            logger.error(f"Failed to retrieve public cohorts: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_changes_for_user(self, user_id: str, cohort_id: str) -> Dict:
        """
        Compare the most recent provisional cohort to the most recent non-provisional cohort.
        Returns an empty dict if there is no provisional cohort.

        Args:
            user_id (str): The user ID (UUID).
            cohort_id (str): The ID of the cohort.

        Returns:
            Dict: Dictionary of changes between provisional and non-provisional versions.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Get the most recent provisional cohort
            provisional_query = f"""
                SELECT cohort_data 
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2 AND is_provisional = TRUE
                ORDER BY version DESC
                LIMIT 1
            """

            provisional_row = await conn.fetchrow(provisional_query, user_id, cohort_id)

            # If no provisional cohort exists, return empty dict
            if not provisional_row:
                logger.info(
                    f"No provisional cohort found for user {user_id}, cohort {cohort_id}"
                )
                return {}

            # Get the most recent non-provisional cohort
            non_provisional_query = f"""
                SELECT cohort_data 
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2 AND is_provisional = FALSE
                ORDER BY version DESC
                LIMIT 1
            """

            non_provisional_row = await conn.fetchrow(
                non_provisional_query, user_id, cohort_id
            )

            # If no non-provisional cohort exists, return empty dict
            if not non_provisional_row:
                logger.info(
                    f"No non-provisional cohort found for user {user_id}, cohort {cohort_id}"
                )
                return {}

            provisional_data = provisional_row["cohort_data"]
            non_provisional_data = non_provisional_row["cohort_data"]

            # Use DeepDiff to calculate differences
            from deepdiff import DeepDiff

            diff = DeepDiff(provisional_data, non_provisional_data, ignore_order=True)

            logger.info(
                f"Calculated differences for cohort {cohort_id} for user {user_id}: {diff}"
            )
            return dict(diff) if diff else {}

        except Exception as e:
            logger.error(
                f"Failed to get changes for cohort {cohort_id} for user {user_id}: {e}"
            )
            raise
        finally:
            if conn:
                await conn.close()


# Global instance
db_manager = DatabaseManager()
