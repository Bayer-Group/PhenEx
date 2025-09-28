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
        sample_data = []
        
        # Atrial Fibrillation Study and Cohort
        cohort_1_id = self.generate_cohort_id()
        study_1_id = self.generate_study_id()
        sample_data.append({
            "study": {
                "id": study_1_id,
                "name": "Atrial Fibrillation Study",
                "description": "Comprehensive study of patients diagnosed with atrial fibrillation",
                "baseline_characteristics": {
                    "age_range": "18+",
                    "demographics": "Adult population"
                },
                "outcomes": {
                    "primary": "Cardiovascular events",
                    "secondary": "Medication adherence"
                },
                "analysis": {
                    "type": "observational",
                    "follow_up": "2 years"
                }
            },
            "cohort": {
                "id": cohort_1_id,
                "study_id": study_1_id,
                "name": "Atrial Fibrillation Cohort",
                "class_name": "Cohort",
                "description": "Patients diagnosed with atrial fibrillation",
                "phenotypes": [
                    {
                        "id": "entry_criterion",
                        "name": "Atrial Fibrillation Diagnosis",
                        "type": "entry",
                        "class_name": "CodelistPhenotype",
                        "codelist": {
                            "ICD10": [
                                "I48", "I48.0", "I48.1", "I48.2", "I48.3", "I48.4", "I48.9"
                            ]
                        },
                    },
                    {
                        "id": "inclusion_1",
                        "name": "Age 18 or older",
                        "type": "inclusion",
                        "class_name": "AgePhenotype",
                        "min_age": 18,
                    },
                ],
            }
        })

        # Type 2 Diabetes Study and Cohort
        cohort_2_id = self.generate_cohort_id()
        study_2_id = self.generate_study_id()
        sample_data.append({
            "study": {
                "id": study_2_id,
                "name": "Type 2 Diabetes Study",
                "description": "Longitudinal study of adult patients with Type 2 diabetes mellitus",
                "baseline_characteristics": {
                    "age_range": "18+",
                    "exclusions": "Type 1 diabetes"
                },
                "outcomes": {
                    "primary": "Glycemic control",
                    "secondary": "Complications"
                },
                "analysis": {
                    "type": "cohort",
                    "follow_up": "5 years"
                }
            },
            "cohort": {
                "id": cohort_2_id,
                "study_id": study_2_id,
                "name": "Type 2 Diabetes Cohort",
                "class_name": "Cohort",
                "description": "Adult patients with Type 2 diabetes mellitus",
                "phenotypes": [
                    {
                        "id": "entry_criterion",
                        "name": "Type 2 Diabetes Diagnosis",
                        "type": "entry",
                        "class_name": "CodelistPhenotype",
                        "codelist": {
                            "ICD10": [
                                "E11", "E11.0", "E11.1", "E11.2", "E11.3", "E11.4",
                                "E11.5", "E11.6", "E11.7", "E11.8", "E11.9"
                            ]
                        },
                    },
                    {
                        "id": "inclusion_1",
                        "name": "Adult patients",
                        "type": "inclusion",
                        "class_name": "AgePhenotype",
                        "min_age": 18,
                    },
                    {
                        "id": "exclusion_1",
                        "name": "Exclude Type 1 Diabetes",
                        "type": "exclusion",
                        "class_name": "CodelistPhenotype",
                        "codelist": {
                            "ICD10": [
                                "E10", "E10.0", "E10.1", "E10.2", "E10.3", "E10.4",
                                "E10.5", "E10.6", "E10.7", "E10.8", "E10.9"
                            ]
                        },
                    },
                ],
            }
        })

        # Hypertension Study and Cohort
        cohort_3_id = self.generate_cohort_id()
        study_3_id = self.generate_study_id()
        sample_data.append({
            "study": {
                "id": study_3_id,
                "name": "Hypertension Study",
                "description": "Study of patients with essential hypertension",
                "baseline_characteristics": {
                    "age_range": "21+",
                    "condition": "Essential hypertension"
                },
                "outcomes": {
                    "primary": "Blood pressure control",
                    "secondary": "Cardiovascular events"
                },
                "analysis": {
                    "type": "observational",
                    "follow_up": "3 years"
                }
            },
            "cohort": {
                "id": cohort_3_id,
                "study_id": study_3_id,
                "name": "Hypertension Cohort",
                "class_name": "Cohort",
                "description": "Patients with essential hypertension",
                "phenotypes": [
                    {
                        "id": "entry_criterion",
                        "name": "Essential Hypertension",
                        "type": "entry",
                        "class_name": "CodelistPhenotype",
                        "codelist": {"ICD10": ["I10", "I11", "I12", "I13", "I15"]},
                    },
                    {
                        "id": "inclusion_1",
                        "name": "Adults only",
                        "type": "inclusion",
                        "class_name": "AgePhenotype",
                        "min_age": 21,
                    },
                ],
            }
        })

        # Acute Myocardial Infarction Study and Cohort
        cohort_4_id = self.generate_cohort_id()
        study_4_id = self.generate_study_id()
        sample_data.append({
            "study": {
                "id": study_4_id,
                "name": "Acute Myocardial Infarction Study",
                "description": "Study of patients with acute myocardial infarction (heart attack)",
                "baseline_characteristics": {
                    "age_range": "18+",
                    "exclusions": "Previous MI"
                },
                "outcomes": {
                    "primary": "30-day mortality",
                    "secondary": "Readmission rates"
                },
                "analysis": {
                    "type": "case-control",
                    "follow_up": "1 year"
                }
            },
            "cohort": {
                "id": cohort_4_id,
                "study_id": study_4_id,
                "name": "Acute Myocardial Infarction Cohort",
                "class_name": "Cohort",
                "description": "Patients with acute myocardial infarction (heart attack)",
                "phenotypes": [
                    {
                        "id": "entry_criterion",
                        "name": "Acute Myocardial Infarction",
                        "type": "entry",
                        "class_name": "CodelistPhenotype",
                        "codelist": {
                            "ICD10": [
                                "I21", "I21.0", "I21.1", "I21.2", "I21.3", "I21.4", "I21.9"
                            ]
                        },
                    },
                    {
                        "id": "inclusion_1",
                        "name": "Adult patients",
                        "type": "inclusion",
                        "class_name": "AgePhenotype",
                        "min_age": 18,
                    },
                    {
                        "id": "exclusion_1",
                        "name": "Exclude previous MI",
                        "type": "exclusion",
                        "class_name": "CodelistPhenotype",
                        "codelist": {"ICD10": ["I25.2"]},
                    },
                ],
            }
        })

        # Chronic Kidney Disease Study and Cohort
        cohort_5_id = self.generate_cohort_id()
        study_5_id = self.generate_study_id()
        sample_data.append({
            "study": {
                "id": study_5_id,
                "name": "Chronic Kidney Disease Study",
                "description": "Study of patients with chronic kidney disease stages 3-5",
                "baseline_characteristics": {
                    "age_range": "18+",
                    "ckd_stages": "3-5"
                },
                "outcomes": {
                    "primary": "Progression to ESRD",
                    "secondary": "Cardiovascular outcomes"
                },
                "analysis": {
                    "type": "prospective cohort",
                    "follow_up": "10 years"
                }
            },
            "cohort": {
                "id": cohort_5_id,
                "study_id": study_5_id,
                "name": "Chronic Kidney Disease Cohort",
                "class_name": "Cohort",
                "description": "Patients with chronic kidney disease stages 3-5",
                "phenotypes": [
                    {
                        "id": "entry_criterion",
                        "name": "Chronic Kidney Disease",
                        "type": "entry",
                        "class_name": "CodelistPhenotype",
                        "codelist": {
                            "ICD10": ["N18", "N18.3", "N18.4", "N18.5", "N18.6"]
                        },
                    },
                    {
                        "id": "inclusion_1",
                        "name": "Adult patients",
                        "type": "inclusion",
                        "class_name": "AgePhenotype",
                        "min_age": 18,
                    },
                    {
                        "id": "exclusion_1",
                        "name": "Exclude acute kidney failure",
                        "type": "exclusion",
                        "class_name": "CodelistPhenotype",
                        "codelist": {
                            "ICD10": [
                                "N17", "N17.0", "N17.1", "N17.2", "N17.8", "N17.9"
                            ]
                        },
                    },
                ],
            }
        })
        
        return sample_data

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
                analysis=study_data.get("analysis"),
                visible_by=[],
                is_public=True
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
                provisional=False
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

        logger.info(f"🚀 Creating {len(sample_data)} sample studies and cohorts...")

        for i, data in enumerate(sample_data, 1):
            study_name = data['study']['name']
            cohort_name = data['cohort']['name']
            logger.info(
                f"📝 Creating study and cohort {i}/{len(sample_data)}: {study_name} / {cohort_name}"
            )

            if await self.create_sample_study_and_cohort(data):
                success_count += 1

        logger.info(f"📊 Created {success_count}/{len(sample_data)} sample studies and cohorts")
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
            public_studies = await self.db_manager.get_all_studies_for_user(self.public_user_id)
            logger.info(f"📋 Found {len(public_studies)} public studies:")
            for study in public_studies:
                name = study.get("name", f"Study {study.get('id', 'Unknown')}")
                logger.info(f"  - {name} (ID: {study.get('id', 'Unknown')})")

            return len(public_cohorts) >= 5 and len(public_studies) >= 5  # Expect at least 5 of each

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
