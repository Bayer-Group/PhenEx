#!/usr/bin/env python3
"""
Script to populate the cohorts table with sample public cohorts.
This script creates 5 sample cohorts with a PUBLIC_USER_ID and marks them as public.
"""

import asyncio
import sys
import os
import random
import string
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the database manager
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import DatabaseManager

# Public user ID for sample cohorts
PUBLIC_USER_ID = os.getenv("PUBLIC_USER_ID", "00000000-0000-0000-0000-000000000000")


# Helper function to generate random cohort IDs
def generate_cohort_id() -> str:
    """Generate a random cohort ID similar to uXoMEOgXuC (10 characters)."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=10))


# Sample cohort data
SAMPLE_COHORTS = [
    {
        "id": generate_cohort_id(),
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
                        "I48",
                        "I48.0",
                        "I48.1",
                        "I48.2",
                        "I48.3",
                        "I48.4",
                        "I48.9",
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
    },
    {
        "id": generate_cohort_id(),
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
                        "E11",
                        "E11.0",
                        "E11.1",
                        "E11.2",
                        "E11.3",
                        "E11.4",
                        "E11.5",
                        "E11.6",
                        "E11.7",
                        "E11.8",
                        "E11.9",
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
                        "E10",
                        "E10.0",
                        "E10.1",
                        "E10.2",
                        "E10.3",
                        "E10.4",
                        "E10.5",
                        "E10.6",
                        "E10.7",
                        "E10.8",
                        "E10.9",
                    ]
                },
            },
        ],
    },
    {
        "id": generate_cohort_id(),
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
    },
    {
        "id": generate_cohort_id(),
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
                        "I21",
                        "I21.0",
                        "I21.1",
                        "I21.2",
                        "I21.3",
                        "I21.4",
                        "I21.9",
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
    },
    {
        "id": generate_cohort_id(),
        "name": "Chronic Kidney Disease Cohort",
        "class_name": "Cohort",
        "description": "Patients with chronic kidney disease stages 3-5",
        "phenotypes": [
            {
                "id": "entry_criterion",
                "name": "Chronic Kidney Disease",
                "type": "entry",
                "class_name": "CodelistPhenotype",
                "codelist": {"ICD10": ["N18", "N18.3", "N18.4", "N18.5", "N18.6"]},
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
                    "ICD10": ["N17", "N17.0", "N17.1", "N17.2", "N17.8", "N17.9"]
                },
            },
        ],
    },
]


class CohortPopulator:
    def __init__(self):
        self.db_manager = DatabaseManager()

    async def populate_cohorts(self):
        """Populate the database with sample cohorts."""
        print("🚀 Starting to populate sample cohorts...")
        print("=" * 50)

        success_count = 0

        for i, cohort_data in enumerate(SAMPLE_COHORTS, 1):
            try:
                print(f"📝 Creating cohort {i}/5: {cohort_data['name']}")

                # Create the cohort
                success = await self.db_manager.update_cohort_for_user(
                    PUBLIC_USER_ID, cohort_data["id"], cohort_data, provisional=False
                )

                if success:
                    # Mark the cohort as public by directly updating the database
                    conn = await self.db_manager.get_connection()
                    await conn.execute(
                        f"UPDATE {self.db_manager.full_table_name} SET is_public = TRUE WHERE user_id = $1 AND cohort_id = $2",
                        PUBLIC_USER_ID,
                        cohort_data["id"],
                    )
                    await conn.close()

                    print(
                        f"✅ Successfully created and marked as public: {cohort_data['name']}"
                    )
                    success_count += 1
                else:
                    print(f"❌ Failed to create cohort: {cohort_data['name']}")

            except Exception as e:
                print(f"❌ Error creating cohort {cohort_data['name']}: {e}")

        print("\n" + "=" * 50)
        print(
            f"📊 Population Results: {success_count}/{len(SAMPLE_COHORTS)} cohorts created successfully"
        )

        if success_count == len(SAMPLE_COHORTS):
            print("🎉 All sample cohorts populated successfully!")
        else:
            print(f"⚠️  {len(SAMPLE_COHORTS) - success_count} cohorts failed to create")

        return success_count == len(SAMPLE_COHORTS)

    async def verify_public_cohorts(self):
        """Verify that the public cohorts were created correctly."""
        print("\n🔍 Verifying public cohorts...")

        try:
            public_cohorts = await self.db_manager.get_public_cohorts()

            print(f"📋 Found {len(public_cohorts)} public cohorts:")
            for cohort in public_cohorts:
                print(
                    f"  - {cohort.get('name', 'Unnamed')} (ID: {cohort.get('id', 'Unknown')})"
                )

            return len(public_cohorts) >= len(SAMPLE_COHORTS)

        except Exception as e:
            print(f"❌ Error verifying public cohorts: {e}")
            return False

    async def cleanup_sample_cohorts(self):
        """Clean up sample cohorts (for testing purposes)."""
        print("\n🧹 Cleaning up sample cohorts...")

        try:
            conn = await self.db_manager.get_connection()

            # Delete all cohorts for the public user
            result = await conn.execute(
                f"DELETE FROM {self.db_manager.full_table_name} WHERE user_id = $1",
                PUBLIC_USER_ID,
            )

            await conn.close()
            print(f"✅ Cleaned up sample cohorts for public user")

        except Exception as e:
            print(f"❌ Error cleaning up sample cohorts: {e}")


async def main():
    """Main function to populate sample cohorts."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Populate sample cohorts in the database"
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="Clean up sample cohorts instead of creating them",
    )
    parser.add_argument(
        "--verify", action="store_true", help="Verify existing public cohorts"
    )

    args = parser.parse_args()

    try:
        populator = CohortPopulator()

        if args.cleanup:
            await populator.cleanup_sample_cohorts()
        elif args.verify:
            await populator.verify_public_cohorts()
        else:
            success = await populator.populate_cohorts()
            await populator.verify_public_cohorts()

            if success:
                print("\n🎯 Sample cohorts population completed successfully!")
                sys.exit(0)
            else:
                print("\n❌ Sample cohorts population failed!")
                sys.exit(1)

    except Exception as e:
        print(f"❌ Script failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
