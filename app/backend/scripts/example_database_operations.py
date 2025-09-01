#!/usr/bin/env python3
"""
Test script for PhenEx cohorts database operations.
This script tests all the database operations to ensure they work correctly.
"""

import asyncio
import sys
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


# Helper function to generate random cohort IDs
def generate_cohort_id() -> str:
    """Generate a random cohort ID similar to uXoMEOgXuC (10 characters)."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=10))


# Test data
TEST_USER_ID = "00000000-0000-0000-0000-000000000000"
TEST_USER_ID_2 = "00000000-0000-0000-0000-000000000001"
TEST_COHORT_ID = generate_cohort_id()
TEST_COHORT_ID_2 = generate_cohort_id()

SAMPLE_COHORT_DATA = {
    "id": TEST_COHORT_ID,
    "name": "Test Atrial Fibrillation Cohort",
    "class_name": "Cohort",
    "description": "A test cohort for atrial fibrillation patients",
    "phenotypes": [
        {
            "id": "entry_criterion",
            "name": "Atrial Fibrillation Diagnosis",
            "type": "entry",
            "class_name": "CodelistPhenotype",
            "codelist": {"ICD10": ["I48", "I48.0", "I48.1", "I48.2"]},
        }
    ],
}

SAMPLE_COHORT_DATA_2 = {
    "id": TEST_COHORT_ID_2,
    "name": "Test Diabetes Cohort",
    "class_name": "Cohort",
    "description": "A test cohort for diabetes patients",
    "phenotypes": [
        {
            "id": "entry_criterion",
            "name": "Diabetes Diagnosis",
            "type": "entry",
            "class_name": "CodelistPhenotype",
            "codelist": {"ICD10": ["E10", "E11", "E12", "E13", "E14"]},
        }
    ],
}


class DatabaseTester:
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.test_results = []

    def log_test(self, test_name: str, success: bool, message: str = ""):
        """Log test results."""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append(
            {"test": test_name, "success": success, "message": message}
        )
        print(f"{status}: {test_name}")
        if message:
            print(f"    {message}")

    async def setup_database(self):
        """Set up the database by creating the table."""
        try:
            conn = await self.db_manager.get_connection()

            # Read and execute the SQL schema
            with open("create_cohorts_table.sql", "r") as f:
                schema_sql = f.read()

            await conn.execute(schema_sql)
            await conn.close()

            self.log_test("Database Setup", True, "Schema created successfully")
            return True
        except Exception as e:
            self.log_test("Database Setup", False, f"Error: {e}")
            return False

    async def cleanup_database(self):
        """Clean up test data."""
        try:
            conn = await self.db_manager.get_connection()

            # Delete test data
            await conn.execute(
                f"DELETE FROM {self.db_manager.full_table_name} WHERE user_id IN ($1, $2)",
                TEST_USER_ID,
                TEST_USER_ID_2,
            )

            await conn.close()
            self.log_test("Database Cleanup", True, "Test data cleaned up")
        except Exception as e:
            self.log_test("Database Cleanup", False, f"Error: {e}")

    async def test_create_cohort(self):
        """Test creating a new cohort."""
        try:
            print(f"📝 Creating cohort {TEST_COHORT_ID} for user {TEST_USER_ID}")
            success = await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                TEST_COHORT_ID,
                SAMPLE_COHORT_DATA,
                provisional=False,
                new_version=False,
            )
            print(f"✏️  Create operation result: {success}")

            if success:
                # Verify the cohort was created
                cohort = await self.db_manager.get_cohort_for_user(
                    TEST_USER_ID, TEST_COHORT_ID
                )
                print(
                    f"📋 Retrieved cohort: version={cohort.get('version') if cohort else 'None'}, provisional={cohort.get('is_provisional') if cohort else 'None'}"
                )

                if cohort and cohort.get("version") == 1:
                    self.log_test(
                        "Create Cohort", True, "Cohort created with version 1"
                    )
                else:
                    self.log_test(
                        "Create Cohort", False, "Cohort not found or wrong version"
                    )
            else:
                self.log_test("Create Cohort", False, "Create operation returned False")

        except Exception as e:
            self.log_test("Create Cohort", False, f"Error: {e}")

    async def test_update_cohort_versioning(self):
        """Test cohort versioning when updating with new_version=False and provisional=True."""
        try:
            print(
                f"📝 Updating cohort {TEST_COHORT_ID} with provisional=True, new_version=False"
            )
            # Update the cohort with new_version=False and provisional=True
            # This should create a provisional version at the same version number (1)
            updated_data = SAMPLE_COHORT_DATA.copy()
            updated_data["description"] = "Updated description for provisional version"

            success = await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                TEST_COHORT_ID,
                updated_data,
                provisional=True,
                new_version=False,
            )
            print(f"✏️  Update operation result: {success}")

            if success:
                # Verify provisional version was created at same version number
                cohort = await self.db_manager.get_cohort_for_user(
                    TEST_USER_ID, TEST_COHORT_ID
                )
                print(
                    f"📋 Retrieved cohort after update: version={cohort.get('version') if cohort else 'None'}, provisional={cohort.get('is_provisional') if cohort else 'None'}"
                )

                if cohort:
                    cohort_data = cohort.get("cohort_data", {})
                    if isinstance(cohort_data, str):
                        import json

                        cohort_data = json.loads(cohort_data)
                    print(f"📄 Cohort description: {cohort_data.get('description')}")

                if (
                    cohort
                    and cohort.get("version") == 1
                    and cohort.get("is_provisional")
                ):
                    self.log_test(
                        "Update Cohort Versioning",
                        True,
                        "Provisional version created at same version number (1)",
                    )
                else:
                    self.log_test(
                        "Update Cohort Versioning",
                        False,
                        f"Expected version 1 provisional, got version {cohort.get('version')}, provisional: {cohort.get('is_provisional')}",
                    )
            else:
                self.log_test(
                    "Update Cohort Versioning", False, "Update operation returned False"
                )

        except Exception as e:
            self.log_test("Update Cohort Versioning", False, f"Error: {e}")

    async def test_get_all_cohorts(self):
        """Test getting all cohorts for a user."""
        try:
            # Create a second cohort
            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                TEST_COHORT_ID_2,
                SAMPLE_COHORT_DATA_2,
                provisional=False,
                new_version=False,
            )

            cohorts = await self.db_manager.get_all_cohorts_for_user(TEST_USER_ID)

            if len(cohorts) == 2:
                # Check that we get the latest versions
                cohort_ids = {str(c["id"]) for c in cohorts}
                if TEST_COHORT_ID in cohort_ids and TEST_COHORT_ID_2 in cohort_ids:
                    self.log_test(
                        "Get All Cohorts", True, f"Retrieved {len(cohorts)} cohorts"
                    )
                else:
                    self.log_test(
                        "Get All Cohorts",
                        False,
                        f"Missing expected cohort IDs, found {cohort_ids}, expected {TEST_COHORT_ID}, {TEST_COHORT_ID_2}",
                    )
            else:
                self.log_test(
                    "Get All Cohorts", False, f"Expected 2 cohorts, got {len(cohorts)}"
                )

        except Exception as e:
            self.log_test("Get All Cohorts", False, f"Error: {e}")

    async def test_accept_changes(self):
        """Test accepting provisional changes."""
        try:
            print(f"📝 Accepting provisional changes for cohort {TEST_COHORT_ID}")
            print("📋 Before accept - checking current state:")
            cohort_before = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, TEST_COHORT_ID
            )
            print(
                f"   Current: version={cohort_before.get('version')}, provisional={cohort_before.get('is_provisional')}"
            )

            # Accept the provisional version 1
            success = await self.db_manager.accept_changes(TEST_USER_ID, TEST_COHORT_ID)
            print(f"✏️  Accept operation result: {success}")

            if success:
                # Verify the version is no longer provisional
                cohort = await self.db_manager.get_cohort_for_user(
                    TEST_USER_ID, TEST_COHORT_ID
                )
                print(
                    f"📋 After accept: version={cohort.get('version') if cohort else 'None'}, provisional={cohort.get('is_provisional') if cohort else 'None'}"
                )

                if (
                    cohort
                    and cohort.get("version") == 1
                    and not cohort.get("is_provisional")
                ):
                    self.log_test(
                        "Accept Changes", True, "Version 1 is now non-provisional"
                    )
                else:
                    self.log_test(
                        "Accept Changes",
                        False,
                        f"Expected version 1 non-provisional, got version {cohort.get('version')}, provisional: {cohort.get('is_provisional')}",
                    )
            else:
                self.log_test(
                    "Accept Changes", False, "Accept operation returned False"
                )

        except Exception as e:
            self.log_test("Accept Changes", False, f"Error: {e}")

    async def test_reject_changes(self):
        """Test rejecting provisional changes."""
        try:
            print(
                f"📝 Creating another provisional version for cohort {TEST_COHORT_ID}"
            )
            # Create another provisional version at the same version number (1)
            updated_data = SAMPLE_COHORT_DATA.copy()
            updated_data["description"] = "This provisional version should be rejected"

            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                TEST_COHORT_ID,
                updated_data,
                provisional=True,
                new_version=False,
            )

            # Verify provisional version was created
            cohort = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, TEST_COHORT_ID
            )
            print(
                f"📋 After creating provisional: version={cohort.get('version')}, provisional={cohort.get('is_provisional')}"
            )

            if not cohort.get("is_provisional"):
                self.log_test(
                    "Reject Changes",
                    False,
                    f"Expected provisional version, got provisional: {cohort.get('is_provisional')}",
                )
                return

            print(f"📝 Rejecting provisional changes for cohort {TEST_COHORT_ID}")
            # Reject the changes
            success = await self.db_manager.reject_changes(TEST_USER_ID, TEST_COHORT_ID)
            print(f"✏️  Reject operation result: {success}")

            if success:
                # Verify we're back to version 1 (non-provisional)
                cohort = await self.db_manager.get_cohort_for_user(
                    TEST_USER_ID, TEST_COHORT_ID
                )
                print(
                    f"📋 After reject: version={cohort.get('version') if cohort else 'None'}, provisional={cohort.get('is_provisional') if cohort else 'None'}"
                )

                if (
                    cohort
                    and cohort.get("version") == 1
                    and not cohort.get("is_provisional")
                ):
                    self.log_test(
                        "Reject Changes",
                        True,
                        "Provisional version rejected, back to version 1",
                    )
                else:
                    self.log_test(
                        "Reject Changes",
                        False,
                        f"Expected version 1 non-provisional, got version {cohort.get('version')}, provisional: {cohort.get('is_provisional')}",
                    )
            else:
                self.log_test(
                    "Reject Changes", False, "Reject operation returned False"
                )

        except Exception as e:
            self.log_test("Reject Changes", False, f"Error: {e}")

    async def test_public_cohorts(self):
        """Test public cohorts functionality."""
        try:
            # First, verify no public cohorts exist
            public_cohorts = await self.db_manager.get_public_cohorts()
            initial_count = len(public_cohorts)

            # Make one cohort public by directly updating the database
            conn = await self.db_manager.get_connection()
            await conn.execute(
                f"UPDATE {self.db_manager.full_table_name} SET is_public = TRUE WHERE user_id = $1 AND cohort_id = $2 AND version = 1",
                TEST_USER_ID,
                TEST_COHORT_ID,
            )
            await conn.close()

            # Get public cohorts
            public_cohorts = await self.db_manager.get_public_cohorts()

            if len(public_cohorts) == initial_count + 1:
                # Check that our cohort is in the list
                public_cohort_ids = {str(c["id"]) for c in public_cohorts}
                if TEST_COHORT_ID in public_cohort_ids:
                    self.log_test(
                        "Public Cohorts", True, f"Public cohort found in list"
                    )
                else:
                    self.log_test(
                        "Public Cohorts", False, "Public cohort not found in list"
                    )
            else:
                self.log_test(
                    "Public Cohorts",
                    False,
                    f"Expected {initial_count + 1} public cohorts, got {len(public_cohorts)}",
                )

        except Exception as e:
            self.log_test("Public Cohorts", False, f"Error: {e}")

    async def test_delete_cohort(self):
        """Test deleting a cohort."""
        try:
            success = await self.db_manager.delete_cohort_for_user(
                TEST_USER_ID, TEST_COHORT_ID_2
            )

            if success:
                # Verify the cohort was deleted
                cohort = await self.db_manager.get_cohort_for_user(
                    TEST_USER_ID, TEST_COHORT_ID_2
                )
                if cohort is None:
                    self.log_test("Delete Cohort", True, "Cohort deleted successfully")
                else:
                    self.log_test(
                        "Delete Cohort", False, "Cohort still exists after deletion"
                    )
            else:
                self.log_test("Delete Cohort", False, "Delete operation returned False")

        except Exception as e:
            self.log_test("Delete Cohort", False, f"Error: {e}")

    async def test_user_isolation(self):
        """Test that users can only see their own cohorts."""
        try:
            # Create a cohort for a different user
            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID_2,
                TEST_COHORT_ID,
                SAMPLE_COHORT_DATA,
                provisional=False,
                new_version=False,
            )

            # Try to get the cohort as the first user
            cohort = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, TEST_COHORT_ID
            )
            cohorts_list = await self.db_manager.get_all_cohorts_for_user(TEST_USER_ID)

            # The first user should still only see their own cohorts
            if len(cohorts_list) == 1:  # Only their own cohort
                self.log_test(
                    "User Isolation", True, "Users can only see their own cohorts"
                )
            else:
                self.log_test(
                    "User Isolation",
                    False,
                    f"User can see {len(cohorts_list)} cohorts, expected 1",
                )

        except Exception as e:
            self.log_test("User Isolation", False, f"Error: {e}")

    async def test_new_version_parameter(self):
        """Test the new_version parameter behavior."""
        try:
            # Create a new cohort for this test
            test_cohort_id = generate_cohort_id()
            print(f"📝 Testing new_version parameter with cohort {test_cohort_id}")

            # Create initial version
            print("📝 Creating initial version with new_version=False")
            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                test_cohort_id,
                SAMPLE_COHORT_DATA,
                provisional=False,
                new_version=False,
            )

            cohort_v1 = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, test_cohort_id
            )
            print(
                f"📋 Initial version: version={cohort_v1.get('version')}, provisional={cohort_v1.get('is_provisional')}"
            )

            # Update with new_version=True (should create version 2)
            updated_data = SAMPLE_COHORT_DATA.copy()
            updated_data["description"] = "Version 2 with new_version=True"

            print("📝 Updating with new_version=True (should create version 2)")
            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                test_cohort_id,
                updated_data,
                provisional=False,
                new_version=True,
            )

            # Verify version 2 was created
            cohort = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, test_cohort_id
            )
            print(
                f"📋 After new_version=True: version={cohort.get('version')}, provisional={cohort.get('is_provisional')}"
            )

            if cohort and cohort.get("version") == 2:
                self.log_test(
                    "New Version Parameter", True, "new_version=True creates version 2"
                )
            else:
                self.log_test(
                    "New Version Parameter",
                    False,
                    f"Expected version 2, got {cohort.get('version')}",
                )

            # Clean up
            await self.db_manager.delete_cohort_for_user(TEST_USER_ID, test_cohort_id)

        except Exception as e:
            self.log_test("New Version Parameter", False, f"Error: {e}")

    async def test_replace_existing_version(self):
        """Test replacing existing version with new_version=False."""
        try:
            # Create a new cohort for this test
            test_cohort_id = generate_cohort_id()

            # Create initial version
            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                test_cohort_id,
                SAMPLE_COHORT_DATA,
                provisional=False,
                new_version=False,
            )

            # Update with new_version=False and provisional=False (should replace version 1)
            updated_data = SAMPLE_COHORT_DATA.copy()
            updated_data["description"] = "Replaced version 1"

            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                test_cohort_id,
                updated_data,
                provisional=False,
                new_version=False,
            )

            # Verify still version 1 but with updated data
            cohort = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, test_cohort_id
            )

            # Check if cohort_data is dict or string and handle accordingly
            cohort_data = cohort.get("cohort_data", {})
            if isinstance(cohort_data, str):
                import json

                cohort_data = json.loads(cohort_data)

            if (
                cohort
                and cohort.get("version") == 1
                and cohort_data.get("description") == "Replaced version 1"
            ):
                self.log_test(
                    "Replace Existing Version", True, "Version 1 replaced successfully"
                )
            else:
                self.log_test(
                    "Replace Existing Version",
                    False,
                    f"Expected version 1 with updated description, got version {cohort.get('version')}",
                )

            # Clean up
            await self.db_manager.delete_cohort_for_user(TEST_USER_ID, test_cohort_id)

        except Exception as e:
            self.log_test("Replace Existing Version", False, f"Error: {e}")

    async def test_get_cohort_priority_logic(self):
        """Test that get_cohort returns provisional version when it exists at highest version."""
        try:
            # Create a new cohort for this test
            test_cohort_id = generate_cohort_id()
            print(f"📝 Testing get_cohort priority logic with cohort {test_cohort_id}")

            # Create initial version
            print("📝 Creating initial non-provisional version")
            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                test_cohort_id,
                SAMPLE_COHORT_DATA,
                provisional=False,
                new_version=False,
            )

            cohort_initial = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, test_cohort_id
            )
            print(
                f"📋 Initial state: version={cohort_initial.get('version')}, provisional={cohort_initial.get('is_provisional')}"
            )

            # Create a provisional version at the same version number
            provisional_data = SAMPLE_COHORT_DATA.copy()
            provisional_data["description"] = "Provisional version"

            print("📝 Creating provisional version at same version number")
            await self.db_manager.update_cohort_for_user(
                TEST_USER_ID,
                test_cohort_id,
                provisional_data,
                provisional=True,
                new_version=False,
            )

            # get_cohort should return the provisional version
            cohort = await self.db_manager.get_cohort_for_user(
                TEST_USER_ID, test_cohort_id
            )
            print(
                f"📋 After creating provisional: version={cohort.get('version')}, provisional={cohort.get('is_provisional')}"
            )

            # Check if cohort_data is dict or string and handle accordingly
            cohort_data = cohort.get("cohort_data", {})
            if isinstance(cohort_data, str):
                import json

                cohort_data = json.loads(cohort_data)

            print(f"📄 Returned description: '{cohort_data.get('description')}'")

            if (
                cohort
                and cohort.get("is_provisional")
                and cohort_data.get("description") == "Provisional version"
            ):
                self.log_test(
                    "Get Cohort Priority Logic",
                    True,
                    "Provisional version returned correctly",
                )
            else:
                self.log_test(
                    "Get Cohort Priority Logic",
                    False,
                    f"Expected provisional version with 'Provisional version' description, got provisional: {cohort.get('is_provisional')}, description: '{cohort_data.get('description')}'",
                )

            # Clean up
            await self.db_manager.delete_cohort_for_user(TEST_USER_ID, test_cohort_id)

        except Exception as e:
            self.log_test("Get Cohort Priority Logic", False, f"Error: {e}")

    async def run_all_tests(self):
        """Run all tests."""
        print("🧪 Starting PhenEx Database Operations Tests")
        print("=" * 50)

        # Setup
        # if not await self.setup_database():
        #     print("❌ Cannot continue - database setup failed")
        #     return

        try:
            # Run tests in order
            await self.test_create_cohort()
            await self.test_update_cohort_versioning()
            await self.test_get_all_cohorts()
            await self.test_accept_changes()
            await self.test_reject_changes()
            await self.test_public_cohorts()
            await self.test_delete_cohort()
            await self.test_user_isolation()
            await self.test_new_version_parameter()
            await self.test_replace_existing_version()
            await self.test_get_cohort_priority_logic()

        finally:
            # Cleanup
            await self.cleanup_database()

        # Print summary
        print("\n" + "=" * 50)
        print("📊 Test Results Summary")
        print("=" * 50)

        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)

        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")

        print(f"\n🎯 {passed}/{total} tests passed")

        if passed == total:
            print("🎉 All tests passed! Database operations are working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Please check the database configuration.")
            return False


async def main():
    """Main function to run tests."""
    try:
        tester = DatabaseTester()
        success = await tester.run_all_tests()

        # Exit with appropriate code
        sys.exit(0 if success else 1)

    except Exception as e:
        print(f"❌ Test runner failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
