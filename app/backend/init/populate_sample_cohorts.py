#!/usr/bin/env python3
"""
Database initialization script to populate sample public cohorts.
This script is designed to be run by the backend service on startup.
"""

import asyncio
import sys
import os
import random
import string
import logging

# Add parent directory to path to import DatabaseManager
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ..database import DatabaseManager

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SampleCohortsInitializer:
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.public_user_id = os.getenv(
            "PUBLIC_USER_ID", "c0799d5d-2bdf-4da4-8496-4f6d44b8fd26"
        )

    def generate_cohort_id(self) -> str:
        """Generate a random cohort ID similar to uXoMEOgXuC (10 characters)."""
        return "".join(random.choices(string.ascii_letters + string.digits, k=10))

    def generate_study_id(self) -> str:
        """Generate a random study ID similar to cohort IDs (10 characters)."""
        return "".join(random.choices(string.ascii_letters + string.digits, k=10))

    def get_sample_cohorts_and_studies(self):
        """Get sample cohort and study data."""
        study_id = self.generate_study_id()
        cohort_1_id = self.generate_cohort_id()
        cohort_2_id = self.generate_cohort_id()

        # Single multi-cohort demo study with two cohorts designed to run on DomainsMocker
        study = {
            "id": study_id,
            "name": "Cardiovascular Disease Demo Study",
            "description": (
                "A demonstration multi-cohort study comparing patients with atrial fibrillation "
                "to patients with acute myocardial infarction. Designed to run on the built-in database mocker."
            ),
            "baseline_characteristics": {},
            "outcomes": {},
            "database_config": {
                "mapper": "OMOP",
                "connector": "mocker",
                "config": {"n_patients": 25000},
            },
        }

        # OMOP concept IDs for AF (from DomainsMocker)
        af_concepts = [1569171, 4232691, 4154290, 4232697, 4119602]
        # OMOP concept IDs for MI (from DomainsMocker)
        mi_concepts = [312327, 4296653, 4270024, 314666, 4163874, 438170]

        # Cohort 1: Atrial Fibrillation
        # Entry: first AF diagnosis; Exclusion: prior MI; Outcome: all-cause mortality
        cohort_1 = {
            "id": cohort_1_id,
            "study_id": study_id,
            "name": "Atrial Fibrillation",
            "class_name": "Cohort",
            "description": "Adults with a first recorded atrial fibrillation diagnosis, excluding prior myocardial infarction.",
            "phenotypes": [
                {
                    "id": "entry_1",
                    "name": "Atrial Fibrillation Diagnosis",
                    "type": "entry",
                    "class_name": "CodelistPhenotype",
                    "domain": "CONDITION_OCCURRENCE",
                    "return_date": "first",
                    "codelist": {
                        "class_name": "Codelist",
                        "codelist_type": "manual",
                        "use_code_type": False,
                        "codelist": {"null": af_concepts},
                    },
                },
                {
                    "id": "inclusion_1",
                    "name": "Age 18 or older at index",
                    "type": "inclusion",
                    "class_name": "AgePhenotype",
                    "domain": "PERSON",
                    "value_filter": {
                        "class_name": "ValueFilter",
                        "column_name": "VALUE",
                        "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 18},
                    },
                },
                {
                    "id": "exclusion_1",
                    "name": "Exclude prior myocardial infarction",
                    "type": "exclusion",
                    "class_name": "CodelistPhenotype",
                    "domain": "CONDITION_OCCURRENCE",
                    "return_date": "first",
                    "codelist": {
                        "class_name": "Codelist",
                        "codelist_type": "manual",
                        "use_code_type": False,
                        "codelist": {"null": mi_concepts},
                    },
                    "relative_time_range": {
                        "class_name": "RelativeTimeRangeFilter",
                        "when": "before",
                        "min_days": {"class_name": "GreaterThanOrEqualTo", "value": 1},
                    },
                },
                {
                    "id": "baseline_1",
                    "name": "Age at Index",
                    "type": "baseline",
                    "class_name": "AgePhenotype",
                    "domain": "PERSON",
                },
                {
                    "id": "baseline_2",
                    "name": "Sex",
                    "type": "baseline",
                    "class_name": "CategoricalPhenotype",
                    "domain": "PERSON",
                    "categorical_filter": {
                        "class_name": "CategoricalFilter",
                        "column_name": "GENDER_SOURCE_VALUE",
                        "operator": "notnull",
                    },
                },
                {
                    "id": "outcome_1",
                    "name": "All-cause Mortality",
                    "type": "outcome",
                    "class_name": "DeathPhenotype",
                    "domain": "DEATH",
                    "relative_time_range": {
                        "class_name": "RelativeTimeRangeFilter",
                        "when": "after",
                        "min_days": {"class_name": "GreaterThanOrEqualTo", "value": 1},
                    },
                },
            ],
        }

        # Cohort 2: Acute Myocardial Infarction
        # Entry: first MI; Exclusion: prior AF; Outcome: all-cause mortality
        cohort_2 = {
            "id": cohort_2_id,
            "study_id": study_id,
            "name": "Acute Myocardial Infarction",
            "class_name": "Cohort",
            "description": "Adults with a first recorded myocardial infarction, excluding prior atrial fibrillation.",
            "phenotypes": [
                {
                    "id": "entry_1",
                    "name": "Myocardial Infarction Diagnosis",
                    "type": "entry",
                    "class_name": "CodelistPhenotype",
                    "domain": "CONDITION_OCCURRENCE",
                    "return_date": "first",
                    "codelist": {
                        "class_name": "Codelist",
                        "codelist_type": "manual",
                        "use_code_type": False,
                        "codelist": {"null": mi_concepts},
                    },
                },
                {
                    "id": "inclusion_1",
                    "name": "Age 18 or older at index",
                    "type": "inclusion",
                    "class_name": "AgePhenotype",
                    "domain": "PERSON",
                    "value_filter": {
                        "class_name": "ValueFilter",
                        "column_name": "VALUE",
                        "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 18},
                    },
                },
                {
                    "id": "exclusion_1",
                    "name": "Exclude prior atrial fibrillation",
                    "type": "exclusion",
                    "class_name": "CodelistPhenotype",
                    "domain": "CONDITION_OCCURRENCE",
                    "return_date": "first",
                    "codelist": {
                        "class_name": "Codelist",
                        "codelist_type": "manual",
                        "use_code_type": False,
                        "codelist": {"null": af_concepts},
                    },
                    "relative_time_range": {
                        "class_name": "RelativeTimeRangeFilter",
                        "when": "before",
                        "min_days": {"class_name": "GreaterThanOrEqualTo", "value": 1},
                    },
                },
                {
                    "id": "baseline_1",
                    "name": "Age at Index",
                    "type": "baseline",
                    "class_name": "AgePhenotype",
                    "domain": "PERSON",
                },
                {
                    "id": "baseline_2",
                    "name": "Sex",
                    "type": "baseline",
                    "class_name": "CategoricalPhenotype",
                    "domain": "PERSON",
                    "categorical_filter": {
                        "class_name": "CategoricalFilter",
                        "column_name": "GENDER_SOURCE_VALUE",
                        "operator": "notnull",
                    },
                },
                {
                    "id": "outcome_1",
                    "name": "All-cause Mortality",
                    "type": "outcome",
                    "class_name": "DeathPhenotype",
                    "domain": "DEATH",
                    "relative_time_range": {
                        "class_name": "RelativeTimeRangeFilter",
                        "when": "after",
                        "min_days": {"class_name": "GreaterThanOrEqualTo", "value": 1},
                    },
                },
            ],
        }

        return [
            {"study": study, "cohort": cohort_1},
            {"study": study, "cohort": cohort_2},
        ]

    async def wait_for_database(
        self, max_retries: int = 30, delay: float = 2.0
    ) -> bool:
        """Wait for database to be available by testing connection."""
        for attempt in range(max_retries):
            try:
                conn = await self.db_manager.get_connection()
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

    async def check_public_cohorts_exist(self) -> bool:
        """Check if public cohorts already exist using DatabaseManager."""
        try:
            public_cohorts = await self.db_manager.get_public_cohorts()

            exists = len(public_cohorts) > 0
            if exists:
                logger.info(f"✅ Found {len(public_cohorts)} existing public cohorts")
            else:
                logger.info("🔄 No public cohorts found")

            return exists

        except Exception as e:
            logger.error(f"❌ Error checking existing public cohorts: {e}")
            return False

    async def create_sample_study_and_cohort(self, data: dict) -> bool:
        """Create a single sample study and its associated cohort."""
        try:
            study_data = data["study"]
            cohort_data = data["cohort"]

            # First create the study
            study_success = await self.db_manager.update_study_for_user(
                user_id=self.public_user_id,
                study_id=study_data["id"],
                name=study_data["name"],
                description=study_data["description"],
                baseline_characteristics=study_data.get("baseline_characteristics"),
                outcomes=study_data.get("outcomes"),
                database_config=study_data.get("database_config"),
                visible_by=[],
                is_public=True,
            )

            if not study_success:
                logger.error(f"❌ Failed to create study {study_data['name']}")
                return False

            # Then create the cohort associated with the study
            cohort_success = await self.db_manager.update_cohort_for_user(
                user_id=self.public_user_id,
                cohort_id=cohort_data["id"],
                cohort_data=cohort_data,
                study_id=cohort_data["study_id"],
                provisional=False,
            )

            if cohort_success:
                # Mark the cohort as public by directly updating the database
                conn = await self.db_manager.get_connection()
                await conn.execute(
                    f"UPDATE {self.db_manager.full_table_name} SET is_public = TRUE WHERE user_id = $1 AND cohort_id = $2",
                    self.public_user_id,
                    cohort_data["id"],
                )
                await conn.close()

                logger.info(f"✅ Created sample cohort: {cohort_data['name']}")
                return True
            else:
                logger.error(f"❌ Failed to create cohort: {cohort_data['name']}")
                return False

        except Exception as e:
            logger.error(f"❌ Error creating sample cohort {cohort_data['name']}: {e}")
            return False

    async def create_sample_cohorts(self) -> bool:
        """Create all sample studies and cohorts."""
        sample_data = self.get_sample_cohorts_and_studies()
        success_count = 0
        created_study_ids = set()

        logger.info(f"🚀 Creating sample study with {len(sample_data)} cohorts...")

        for i, data in enumerate(sample_data, 1):
            study_data = data["study"]
            cohort_data = data["cohort"]
            cohort_name = cohort_data["name"]
            logger.info(f"📝 Creating cohort {i}/{len(sample_data)}: {cohort_name}")

            # Only create the study once (all cohorts share the same study)
            if study_data["id"] not in created_study_ids:
                if await self.create_sample_study_and_cohort(data):
                    created_study_ids.add(study_data["id"])
                    success_count += 1
            else:
                # Study already created; only create the cohort
                try:
                    cohort_success = await self.db_manager.update_cohort_for_user(
                        user_id=self.public_user_id,
                        cohort_id=cohort_data["id"],
                        cohort_data=cohort_data,
                        study_id=cohort_data["study_id"],
                        provisional=False,
                    )
                    if cohort_success:
                        conn = await self.db_manager.get_connection()
                        await conn.execute(
                            f"UPDATE {self.db_manager.full_table_name} SET is_public = TRUE WHERE user_id = $1 AND cohort_id = $2",
                            self.public_user_id,
                            cohort_data["id"],
                        )
                        await conn.close()
                        logger.info(f"✅ Created sample cohort: {cohort_name}")
                        success_count += 1
                    else:
                        logger.error(f"❌ Failed to create cohort: {cohort_name}")
                except Exception as e:
                    logger.error(f"❌ Error creating cohort {cohort_name}: {e}")

        logger.info(f"📊 Created {success_count}/{len(sample_data)} cohorts")
        return success_count == len(sample_data)

    async def verify_sample_cohorts(self) -> bool:
        """Verify that sample studies and cohorts were created correctly using DatabaseManager."""
        try:
            # Check public cohorts
            public_cohorts = await self.db_manager.get_public_cohorts()
            logger.info(f"📋 Found {len(public_cohorts)} public cohorts:")
            for cohort in public_cohorts:
                name = cohort.get("name", f"Cohort {cohort.get('id', 'Unknown')}")
                logger.info(f"  - {name} (ID: {cohort.get('id', 'Unknown')})")

            # Check public studies
            public_studies = await self.db_manager.get_all_studies_for_user(
                self.public_user_id
            )
            logger.info(f"📋 Found {len(public_studies)} public studies:")
            for study in public_studies:
                name = study.get("name", f"Study {study.get('id', 'Unknown')}")
                logger.info(f"  - {name} (ID: {study.get('id', 'Unknown')})")

            return (
                len(public_cohorts) >= 2 and len(public_studies) >= 1
            )  # Expect 1 study with 2 cohorts

        except Exception as e:
            logger.error(f"❌ Error verifying sample cohorts and studies: {e}")
            return False

    async def initialize(self) -> bool:
        """Main initialization process."""
        logger.info("🚀 Starting sample cohorts initialization...")

        # Wait for database to be available
        if not await self.wait_for_database():
            return False

        # Check if public cohorts already exist
        if await self.check_public_cohorts_exist():
            logger.info("✅ Public cohorts already exist, skipping creation")
            return True

        # Create sample cohorts
        if not await self.create_sample_cohorts():
            return False

        # Verify they were created
        if not await self.verify_sample_cohorts():
            return False

        logger.info("🎉 Sample cohorts initialization completed successfully!")
        return True


async def main():
    """Main function."""
    initializer = SampleCohortsInitializer()

    try:
        success = await initializer.initialize()
        if success:
            logger.info("🎉 Sample cohorts initialization completed successfully!")
            sys.exit(0)
        else:
            logger.error("❌ Sample cohorts initialization failed!")
            sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Unexpected error during initialization: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
