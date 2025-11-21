import os
import asyncpg
from typing import List, Dict, Optional, TYPE_CHECKING
import json
import logging

import confuse  # type: ignore
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker, Session

from .domain.user import User, UserID


if TYPE_CHECKING:
    from confuse import ConfigView

logger = logging.getLogger(__name__)


_engine = None
_sm = None


def get_engine(config: "ConfigView"):
    global _engine, _sm
    if not _engine:
        _engine = create_engine(
            url=config["url"].get(str),
            future=True,
            echo=config["echo"].get(confuse.Optional(bool, default=False)),
            pool_pre_ping=True,
        )
        _sm = sessionmaker(_engine)

    return _engine


def get_sm(config: "ConfigView") -> sessionmaker:
    global _sm
    if not _sm:
        get_engine(config)
    return _sm


def get_user_by_id(session: Session, user_id: UserID) -> Optional[User]:
    return session.get(User, user_id)


def get_user_by_email(session: Session, email: str) -> Optional[User]:
    return session.scalar(select(User).where(User.email == email))


def get_user_by_external_id(session: Session, external_id: str) -> Optional[User]:
    return session.scalar(select(User).where(User.external_id == external_id))


def lock_user_db(session: Session) -> None:
    session.execute(text(f'LOCK TABLE "{User.__table__.name}"'))


class DatabaseManager:
    def __init__(self):
        self.connection_string = self._build_connection_string()
        self.cohorts_table = os.getenv("COHORTS_TABLE", "cohort")
        self.cohorts_schema = os.getenv("COHORTS_SCHEMA", "public")
        self.full_table_name = f"{self.cohorts_schema}.{self.cohorts_table}"
        
        # Studies table configuration
        self.studies_table = os.getenv("STUDIES_TABLE", "study")
        self.studies_schema = os.getenv("STUDIES_SCHEMA", "public")
        self.full_studies_table_name = f"{self.studies_schema}.{self.studies_table}"

    def _build_connection_string(self) -> str:
        """Build PostgreSQL connection string from environment variables."""
        host = os.getenv("POSTGRES_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT", "5432")
        database = os.getenv("POSTGRES_DB", "phenex")
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
                SELECT cohort_data, version, is_provisional, created_at, updated_at, study_id
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2 AND version = $3 AND is_provisional = TRUE
            """

            provisional_row = await conn.fetchrow(
                provisional_query, user_id, cohort_id, max_version
            )

            if provisional_row:
                # Return the provisional version at the highest version number
                # Parse the cohort_data JSON string back to an object
                parsed_cohort_data = (
                    json.loads(provisional_row["cohort_data"])
                    if provisional_row["cohort_data"]
                    else {}
                )
                
                cohort_data = {
                    "cohort_data": parsed_cohort_data,
                    "version": provisional_row["version"],
                    "is_provisional": provisional_row["is_provisional"],
                    "study_id": provisional_row["study_id"],
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
                SELECT cohort_data, version, is_provisional, created_at, updated_at, study_id
                FROM {self.full_table_name} 
                WHERE user_id = $1 AND cohort_id = $2 AND version = $3 AND is_provisional = FALSE
            """

            non_provisional_row = await conn.fetchrow(
                non_provisional_query, user_id, cohort_id, max_version
            )

            if not non_provisional_row:
                return None

            # Return the non-provisional version at the highest version number
            # Parse the cohort_data JSON string back to an object
            parsed_cohort_data = (
                json.loads(non_provisional_row["cohort_data"])
                if non_provisional_row["cohort_data"]
                else {}
            )
            
            cohort_data = {
                "cohort_data": parsed_cohort_data,
                "version": non_provisional_row["version"],
                "is_provisional": non_provisional_row["is_provisional"],
                "study_id": non_provisional_row["study_id"],
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
        study_id: str,
        provisional: bool = False,
        new_version: bool = False,
        parent_cohort_id: str = None,
    ) -> bool:
        """
        Update or create a cohort for a user in the database.

        Args:
            user_id (str): The user ID (UUID) whose cohort to update.
            cohort_id (str): The ID of the cohort to update.
            cohort_data (Dict): The cohort data.
            study_id (str): The ID of the study this cohort belongs to.
            provisional (bool): Whether to save as provisional.
            new_version (bool): If True, increment version. If False, replace existing version.
            parent_cohort_id (str, optional): The ID of the parent cohort for subcohorts.

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
                    INSERT INTO {self.full_table_name} (cohort_id, user_id, study_id, parent_cohort_id, version, cohort_data, is_provisional, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                """

                await conn.execute(
                    insert_query,
                    cohort_id,
                    user_id,
                    study_id,
                    parent_cohort_id,
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
                        INSERT INTO {self.full_table_name} (cohort_id, user_id, study_id, parent_cohort_id, version, cohort_data, is_provisional, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                    """

                    await conn.execute(
                        insert_query,
                        cohort_id,
                        user_id,
                        study_id,
                        parent_cohort_id,
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
                                INSERT INTO {self.full_table_name} (cohort_id, user_id, study_id, parent_cohort_id, version, cohort_data, is_provisional, created_at, updated_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                            """

                            await conn.execute(
                                insert_query,
                                cohort_id,
                                user_id,
                                study_id,
                                parent_cohort_id,
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
                                INSERT INTO {self.full_table_name} (cohort_id, user_id, study_id, parent_cohort_id, version, cohort_data, is_provisional, created_at, updated_at)
                                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                            """

                            await conn.execute(
                                insert_query,
                                cohort_id,
                                user_id,
                                study_id,
                                parent_cohort_id,
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

    async def get_all_codelists_for_user(self, user_id: str) -> List[Dict]:
        """
        Retrieve all codelists for a specific user from the database.
        Returns only the latest version of each codelist.

        Args:
            user_id (str): The user ID (UUID) whose codelists to retrieve.

        Returns:
            List[Dict]: A list of codelist objects.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Query to get the latest version of each codelist
            query = """
                WITH latest_codelists AS (
                    SELECT codelist_id, MAX(version) as max_version
                    FROM codelistfile 
                    WHERE user_id = $1
                    GROUP BY codelist_id
                )
                SELECT c.codelist_id, c.codelist_data->'filename' as filename, c.codelists, c.created_at, c.updated_at 
                FROM codelistfile c
                INNER JOIN latest_codelists lc ON c.codelist_id = lc.codelist_id AND c.version = lc.max_version
                WHERE c.user_id = $1
                ORDER BY c.updated_at DESC
            """

            rows = await conn.fetch(query, user_id)

            codelists = []
            for row in rows:
                codelists.append({
                    "id": row["codelist_id"],
                    "filename": row["filename"],
                    "codelists": row["codelists"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                })

            logger.info(f"Retrieved {len(codelists)} codelists for user {user_id}")
            return codelists

        except Exception as e:
            logger.error(f"Failed to retrieve codelists for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_codelists_for_cohort(self, cohort_id: str) -> List[Dict]:
        """
        Retrieve all codelists associated with a specific cohort.
        Includes cached codelists array and column mapping for optimization.

        Args:
            cohort_id (str): The ID of the cohort.

        Returns:
            List[Dict]: A list of codelist objects associated with the cohort.
        """
        conn = None
        try:
            conn = await self.get_connection()

            query = """
                SELECT 
                    codelist_id, 
                    codelist_data->'filename' as filename, 
                    codelists, 
                    column_mapping,
                    created_at, 
                    updated_at 
                FROM codelistfile 
                WHERE cohort_id = $1
                ORDER BY updated_at DESC
            """

            rows = await conn.fetch(query, cohort_id)

            codelists = []
            for row in rows:
                # Parse column_mapping if it's a string
                column_mapping = row["column_mapping"]
                if isinstance(column_mapping, str):
                    column_mapping = json.loads(column_mapping)
                
                codelists.append({
                    "id": row["codelist_id"],
                    "filename": row["filename"],
                    "codelists": row["codelists"],
                    "code_column": column_mapping.get("code_column") if column_mapping else None,
                    "code_type_column": column_mapping.get("code_type_column") if column_mapping else None,
                    "codelist_column": column_mapping.get("codelist_column") if column_mapping else None,
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                })

            logger.info(f"Retrieved {len(codelists)} codelists for cohort {cohort_id}")
            return codelists

        except Exception as e:
            logger.error(f"Failed to retrieve codelists for cohort {cohort_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_codelist(self, user_id: str, codelist_id: str) -> Optional[Dict]:
        """
        Retrieve a specific codelist for a user from the database.
        Returns the latest version.

        Args:
            user_id (str): The user ID (UUID) whose codelist to retrieve.
            codelist_id (str): The ID of the codelist to retrieve.

        Returns:
            Optional[Dict]: The codelist data or None if not found.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Get the highest version
            query = """
                SELECT codelist_data, column_mapping, codelists, version, created_at, updated_at 
                FROM codelistfile 
                WHERE user_id = $1 AND codelist_id = $2
                ORDER BY version DESC
                LIMIT 1
            """

            row = await conn.fetchrow(query, user_id, codelist_id)

            if not row:
                return None

            codelist_data = {
                "codelist_data": row["codelist_data"],
                "column_mapping": row["column_mapping"],
                "codelists": row["codelists"],
                "version": row["version"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }

            return codelist_data

        except Exception as e:
            logger.error(f"Failed to retrieve codelist {codelist_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def save_codelist(self, user_id: str, codelist_id: str, codelist_data: Dict, column_mapping: Dict, codelists: List[str], cohort_id: Optional[str] = None) -> bool:
        """
        Save a codelist to the database. Creates a new version if it already exists.

        Args:
            user_id (str): The user ID (UUID).
            codelist_id (str): The ID of the codelist.
            codelist_data (Dict): The codelist data.
            column_mapping (Dict): The column mapping.
            codelists (List[str]): List of codelist names contained in the file.
            cohort_id (Optional[str]): The ID of the associated cohort, if applicable.

        Returns:
            bool: True if successful.
        """
        conn = None
        logger.info(f"save_codelist: Getting to save codelist {codelist_id} for user {user_id}")
        try:
            conn = await self.get_connection()

            # Get the current max version
            version_query = """
                SELECT MAX(version) as max_version 
                FROM codelistfile 
                WHERE codelist_id = $1
            """

            version_row = await conn.fetchrow(version_query, codelist_id)
            current_max_version = version_row["max_version"] if version_row and version_row["max_version"] else 0
            target_version = current_max_version + 1

            # Insert the new version
            if cohort_id:
                insert_query = """
                    INSERT INTO codelistfile (codelist_id, user_id, cohort_id, version, codelist_data, column_mapping, codelists, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                """
                await conn.execute(insert_query, codelist_id, user_id, cohort_id, target_version, json.dumps(codelist_data), json.dumps(column_mapping), codelists)
            else:
                insert_query = """
                    INSERT INTO codelistfile (codelist_id, user_id, version, codelist_data, column_mapping, codelists, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                """
                await conn.execute(insert_query, codelist_id, user_id, target_version, json.dumps(codelist_data), json.dumps(column_mapping), codelists)

            logger.info(f"Successfully saved codelist {codelist_id} version {target_version} for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to save codelist {codelist_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def update_codelist(self, user_id: str, codelist_id: str, codelist_data: Dict = None, column_mapping: Dict = None, codelists: List[str] = None) -> bool:
        """
        Update an existing codelist without creating a new version.

        Args:
            user_id (str): The user ID (UUID).
            codelist_id (str): The ID of the codelist.
            codelist_data (Dict, optional): The codelist data to update.
            column_mapping (Dict, optional): The column mapping to update.
            codelists (List[str], optional): List of codelist names to update.

        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Get the current max version
            version_query = """
                SELECT MAX(version) as max_version 
                FROM codelistfile 
                WHERE codelist_id = $1 AND user_id = $2
            """

            version_row = await conn.fetchrow(version_query, codelist_id, user_id)
            
            if not version_row or not version_row["max_version"]:
                return False  # Codelist doesn't exist

            current_version = version_row["max_version"]
            
            # Prepare update query parts
            update_parts = []
            params = [user_id, codelist_id, current_version]
            param_idx = 4
            
            if codelist_data is not None:
                update_parts.append(f"codelist_data = ${param_idx}")
                params.append(json.dumps(codelist_data))
                param_idx += 1
                
            if column_mapping is not None:
                update_parts.append(f"column_mapping = ${param_idx}")
                params.append(json.dumps(column_mapping))
                param_idx += 1
                
            if codelists is not None:
                update_parts.append(f"codelists = ${param_idx}")
                params.append(codelists)
                param_idx += 1
            
            update_parts.append("updated_at = NOW()")
            
            if not update_parts:
                return True  # Nothing to update
            
            # Construct and execute the update query
            update_query = f"""
                UPDATE codelistfile 
                SET {", ".join(update_parts)}
                WHERE user_id = $1 AND codelist_id = $2 AND version = $3
            """
            
            result = await conn.execute(update_query, *params)
            
            if result == "UPDATE 0":
                return False  # No rows updated
            
            logger.info(f"Successfully updated codelist {codelist_id} for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to update codelist {codelist_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def delete_codelist(self, user_id: str, codelist_id: str) -> bool:
        """
        Delete a codelist for a user from the database.

        Args:
            user_id (str): The user ID (UUID) whose codelist to delete.
            codelist_id (str): The ID of the codelist to delete.

        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()

            query = """
                DELETE FROM codelistfile 
                WHERE user_id = $1 AND codelist_id = $2
            """

            result = await conn.execute(query, user_id, codelist_id)

            if result == "DELETE 0":
                return False  # Codelist not found

            logger.info(f"Successfully deleted codelist {codelist_id} for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete codelist {codelist_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    def get_user_by_id(self, user_id: str) -> User: ...

    # Study management methods
    async def get_all_studies_for_user(self, user_id: str) -> List[Dict]:
        """
        Retrieve all studies for a specific user from the database.
        Returns studies where the user is the creator or is in the visible_by list.

        Args:
            user_id (str): The user ID (UUID) whose studies to retrieve.

        Returns:
            List[Dict]: A list of study objects with id, name, and metadata.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Query to get studies where user is creator or in visible_by list
            query = """
                SELECT study_id, name, description, is_public, created_at, updated_at,
                       user_id as creator_id, visible_by, display_order
                FROM study 
                WHERE user_id = $1 OR $1 = ANY(visible_by)
                ORDER BY display_order ASC, updated_at DESC
            """

            rows = await conn.fetch(query, user_id)

            studies = []
            for row in rows:
                studies.append({
                    "id": row["study_id"],
                    "name": row["name"],
                    "description": row["description"],
                    "is_public": row["is_public"],
                    "creator_id": row["creator_id"],
                    "visible_by": row["visible_by"],
                    "display_order": row["display_order"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                })

            logger.info(f"Retrieved {len(studies)} studies for user {user_id}")
            return studies

        except Exception as e:
            logger.error(f"Failed to retrieve studies for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_all_public_studies(self) -> List[Dict]:
        """
        Retrieve all public studies (is_public=True) from the database.
        
        Returns:
            List[Dict]: A list of public study objects with id, name, and metadata.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Query to get only studies that are marked as public
            query = """
                SELECT study_id, name, description, is_public, created_at, updated_at,
                       user_id as creator_id, visible_by, display_order
                FROM study 
                WHERE is_public = TRUE
                ORDER BY display_order ASC, updated_at DESC
            """

            rows = await conn.fetch(query)

            studies = []
            for row in rows:
                studies.append({
                    "id": row["study_id"],
                    "name": row["name"],
                    "description": row["description"],
                    "is_public": row["is_public"],
                    "creator_id": row["creator_id"],
                    "visible_by": row["visible_by"],
                    "display_order": row["display_order"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                })

            logger.info(f"Retrieved {len(studies)} public studies")
            return studies

        except Exception as e:
            logger.error(f"Failed to retrieve public studies: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_study_for_user(self, user_id: str, study_id: str) -> Optional[Dict]:
        """
        Retrieve a specific study for a user from the database.
        Returns the study if the user has access (creator, in visible_by list, or public).

        Args:
            user_id (str): The user ID (UUID) requesting the study.
            study_id (str): The ID of the study to retrieve.

        Returns:
            Optional[Dict]: The study data or None if not found or no access.
        """
        conn = None
        try:
            conn = await self.get_connection()

            query = """
                SELECT study_id, name, description, baseline_characteristics, outcomes, analysis,
                       is_public, user_id as creator_id, visible_by, created_at, updated_at
                FROM study 
                WHERE study_id = $1 AND (user_id = $2 OR $2 = ANY(visible_by) OR is_public = TRUE)
            """

            row = await conn.fetchrow(query, study_id, user_id)

            if not row:
                return None

            study_data = {
                "id": row["study_id"],
                "name": row["name"],
                "description": row["description"],
                "baseline_characteristics": row["baseline_characteristics"],
                "outcomes": row["outcomes"],
                "analysis": row["analysis"],
                "is_public": row["is_public"],
                "creator_id": row["creator_id"],
                "visible_by": row["visible_by"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }

            return study_data

        except Exception as e:
            logger.error(f"Failed to retrieve study {study_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def update_study_for_user(
        self,
        user_id: str,
        study_id: str,
        name: str,
        description: str = None,
        baseline_characteristics: Dict = None,
        outcomes: Dict = None,
        analysis: Dict = None,
        visible_by: List[str] = None,
        is_public: bool = False,
    ) -> bool:
        """
        Update or create a study for a user in the database.

        Args:
            user_id (str): The user ID (UUID) creating/updating the study.
            study_id (str): The ID of the study to update/create.
            name (str): The name of the study.
            description (str, optional): The description of the study.
            baseline_characteristics (Dict, optional): The baseline characteristics.
            outcomes (Dict, optional): The outcomes.
            analysis (Dict, optional): The analysis parameters.
            visible_by (List[str], optional): List of user IDs who can see this study.
            is_public (bool): Whether the study is public.

        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Check if study already exists
            check_query = "SELECT study_id FROM study WHERE study_id = $1"
            existing = await conn.fetchrow(check_query, study_id)

            if existing:
                # Update existing study (only if user is the creator)
                update_query = """
                    UPDATE study 
                    SET name = $3, description = $4, baseline_characteristics = $5, 
                        outcomes = $6, analysis = $7, visible_by = $8, is_public = $9,
                        updated_at = NOW()
                    WHERE study_id = $1 AND user_id = $2
                """

                result = await conn.execute(
                    update_query,
                    study_id,
                    user_id,
                    name,
                    description,
                    json.dumps(baseline_characteristics) if baseline_characteristics else None,
                    json.dumps(outcomes) if outcomes else None,
                    json.dumps(analysis) if analysis else None,
                    visible_by or [],
                    is_public,
                )

                if result == "UPDATE 0":
                    logger.error(f"User {user_id} is not authorized to update study {study_id}")
                    return False

                logger.info(f"Successfully updated study {study_id} for user {user_id}")
            else:
                # Create new study
                insert_query = """
                    INSERT INTO study (study_id, user_id, name, description, baseline_characteristics,
                                     outcomes, analysis, visible_by, is_public, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                """

                await conn.execute(
                    insert_query,
                    study_id,
                    user_id,
                    name,
                    description,
                    json.dumps(baseline_characteristics) if baseline_characteristics else None,
                    json.dumps(outcomes) if outcomes else None,
                    json.dumps(analysis) if analysis else None,
                    visible_by or [],
                    is_public,
                )

                logger.info(f"Successfully created study {study_id} for user {user_id}")

            return True

        except Exception as e:
            logger.error(f"Failed to update study {study_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def update_study_display_order(
        self, user_id: str, study_id: str, display_order: int
    ) -> bool:
        """
        Update the display order of a study.

        Args:
            user_id (str): The user ID (UUID) who owns the study.
            study_id (str): The ID of the study to update.
            display_order (int): The new display order value.

        Returns:
            bool: True if successful, False if study not found or access denied.
        """
        conn = None
        try:
            conn = await self.get_connection()

            update_query = """
                UPDATE study 
                SET display_order = $3, updated_at = NOW()
                WHERE study_id = $1 AND user_id = $2
            """

            result = await conn.execute(update_query, study_id, user_id, display_order)

            if result == "UPDATE 0":
                logger.error(
                    f"User {user_id} is not authorized to update study {study_id} or study not found"
                )
                return False

            logger.info(
                f"Successfully updated display_order={display_order} for study {study_id}"
            )
            return True

        except Exception as e:
            logger.error(
                f"Failed to update display order for study {study_id}: {e}"
            )
            raise
        finally:
            if conn:
                await conn.close()

    async def delete_study_for_user(self, user_id: str, study_id: str) -> bool:
        """
        Delete a study and all associated cohorts for a user from the database.
        Uses cascading deletion to remove all cohorts associated with the study.

        Args:
            user_id (str): The user ID (UUID) who owns the study.
            study_id (str): The ID of the study to delete.

        Returns:
            bool: True if successful.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # Begin transaction for cascading deletion
            async with conn.transaction():
                # First, delete all cohorts associated with this study
                delete_cohorts_query = f"""
                    DELETE FROM {self.full_table_name} 
                    WHERE study_id = $1
                """
                cohorts_result = await conn.execute(delete_cohorts_query, study_id)

                # Then delete the study itself (only if user is the creator)
                delete_study_query = """
                    DELETE FROM study 
                    WHERE study_id = $1 AND user_id = $2
                """
                study_result = await conn.execute(delete_study_query, study_id, user_id)

                if study_result == "DELETE 0":
                    logger.error(f"User {user_id} is not authorized to delete study {study_id} or study not found")
                    return False

            logger.info(f"Successfully deleted study {study_id} and associated cohorts for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete study {study_id} for user {user_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def get_cohorts_for_study(self, study_id: str, user_id: str = None) -> List[Dict]:
        """
        Retrieve all cohorts associated with a specific study.

        Args:
            study_id (str): The ID of the study.
            user_id (str, optional): The user ID for access control.

        Returns:
            List[Dict]: A list of cohort objects associated with the study.
        """
        conn = None
        try:
            conn = await self.get_connection()

            # If user_id is provided, check if user has access to the study
            if user_id:
                access_query = """
                    SELECT study_id FROM study 
                    WHERE study_id = $1 AND (user_id = $2 OR $2 = ANY(visible_by) OR is_public = TRUE)
                """
                access_check = await conn.fetchrow(access_query, study_id, user_id)
                if not access_check:
                    return []  # No access to study

            # Get all cohorts for the study (latest versions only)
            query = f"""
                WITH latest_cohorts AS (
                    SELECT cohort_id, MAX(version) as max_version
                    FROM {self.full_table_name} 
                    WHERE study_id = $1
                    GROUP BY cohort_id
                ),
                prioritized_cohorts AS (
                    SELECT DISTINCT ON (c.cohort_id) 
                           c.cohort_id, c.cohort_data->>'name' as name, c.version, 
                           c.is_provisional, c.parent_cohort_id, c.created_at, c.updated_at, 
                           c.cohort_data, c.display_order
                    FROM {self.full_table_name} c
                    INNER JOIN latest_cohorts lc ON c.cohort_id = lc.cohort_id AND c.version = lc.max_version
                    WHERE c.study_id = $1
                    ORDER BY c.cohort_id, c.is_provisional DESC  -- Prioritize provisional versions
                )
                SELECT * FROM prioritized_cohorts
                ORDER BY display_order ASC, updated_at DESC
            """

            rows = await conn.fetch(query, study_id)

            import json
            cohorts = []
            for row in rows:
                cohorts.append({
                    "id": row["cohort_id"],
                    "name": row["name"] or f"Cohort {row['cohort_id']}",
                    "version": row["version"],
                    "is_provisional": row["is_provisional"],
                    "parent_cohort_id": row["parent_cohort_id"],
                    "display_order": row["display_order"],
                    "study_id": study_id,
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                    "cohort_data": json.loads(row["cohort_data"]) if row["cohort_data"] else None
                })

            logger.info(f"Retrieved {len(cohorts)} cohorts for study {study_id}")
            return cohorts

        except Exception as e:
            logger.error(f"Failed to retrieve cohorts for study {study_id}: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def health_check(self) -> Dict:
        """
        Perform a health check by testing database connectivity and basic query.
        
        Returns:
            Dict: Health status with connection details
            
        Raises:
            Exception: If database is not accessible or query fails
        """
        conn = None
        try:
            # Test basic connection
            conn = await self.get_connection()
            
            # Test a simple query to ensure database is responsive
            result = await conn.fetchrow("SELECT 1 as test_value, NOW() as current_time")
            
            # Check for all required tables
            required_tables = ['user', 'cohort', 'study']
            table_results = {}
            all_tables_exist = True
            
            for table_name in required_tables:
                # Determine the correct schema for each table
                if table_name in ['cohort']:
                    schema = self.cohorts_schema
                elif table_name in ['study']:
                    schema = self.studies_schema
                else:  # user table and others
                    schema = 'public'  # user table is typically in public schema
                
                table_exists = await conn.fetchrow(f"""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = '{schema}' 
                        AND table_name = '{table_name}'
                    ) as exists
                """)
                
                exists = table_exists["exists"]
                table_results[table_name] = {
                    "exists": exists,
                    "schema": schema,
                    "full_name": f"{schema}.{table_name}"
                }
                
                if not exists:
                    all_tables_exist = False
            
            return {
                "status": "connected",
                "test_query": result["test_value"] == 1,
                "database_time": result["current_time"].isoformat(),
                "all_tables_exist": all_tables_exist,
                "tables": table_results,
                "schemas": {
                    "cohorts": self.cohorts_schema,
                    "studies": self.studies_schema
                }
            }
            
        except Exception as e:
            error_msg = f"Database health check failed: {type(e).__name__}: {e}"
            logger.error(error_msg)
            logger.error(f"Connection string (without password): postgresql://{os.getenv('POSTGRES_USER')}:***@{os.getenv('POSTGRES_HOST')}:{os.getenv('POSTGRES_PORT')}/{os.getenv('POSTGRES_DB')}")
            return {
                "status": "failed",
                "error": str(e),
                "error_type": type(e).__name__,
                "schemas": {
                    "cohorts": self.cohorts_schema,
                    "studies": self.studies_schema
                },
                "message": "Database connection or query failed"
            }
        finally:
            if conn:
                await conn.close()


# Global instance
db_manager = DatabaseManager()
