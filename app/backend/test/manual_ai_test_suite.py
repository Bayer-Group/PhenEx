#!/usr/bin/env python3
"""
MANUAL AI AGENT TEST SUITE
==========================

This test suite provides detailed logging for manual verification of AI agent behavior.
For each test scenario, it shows:
1. Initial cohort state (with phenotypes)
2. User prompt/request
3. AI actions taken (tools called, parameters)
4. Final cohort state (changes made)
5. Success/failure analysis

Start with 3 scenarios to manually verify before automation.
"""
import asyncio
import sys
import os
import json
import importlib.util
from pathlib import Path
import types
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Dict, Any, List
from copy import deepcopy

# Load environment variables first
load_dotenv(Path.cwd() / ".env")

# Setup paths - use __file__ to find script location, then go to project root
script_dir = Path(__file__).parent  # test directory
backend_path = script_dir.parent  # backend directory
app_path = backend_path.parent  # app directory
project_root = app_path.parent  # PhenEx root

# Add both paths to sys.path for imports
sys.path.insert(0, str(backend_path))  # For backend imports
sys.path.insert(0, str(project_root))  # For phenex imports

# Add PhenEx imports for validation
try:
    # Import PhenEx classes for validation
    from phenex.phenotypes.phenotype import Phenotype
    from phenex.phenotypes.age_phenotype import AgePhenotype
    from phenex.phenotypes.measurement_phenotype import MeasurementPhenotype
    from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
    from phenex.phenotypes.event_count_phenotype import EventCountPhenotype
    from phenex.phenotypes.death_phenotype import DeathPhenotype
    from phenex.phenotypes.time_range_phenotype import TimeRangePhenotype
    from phenex.phenotypes.sex_phenotype import SexPhenotype
    from phenex.phenotypes.cohort import Cohort
    from phenex.util.serialization.from_dict import from_dict

    PHENEX_AVAILABLE = True
    print(f"✅ PhenEx classes imported for validation")
except ImportError as e:
    print(f"⚠️  PhenEx classes not available for validation: {e}")
    import traceback

    traceback.print_exc()
    PHENEX_AVAILABLE = False


# Enhanced Mock DB that tracks all operations
class MockDB:
    def __init__(self):
        self.cohorts = {}
        self.operations = []

    async def update_cohort_for_user(
        self,
        user_id,
        cohort_id,
        cohort_data,
        study_id,
        provisional=True,
        new_version=False,
    ):
        """Mock cohort saving with operation tracking."""
        operation = {
            "action": "save_cohort",
            "user_id": user_id,
            "cohort_id": cohort_id,
            "study_id": study_id,
            "provisional": provisional,
            "phenotype_count": len(cohort_data.get("phenotypes", [])),
            "phenotype_ids": [p.get("id") for p in cohort_data.get("phenotypes", [])],
        }
        self.operations.append(operation)
        self.cohorts[cohort_id] = cohort_data
        return True


# Mock connection class for database operations
class MockConnection:
    """Mock database connection that handles queries."""

    def __init__(self, mock_db):
        self.mock_db = mock_db

    async def fetch(self, query: str, *params):
        """Mock fetch method that returns codelist data."""
        import json

        # Handle codelistfile table queries
        if "FROM codelistfile" in query:
            user_id = params[0] if params else None
            cohort_id = params[1] if len(params) > 1 else None

            # Return mock codelist files with proper structure for list_codelists
            results = []
            for name, codelist_data in MOCK_CODELISTS.items():
                # Create mock file data structure
                # Each codelist name appears as a row in the "data" with associated codes
                code_list = []
                code_type_list = []
                codelist_name_list = []

                # For each code type (ICD10, LOINC, etc.)
                for code_type, codes in codelist_data["codes"].items():
                    for code in codes:
                        code_list.append(code)
                        code_type_list.append(code_type)
                        codelist_name_list.append(name)  # Codelist name for this row

                # Create filename from name (lowercase, replace spaces with underscores)
                filename = name.lower().replace(" ", "_") + ".csv"

                results.append(
                    {
                        "file_id": codelist_data["id"],
                        "file_name": filename,
                        "codelist_data": json.dumps(
                            {
                                "filename": filename,  # Add filename to codelist_data
                                "name": name,
                                "description": codelist_data.get("description", ""),
                                "contents": {
                                    "data": {
                                        "code": code_list,
                                        "code_type": code_type_list,
                                        "codelist": codelist_name_list,
                                    }
                                },
                            }
                        ),
                        "column_mapping": json.dumps(
                            {
                                "code_column": "code",
                                "code_type_column": "code_type",
                                "codelist_column": "codelist",
                            }
                        ),
                        "codelists": name,  # Codelist names in the file
                    }
                )
            return results

        return []

    async def close(self):
        """Mock close method."""
        pass


# Enhanced Mock Database that only mocks DB operations
class EnhancedMockDB(MockDB):
    def __init__(self):
        super().__init__()
        self.function_calls = []  # Track function calls made by AI

    async def get_connection(self):
        """Return a mock connection object."""
        return MockConnection(self)

    def log_function_call(self, function_name, args, kwargs, result):
        """Log function calls made during AI execution."""
        import time

        try:
            timestamp = asyncio.get_event_loop().time()
        except RuntimeError:
            timestamp = time.time()

        call_info = {
            "function": function_name,
            "args": args,
            "kwargs": kwargs,
            "result": str(result)[:100],  # Truncate long results
            "timestamp": timestamp,
        }
        self.function_calls.append(call_info)
        print(f"🔧 FUNCTION CALL: {function_name}")
        if args:
            print(f"   Args: {args}")
        if kwargs:
            print(f"   Kwargs: {list(kwargs.keys())}")
        print(f"   Result: {str(result)[:80]}{'...' if len(str(result)) > 80 else ''}")
        return result

    async def execute(self, query: str, params: tuple = ()):
        """Mock execute method that handles codelist queries."""
        import json

        # Handle codelist search queries
        if "FROM codelists" in query and ("LIKE" in query or "=" in query):
            study_id = params[0] if params else None

            # Extract the search/filter condition
            if "LIKE" in query:
                # Search query (codelist_search tool)
                search_term = (
                    params[1].replace("%", "").lower() if len(params) > 1 else ""
                )
                results = []
                for name, codelist_data in MOCK_CODELISTS.items():
                    if (
                        search_term in name.lower()
                        or search_term in codelist_data.get("description", "").lower()
                    ):
                        results.append(
                            (
                                codelist_data["id"],
                                codelist_data["name"],
                                codelist_data["description"],
                                json.dumps(codelist_data["codes"]),
                            )
                        )
                return results
            elif "name = ?" in query:
                # Exact name lookup (atomic_update_codelist with string)
                codelist_name = params[1] if len(params) > 1 else None
                if codelist_name and codelist_name in MOCK_CODELISTS:
                    codelist_data = MOCK_CODELISTS[codelist_name]
                    return [
                        (
                            codelist_data["id"],
                            codelist_data["name"],
                            json.dumps(codelist_data["codes"]),
                        )
                    ]
                return []

        # Default: no results
        return []


# ==================== MOCK CODELIST TABLE ====================
MOCK_CODELISTS = {
    "Atrial Fibrillation": {
        "id": "cl_afib_001",
        "name": "Atrial Fibrillation",
        "description": "ICD-10 codes for atrial fibrillation and flutter",
        "codes": {"ICD10": ["I48", "I48.0", "I48.1", "I48.2", "I48.9"]},
    },
    "Type 2 Diabetes": {
        "id": "cl_diabetes_001",
        "name": "Type 2 Diabetes",
        "description": "ICD-10 codes for Type 2 diabetes mellitus",
        "codes": {"ICD10": ["E11", "E11.0", "E11.1", "E11.2", "E11.9"]},
    },
    "Sepsis and Septic Shock": {
        "id": "cl_sepsis_001",
        "name": "Sepsis and Septic Shock",
        "description": "ICD-10 codes for sepsis and septic shock in adults",
        "codes": {"ICD10": ["A41.9", "R65.20", "R65.21", "A41.0", "A41.1"]},
    },
    "Heart Failure": {
        "id": "cl_hf_001",
        "name": "Heart Failure",
        "description": "ICD-10 codes for heart failure",
        "codes": {"ICD10": ["I50", "I50.0", "I50.1", "I50.9", "I11.0"]},
    },
    "HbA1c LOINC": {
        "id": "cl_hba1c_001",
        "name": "HbA1c LOINC",
        "description": "LOINC codes for Hemoglobin A1c measurements",
        "codes": {"LOINC": ["4548-4", "17856-6", "59261-8"]},
    },
    "Hypertension": {
        "id": "cl_htn_001",
        "name": "Hypertension",
        "description": "ICD-10 codes for hypertension",
        "codes": {"ICD10": ["I10", "I11", "I12", "I13", "I15"]},
    },
    "Chronic Kidney Disease": {
        "id": "cl_ckd_001",
        "name": "Chronic Kidney Disease",
        "description": "ICD-10 codes for chronic kidney disease",
        "codes": {
            "ICD10": [
                "N18",
                "N18.1",
                "N18.2",
                "N18.3",
                "N18.4",
                "N18.5",
                "N18.6",
                "N18.9",
            ]
        },
    },
}


async def mock_codelist_search(query: str) -> List[Dict]:
    """Mock codelist search function for testing."""
    query_lower = query.lower()
    matches = [
        cl
        for name, cl in MOCK_CODELISTS.items()
        if query_lower in name.lower()
        or query_lower in cl.get("description", "").lower()
    ]
    return matches


async def mock_get_codelist_by_name(study_id: str, name: str) -> Dict:
    """Mock function to get codelist by exact name."""
    return MOCK_CODELISTS.get(name)


# ==================== END MOCK CODELIST TABLE ====================

# Setup mocks - ONLY mock database and utilities, keep real atomic functions
mock_db = types.ModuleType("database")
mock_db.DatabaseManager = EnhancedMockDB
enhanced_db_manager = EnhancedMockDB()
mock_db.db_manager = enhanced_db_manager
sys.modules["database"] = mock_db


class MockCohortUtils:
    def convert_phenotypes_to_structure(self, cohort_data):
        print(
            f"🔄 CohortUtils.convert_phenotypes_to_structure called with {len(cohort_data.get('phenotypes', []))} phenotypes"
        )
        return cohort_data


mock_utils = types.ModuleType("utils")
mock_utils.CohortUtils = MockCohortUtils
sys.modules["utils"] = mock_utils

mock_rag = types.ModuleType("rag")
mock_rag.query_faiss_index = lambda **x: [
    "Documentation about PhenEx phenotypes and parameters"
]
sys.modules["rag"] = mock_rag

print("✅ Mocks setup complete - using real atomic functions, mock database")

# Import the agent
try:
    # Try different import paths
    try:
        from routes.ai import agent

        print("✅ AI Agent imported successfully (routes.ai)")
    except ImportError:
        # Alternative: import directly from ai.py
        import sys

        ai_module_path = backend_path / "routes" / "ai.py"
        if ai_module_path.exists():
            spec = importlib.util.spec_from_file_location("ai", ai_module_path)
            ai_module = importlib.util.module_from_spec(spec)
            sys.modules["ai"] = ai_module
            spec.loader.exec_module(ai_module)
            agent = ai_module.agent
            print("✅ AI Agent imported successfully (direct file import)")
        else:
            raise ImportError(f"AI module not found at {ai_module_path}")

except Exception as e:
    print(f"❌ Failed to import agent: {e}")
    print(f"Backend path: {backend_path}")
    print(f"AI module exists: {(backend_path / 'routes' / 'ai.py').exists()}")
    sys.exit(1)


class CohortContext(BaseModel):
    user_id: str
    cohort_id: str
    study_id: str
    current_cohort: Dict
    db_manager: Any = None

    class Config:
        arbitrary_types_allowed = True


def print_section_header(title, level=1):
    """Print a formatted section header."""
    if level == 1:
        print(f"\n{'='*80}")
        print(f"  {title}")
        print(f"{'='*80}")
    elif level == 2:
        print(f"\n{'-'*60}")
        print(f"  {title}")
        print(f"{'-'*60}")
    else:
        print(f"\n{'~'*40}")
        print(f"  {title}")
        print(f"{'~'*40}")


def print_phenotypes(phenotypes, title="Phenotypes"):
    """Print phenotypes in a readable format."""
    print(f"\n{title}:")
    if not phenotypes:
        print("  (No phenotypes)")
        return

    for i, phenotype in enumerate(phenotypes, 1):
        print(f"  {i}. ID: {phenotype.get('id', 'N/A')}")
        print(f"     Name: {phenotype.get('name', 'N/A')}")
        print(f"     Type: {phenotype.get('type', 'N/A')}")
        print(f"     Class: {phenotype.get('class_name', 'N/A')}")
        print(f"     Description: {phenotype.get('description', 'N/A')}")

        # Show key parameters
        if phenotype.get("codelist"):
            codelist = phenotype["codelist"]
            if isinstance(codelist, list) and codelist:
                codes = codelist[0].get("codelist", {})
                print(f"     Codes: {codes}")
            elif isinstance(codelist, dict):
                print(f"     Codes: {codelist}")

        if phenotype.get("value_filter"):
            vf = phenotype["value_filter"]
            min_val = (
                vf.get("min_value", {}).get("value") if vf.get("min_value") else None
            )
            max_val = (
                vf.get("max_value", {}).get("value") if vf.get("max_value") else None
            )
            if min_val is not None or max_val is not None:
                print(f"     Value Range: {min_val or '∞'} - {max_val or '∞'}")
        print()


def compare_cohorts(initial_cohort, final_cohort):
    """Compare initial and final cohort states and show differences."""
    print_section_header("COHORT COMPARISON", level=3)

    initial_phenotypes = initial_cohort.get("phenotypes", [])
    final_phenotypes = final_cohort.get("phenotypes", [])

    initial_ids = {p.get("id") for p in initial_phenotypes}
    final_ids = {p.get("id") for p in final_phenotypes}

    added_ids = final_ids - initial_ids
    removed_ids = initial_ids - final_ids
    common_ids = initial_ids & final_ids

    print(f"📊 SUMMARY OF CHANGES:")
    print(f"   • Initial phenotypes: {len(initial_phenotypes)}")
    print(f"   • Final phenotypes: {len(final_phenotypes)}")
    print(f"   • Added: {len(added_ids)}")
    print(f"   • Removed: {len(removed_ids)}")
    print(f"   • Modified: (checking...)")

    # Show added phenotypes with RAW JSON
    if added_ids:
        print(f"\n✅ ADDED PHENOTYPES ({len(added_ids)}):")
        for phenotype in final_phenotypes:
            if phenotype.get("id") in added_ids:
                print(
                    f"   + {phenotype.get('id')}: {phenotype.get('name')} ({phenotype.get('class_name')})"
                )
                print(f"     RAW JSON:")
                print(json.dumps(phenotype, indent=6))
                print()

    # Show removed phenotypes
    if removed_ids:
        print(f"\n🗑️  REMOVED PHENOTYPES ({len(removed_ids)}):")
        for phenotype in initial_phenotypes:
            if phenotype.get("id") in removed_ids:
                print(
                    f"   - {phenotype.get('id')}: {phenotype.get('name')} ({phenotype.get('class_name')})"
                )

    # Check for modifications in common phenotypes
    modified_count = 0
    for phenotype_id in common_ids:
        initial_p = next(
            (p for p in initial_phenotypes if p.get("id") == phenotype_id), None
        )
        final_p = next(
            (p for p in final_phenotypes if p.get("id") == phenotype_id), None
        )

        if initial_p and final_p:
            # Compare key fields
            changes = []
            if initial_p.get("name") != final_p.get("name"):
                changes.append(
                    f"name: '{initial_p.get('name')}' → '{final_p.get('name')}'"
                )
            if initial_p.get("description") != final_p.get("description"):
                changes.append(f"description: changed")
            if initial_p.get("type") != final_p.get("type"):
                changes.append(
                    f"type: '{initial_p.get('type')}' → '{final_p.get('type')}'"
                )
            if str(initial_p.get("codelist")) != str(final_p.get("codelist")):
                changes.append(f"codelist: modified")
            if str(initial_p.get("value_filter")) != str(final_p.get("value_filter")):
                changes.append(f"value_filter: modified")

            if changes:
                modified_count += 1
                if modified_count == 1:
                    print(f"\n📝 MODIFIED PHENOTYPES:")
                print(f"   ~ {phenotype_id}: {', '.join(changes)}")
                print(f"     RAW JSON (after modification):")
                print(json.dumps(final_p, indent=6))
                print()

    if modified_count == 0 and len(added_ids) == 0 and len(removed_ids) == 0:
        print(f"\n🔄 NO CHANGES DETECTED")


def validate_cohort_with_phenex(cohort_data):
    """Validate that the cohort structure will work with PhenEx's from_dict() method."""
    print_section_header("PHENEX VALIDATION", level=2)

    if not PHENEX_AVAILABLE:
        print("⚠️  PhenEx classes not available - skipping validation")
        print("🔍 Attempting to diagnose import issues...")

        # Try to give more details about the import failure
        project_root = Path(__file__).parent.parent
        phenex_path = project_root / "phenex"

        print(f"🔍 Project root: {project_root}")
        print(f"🔍 Looking for phenex directory: {phenex_path}")
        print(f"🔍 Phenex directory exists: {phenex_path.exists()}")

        if phenex_path.exists():
            phenotypes_path = phenex_path / "phenotypes"
            print(f"🔍 Phenotypes directory exists: {phenotypes_path.exists()}")

            if phenotypes_path.exists():
                cohort_file = phenotypes_path / "cohort.py"
                phenotype_file = phenotypes_path / "phenotype.py"
                print(f"🔍 cohort.py exists: {cohort_file.exists()}")
                print(f"🔍 phenotype.py exists: {phenotype_file.exists()}")

        # Try importing with more specific error handling
        try:
            from phenex.phenotypes.phenotype import Phenotype

            print("✅ Basic Phenotype import succeeded")
        except ImportError as e:
            print(f"❌ Basic Phenotype import failed: {e}")
        except Exception as e:
            print(f"❌ Other error importing Phenotype: {e}")

        try:
            from phenex.phenotypes.cohort import Cohort

            print("✅ Cohort import succeeded")
        except ImportError as e:
            print(f"❌ Cohort import failed: {e}")
        except Exception as e:
            print(f"❌ Other error importing Cohort: {e}")

        return False

    try:
        print(f"📋 Raw Cohort Structure:")
        print(json.dumps(cohort_data, indent=2))
        print()

        # Validate each phenotype (skip full Cohort validation - just validate phenotypes)
        phenotypes = cohort_data.get("phenotypes", [])
        print(f"🔧 Testing individual phenotypes ({len(phenotypes)} total)...")

        for i, phenotype_data in enumerate(phenotypes, 1):
            phenotype_id = phenotype_data.get("id", f"phenotype_{i}")
            phenotype_name = phenotype_data.get("name", "N/A")
            class_name = phenotype_data.get("class_name", "Unknown")

            try:
                print(
                    f"   {i}. Testing {phenotype_id} - '{phenotype_name}' ({class_name})..."
                )

                # Use standalone from_dict function for all phenotypes
                phenotype = from_dict(
                    phenotype_data.copy()
                )  # Use copy to avoid modifying original

                print(f"      ✅ from_dict() succeeded for {class_name}")

            except Exception as e:
                print(f"      ❌ from_dict() failed for {class_name}: {e}")
                print(f"      🔍 Phenotype data:")
                print(json.dumps(phenotype_data, indent=8))
                return False

        print(f"\n🎉 ALL VALIDATION PASSED - All phenotypes are valid for PhenEx!")
        return True

    except Exception as e:
        print(f"❌ Validation failed: {e}")
        print(f"\n🔍 This means the cohort structure is not compatible with PhenEx")
        return False


def automated_validation(scenario, initial_cohort, final_cohort, ai_actions) -> dict:
    """
    Automatically validate that the AI changes match the expected scenario outcome.

    Validates:
    - Expected tool calls (names and parameters)
    - Unexpected tool calls (tools that shouldn't be called)
    - Final cohort structure (if provided)

    Supports wildcard matching with '*' for fields that may vary (e.g., auto-generated IDs).

    Returns:
        dict: Validation results with pass/fail status and detailed analysis
    """
    scenario_label = f"[{scenario.name}]"
    print_section_header(f"AUTOMATED VALIDATION {scenario_label}", level=2)

    validation_results = {
        "overall_pass": True,
        "checks": [],
        "score": 0,
        "total_checks": 0,
        "errors": [],
        "warnings": [],
    }

    def matches_with_wildcard(expected, actual) -> bool:
        """
        Compare expected and actual values, supporting '*' wildcard for any value.
        Works recursively for nested dictionaries and lists.
        """
        # If expected is '*', any actual value matches
        if expected == "*":
            return True

        # If types don't match (and expected is not wildcard), check for numeric string equivalence
        if type(expected) != type(actual):
            # Allow numeric strings to match numbers (e.g., "365" matches 365)
            if isinstance(expected, str) and isinstance(actual, (int, float)):
                try:
                    return float(expected) == actual
                except (ValueError, TypeError):
                    return False
            elif isinstance(expected, (int, float)) and isinstance(actual, str):
                try:
                    return expected == float(actual)
                except (ValueError, TypeError):
                    return False
            return False

        # Handle dictionaries recursively
        if isinstance(expected, dict):
            # Check all expected keys are present
            for key, expected_val in expected.items():
                if key not in actual:
                    return False
                if not matches_with_wildcard(expected_val, actual[key]):
                    return False
            return True

        # Handle lists recursively
        elif isinstance(expected, list):
            if len(expected) != len(actual):
                return False
            for exp_item, act_item in zip(expected, actual):
                if not matches_with_wildcard(exp_item, act_item):
                    return False
            return True

        # Handle primitives (str, int, float, bool, None)
        else:
            return expected == actual

    def add_check(
        name: str, expected, actual, passed: bool = None, critical: bool = True
    ):
        """Helper to add a validation check."""
        if passed is None:
            # Use wildcard matching if expected contains wildcards
            if isinstance(expected, (dict, list)) or expected == "*":
                passed = matches_with_wildcard(expected, actual)
            else:
                passed = expected == actual

        check = {
            "name": name,
            "expected": expected,
            "actual": actual,
            "passed": passed,
            "critical": critical,
        }
        validation_results["checks"].append(check)
        validation_results["total_checks"] += 1

        if passed:
            validation_results["score"] += 1
            print(f"   ✅ {name}:\nExpected:\n\t{expected}\nGot:\n\t{actual}")
        else:
            print(f"   ❌ {name}:\nExpected:\n\t {expected}\nGot:\n\t{actual}")
            if critical:
                validation_results["overall_pass"] = False
                validation_results["errors"].append(
                    f"{name}:\nExpected:\n\t{expected}\nGot:\n\nt{actual}"
                )
            else:
                validation_results["warnings"].append(
                    f"{name}:\nExpected:\n\t{expected}\nGot:\n\t{actual}"
                )

        return passed

    print(f"🔍 Validating scenario: {scenario.name}")
    print(f"📋 Running automated checks against expected outcome...")

    # === TOOL CALL VALIDATION ===
    print(f"\n🔧 TOOL CALL VALIDATION:")

    # Extract tool calls from ai_actions
    actual_tool_calls = [action["tool"] for action in ai_actions]

    # Check expected tool calls
    if scenario.expected_tool_calls:
        print(f"   Expected tool calls: {scenario.expected_tool_calls}")
        print(f"   Actual tool calls: {actual_tool_calls}")

        for expected_call in scenario.expected_tool_calls:
            if isinstance(expected_call, str):
                # Simple tool name check
                tool_name = expected_call
                was_called = tool_name in actual_tool_calls

                # Handle equivalence: add_phenotype ≈ create_phenotype + atomic functions
                # This is an acceptable alternative pattern per system prompt
                if not was_called and tool_name == "add_phenotype":
                    # Check if create_phenotype was used instead (multi-step approach)
                    if "create_phenotype" in actual_tool_calls:
                        was_called = True
                        print(
                            f"      ℹ️  Note: 'create_phenotype' + atomic functions used instead of 'add_phenotype' (acceptable)"
                        )

                add_check(f"Tool '{tool_name}' was called", True, was_called)

            elif isinstance(expected_call, dict):
                # Detailed check with parameters
                tool_name = expected_call.get("tool")
                expected_params = expected_call.get("params", {})

                # Find matching tool call
                matching_calls = [
                    action for action in ai_actions if action["tool"] == tool_name
                ]

                if not matching_calls:
                    add_check(f"Tool '{tool_name}' was called", True, False)
                    continue

                # Check parameters if specified
                if expected_params:
                    found_match = False
                    for call in matching_calls:
                        call_args = call.get("args", {})

                        # Check if all expected params match
                        params_match = True
                        for param_name, expected_value in expected_params.items():
                            # Handle nested parameter checks (e.g., call.id)
                            if "." in param_name:
                                # Dotted notation: try nested dict access
                                parts = param_name.split(".")
                                actual_value = call_args
                                for part in parts:
                                    if isinstance(actual_value, dict):
                                        actual_value = actual_value.get(part)
                                    else:
                                        actual_value = None
                                        break
                            else:
                                # Direct key access
                                actual_value = call_args.get(param_name)

                            if actual_value != expected_value:
                                params_match = False
                                break

                        if params_match:
                            found_match = True
                            break

                    param_summary = ", ".join(
                        [f"{k}={v}" for k, v in expected_params.items()]
                    )
                    add_check(
                        f"Tool '{tool_name}' called with correct params ({param_summary})",
                        True,
                        found_match,
                    )
                else:
                    # Just check it was called
                    add_check(f"Tool '{tool_name}' was called", True, True)

    # Check unexpected tool calls
    if scenario.unexpected_tool_calls:
        print(
            f"   Unexpected tool calls (should NOT be called): {scenario.unexpected_tool_calls}"
        )

        for unexpected_tool in scenario.unexpected_tool_calls:
            was_called = unexpected_tool in actual_tool_calls
            call_count = actual_tool_calls.count(unexpected_tool) if was_called else 0
            add_check(
                f"Tool '{unexpected_tool}' was NOT called",
                False,
                was_called,
                passed=(not was_called),
            )
            if was_called:
                print(
                    f"      ⚠️  Tool '{unexpected_tool}' was called {call_count} times"
                )

    # === FINAL COHORT VALIDATION ===
    if scenario.expected_final_cohort is not None:
        print(f"\n📊 FINAL COHORT VALIDATION:")

        expected_phenotypes = scenario.expected_final_cohort.get("phenotypes", [])
        actual_phenotypes = final_cohort.get("phenotypes", [])

        # Check phenotype count
        expected_count = len(expected_phenotypes)
        actual_count = len(actual_phenotypes)
        add_check("Final phenotype count", expected_count, actual_count)

        # Check phenotype IDs match (support wildcards)
        expected_ids = {p.get("id") for p in expected_phenotypes if p.get("id") != "*"}
        actual_ids = {p.get("id") for p in actual_phenotypes}
        wildcard_count = sum(1 for p in expected_phenotypes if p.get("id") == "*")

        if wildcard_count > 0:
            # With wildcards, just check that known IDs are present and total count matches
            add_check(
                "Final phenotype count",
                len(expected_phenotypes),
                len(actual_phenotypes),
            )
            missing_ids = expected_ids - actual_ids
            if missing_ids:
                add_check(
                    "Expected phenotype IDs present",
                    f"Missing: {missing_ids}",
                    "All present",
                    passed=False,
                    critical=False,
                )
            else:
                add_check(
                    "Expected phenotype IDs present",
                    "All present",
                    "All present",
                    passed=True,
                    critical=False,
                )
        else:
            # No wildcards, exact ID matching
            add_check("Final phenotype IDs", expected_ids, actual_ids)

        # Deep comparison of each phenotype
        print(f"   🔍 Comparing phenotype content...")

        # Match expected phenotypes to actual phenotypes
        for expected_p in expected_phenotypes:
            p_id = expected_p.get("id")

            if p_id == "*":
                # Wildcard phenotype - match by other criteria (e.g., class_name, type)
                # Find an actual phenotype that matches the expected structure
                expected_class = expected_p.get("class_name")
                expected_type = expected_p.get("type")

                # Find unmatched actual phenotypes with same class/type
                matched_actual = None
                for actual_p in actual_phenotypes:
                    # Skip if already matched
                    if actual_p.get("id") in expected_ids:
                        continue
                    # Check if class and type match
                    if (
                        expected_class == "*"
                        or actual_p.get("class_name") == expected_class
                    ) and (
                        expected_type == "*" or actual_p.get("type") == expected_type
                    ):
                        matched_actual = actual_p
                        break

                if not matched_actual:
                    add_check(
                        f"Wildcard phenotype (class={expected_class}, type={expected_type}) found",
                        True,
                        False,
                        critical=False,
                    )
                    continue

                p_display_id = f"*({matched_actual.get('id')})"
                actual_p = matched_actual
            else:
                # Specific ID - exact match
                actual_p = next(
                    (p for p in actual_phenotypes if p.get("id") == p_id), None
                )
                p_display_id = p_id

            if actual_p:
                # Compare key fields (supporting wildcards)
                for field in ["name", "class_name", "type", "description", "domain"]:
                    if field in expected_p:
                        expected_val = expected_p.get(field)
                        actual_val = actual_p.get(field)
                        add_check(
                            f"Phenotype {p_display_id} '{field}'",
                            expected_val,
                            actual_val,
                            critical=False,
                        )

                # Compare complex fields (supporting nested wildcards)
                for field in [
                    "codelist",
                    "value_filter",
                    "relative_time_range",
                    "categorical_filter",
                ]:
                    if field in expected_p:
                        expected_val = expected_p.get(field)
                        actual_val = actual_p.get(field)
                        # Use wildcard matching for complex fields
                        match = matches_with_wildcard(expected_val, actual_val)

                        # Show actual structures if they don't match (for debugging)
                        if not match:
                            print(
                                f"\n      🔍 DEBUG: {field} mismatch for {p_display_id}:"
                            )
                            print(
                                f"         Expected: {json.dumps(expected_val, indent=10)}"
                            )
                            print(
                                f"         Actual:   {json.dumps(actual_val, indent=10)}"
                            )

                        # Pass the actual structures to add_check, not just "matches"/"differs"
                        add_check(
                            f"Phenotype {p_display_id} '{field}' structure matches",
                            expected_val,
                            actual_val,
                            passed=match,
                            critical=False,
                        )
    else:
        print(
            f"\n📊 FINAL COHORT VALIDATION: Skipped (expected_final_cohort not specified)"
        )
        print(f"   ℹ️  Final cohort structure may be ambiguous for this scenario")

    # AI Tool Usage Appropriateness
    if ai_actions:
        tool_names = [action["tool"] for action in ai_actions]
        tool_counts = {tool: tool_names.count(tool) for tool in set(tool_names)}

        # Check for efficiency - no excessive tool calls
        total_calls = len(ai_actions)
        efficient = total_calls <= 5  # Reasonable limit
        add_check("Tool Call Efficiency (≤5 calls)", True, efficient, critical=False)

        # Check for appropriate tools based on scenario type
        if (
            "deletion" in scenario.name.lower()
            or "remove" in scenario.user_request.lower()
        ):
            has_delete_tool = "delete_phenotype" in tool_names
            add_check(
                "Used delete_phenotype for removal",
                True,
                has_delete_tool,
                critical=False,
            )

        if (
            "add" in scenario.user_request.lower()
            or "create" in scenario.user_request.lower()
        ):
            has_creation_tool = any(
                tool in tool_names for tool in ["add_phenotype", "create_phenotype"]
            )
            add_check(
                "Used creation tool for adding", True, has_creation_tool, critical=False
            )

    # Check 8: PhenEx Compatibility
    phenex_valid = validate_cohort_with_phenex(final_cohort)
    if PHENEX_AVAILABLE:
        add_check("PhenEx Compatibility", True, phenex_valid)
    else:
        add_check(
            "PhenEx Compatibility",
            "Skipped (imports unavailable)",
            "Skipped (imports unavailable)",
            passed=True,
            critical=False,
        )

    # Calculate final score
    if validation_results["total_checks"] > 0:
        score_percentage = (
            validation_results["score"] / validation_results["total_checks"]
        ) * 100
        validation_results["score_percentage"] = score_percentage
    else:
        validation_results["score_percentage"] = 0

    # Print summary
    print(f"\n📊 VALIDATION SUMMARY:")
    print(
        f"   Overall Status: {'✅ PASS' if validation_results['overall_pass'] else '❌ FAIL'}"
    )

    # Make perfect score more prominent
    score_str = f"{validation_results['score']}/{validation_results['total_checks']} ({validation_results['score_percentage']:.1f}%)"
    if validation_results["score_percentage"] == 100.0:
        print(f"   Score: 🎉🎉🎉🎉🎉 {score_str} 🎉🎉🎉🎉🎉 PERFECT SCORE!")
    else:
        print(f"   Score: {score_str}")

    if validation_results["errors"]:
        print(f"\n❌ Critical Errors ({len(validation_results['errors'])}):")
        for error in validation_results["errors"]:
            print(f"   • {error}")

    if validation_results["warnings"]:
        print(f"\n⚠️  Warnings ({len(validation_results['warnings'])}):")
        for warning in validation_results["warnings"]:
            print(f"   • {warning}")

    return validation_results


class TestScenario:
    """Represents a single test scenario with initial state, request, and expected outcome."""

    def __init__(
        self,
        name,
        initial_cohort,
        user_request,
        expected_description,
        expected_final_cohort=None,
        expected_tool_calls=None,
        unexpected_tool_calls=None,
    ):
        self.name = name
        self.initial_cohort = initial_cohort
        self.user_request = user_request
        self.expected_description = expected_description
        self.expected_final_cohort = expected_final_cohort  # None if ambiguous/flexible
        self.expected_tool_calls = (
            expected_tool_calls or []
        )  # List of tool names or detailed specs
        self.unexpected_tool_calls = (
            unexpected_tool_calls or []
        )  # Tools that should NOT be called


def create_base_cohort():
    """Create a base cohort with common phenotypes for testing."""
    return {
        "id": "test_cohort_001",
        "name": "Diabetes Research Cohort",
        "class_name": "Cohort",
        "phenotypes": [
            {
                "id": "age_001",
                "name": "Adult Age Range",
                "class_name": "AgePhenotype",
                "type": "inclusion",
                "description": "Include adults aged 18-65",
                "domain": "person",
                "value_filter": {
                    "class_name": "ValueFilter",
                    "min_value": {"class_name": "GreaterThanOrEqualTo", "value": 18},
                    "max_value": {"class_name": "LessThanOrEqualTo", "value": 65},
                },
            },
            {
                "id": "diabetes_001",
                "name": "Type 2 Diabetes Diagnosis",
                "class_name": "CodelistPhenotype",
                "type": "inclusion",
                "description": "ICD-10 codes for Type 2 diabetes mellitus",
                "domain": "CONDITION_OCCURRENCE",
                "return_date": "first",
                "codelist": {
                    "codelist": {"ICD10": ["E11", "E11.0", "E11.1"]},
                    "class_name": "Codelist",
                    "codelist_type": "manual",
                    "use_code_type": True,
                    "remove_punctuation": False,
                },
            },
            {
                "id": "hba1c_001",
                "name": "HbA1c Measurement",
                "class_name": "MeasurementPhenotype",
                "type": "characteristics",
                "description": "Hemoglobin A1c lab results",
                "domain": "measurement",
                "return_date": "first",
                "codelist": {
                    "codelist": {"LOINC": ["4548-4"]},
                    "class_name": "Codelist",
                    "codelist_type": "manual",
                    "use_code_type": True,
                    "remove_punctuation": False,
                },
                "value_filter": {
                    "class_name": "ValueFilter",
                    "min_value": {
                        "class_name": "GreaterThan",
                        "value": 6.5,
                        "operator": ">",
                    },
                },
            },
        ],
    }


def define_test_scenarios():
    """Define the test scenarios for manual verification.

    WILDCARD MATCHING:
    - Use '*' in expected_final_cohort to match any value for that field
    - Works for: strings, numbers, nested dicts, lists
    - Example: {"id": "*", "name": "exact", "value": "*"} matches any id/value but exact name
    - Useful for auto-generated IDs, variable descriptions, timestamps, etc.
    """

    # Helper to create expected final cohort from base with specific phenotypes
    def create_expected_cohort_with_phenotypes(phenotype_ids):
        """Create expected cohort containing only specified phenotype IDs."""
        base = create_base_cohort()
        base_phenotypes = base.get("phenotypes", [])
        expected_phenotypes = [
            p for p in base_phenotypes if p.get("id") in phenotype_ids
        ]

        return {
            "id": base["id"],
            "name": base["name"],
            "class_name": base["class_name"],
            "phenotypes": expected_phenotypes,
        }

    scenarios = [
        # SCENARIO 1: Information Only (No Changes)
        TestScenario(
            name="Information Request - No Changes",
            initial_cohort=create_base_cohort(),
            user_request="Can you explain what phenotypes are currently in this cohort and what they do?",
            expected_description="Should provide information about existing phenotypes without making any changes",
            expected_tool_calls=[],  # NO tool calls expected
            unexpected_tool_calls=[
                "add_phenotype",
                "create_phenotype",
                "delete_phenotype",
                "atomic_update_value_filter",
                "atomic_update_description",
                "atomic_update_codelist",
                "atomic_update_relative_time_range",
            ],
            expected_final_cohort=create_base_cohort(),  # Should be unchanged
        ),
        # SCENARIO 2: Simple Deletion
        TestScenario(
            name="Simple Phenotype Deletion",
            initial_cohort=create_base_cohort(),
            user_request="Remove the HbA1c measurement phenotype from the cohort as we don't need lab values for this study",
            expected_description="Should delete the HbA1c measurement phenotype, leaving only age and diabetes phenotypes",
            expected_tool_calls=[
                {"tool": "delete_phenotype", "params": {"id": "hba1c_001"}}
            ],
            unexpected_tool_calls=[
                "add_phenotype",
                "create_phenotype",
                "update_phenotype",
            ],
            expected_final_cohort=create_expected_cohort_with_phenotypes(
                ["age_001", "diabetes_001"]
            ),
        ),
        # SCENARIO 3: Add New Phenotype
        TestScenario(
            name="Add Hypertension Exclusion",
            initial_cohort=create_base_cohort(),
            user_request="Add a new exclusion criterion for hypertension using ICD-10 codes I10, I11, and I12. Call it 'Hypertension Exclusion'",
            expected_description="Should add a new CodelistPhenotype for hypertension exclusion with proper ICD-10 codes",
            expected_tool_calls=[
                "add_phenotype",  # or create_phenotype + atomic_update_codelist
            ],
            unexpected_tool_calls=["delete_phenotype"],
            # Use wildcards for expected_final_cohort - ID will be auto-generated
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # Keep existing phenotypes (exact matches)
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # New phenotype with wildcard ID and specific structure
                    {
                        "id": "*",  # Wildcard - any ID accepted
                        "name": "Hypertension Exclusion",
                        "class_name": "CodelistPhenotype",
                        "type": "exclusion",
                        "description": "*",  # Wildcard - description may vary
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "codelist": {"ICD10": ["I10", "I11", "I12"]},
                            "class_name": "Codelist",
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                    },
                ],
            },
        ),
        # SCENARIO 4: Update Existing Phenotype
        TestScenario(
            name="Update Age Range",
            initial_cohort=create_base_cohort(),
            user_request="For the age phenotype, change the minimum age to 25 and maximum age to 70, and update the description to reflect the new range",
            expected_description="Should update the age filter values and description while keeping the same phenotype ID",
            expected_tool_calls=[
                {
                    "tool": "atomic_update_value_filter",
                    "params": {"phenotype_id": "age_001"},
                },
            ],
            unexpected_tool_calls=[
                "add_phenotype",
                "create_phenotype",
                "delete_phenotype",
            ],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # Updated age phenotype with new range
                    {
                        "id": "age_001",
                        "name": "*",  # Name may be updated or kept the same
                        "class_name": "AgePhenotype",
                        "type": "inclusion",
                        "description": "*",  # Description will be updated to reflect new range
                        "domain": "person",
                        "value_filter": {
                            "class_name": "ValueFilter",
                            "min_value": {
                                "class_name": "GreaterThanOrEqualTo",
                                "value": 25,
                                "operator": ">=",
                            },
                            "max_value": {
                                "class_name": "LessThanOrEqualTo",
                                "value": 70,
                                "operator": "<=",
                            },
                        },
                    },
                    # Other phenotypes unchanged
                    {
                        "id": "diabetes_001",
                        "name": "Type 2 Diabetes Diagnosis",
                        "class_name": "CodelistPhenotype",
                        "type": "inclusion",
                        "description": "ICD-10 codes for Type 2 diabetes mellitus",
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "codelist": {"ICD10": ["E11", "E11.0", "E11.1"]},
                            "class_name": "Codelist",
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                    },
                    {
                        "id": "hba1c_001",
                        "name": "HbA1c Measurement",
                        "class_name": "MeasurementPhenotype",
                        "type": "characteristics",
                        "description": "Hemoglobin A1c lab results",
                        "domain": "measurement",
                        "codelist": {
                            "codelist": {"LOINC": ["4548-4"]},
                            "class_name": "Codelist",
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                        "value_filter": {
                            "class_name": "ValueFilter",
                            "min_value": {
                                "class_name": "GreaterThan",
                                "value": 6.5,
                                "operator": ">",
                            },
                        },
                    },
                ],
            },
        ),
        # SCENARIO 5: Add Time Range Filter to Existing Phenotype
        TestScenario(
            name="Add Recent Diagnosis Time Filter",
            initial_cohort=create_base_cohort(),
            user_request="Update the diabetes phenotype to only include patients diagnosed in the 12 months before index.",
            expected_description="Should add a time range filter to diabetes phenotype restricting to recent diagnoses",
            expected_tool_calls=[
                {
                    "tool": "atomic_update_relative_time_range",
                    "params": {"phenotype_id": "diabetes_001"},
                },
            ],
            unexpected_tool_calls=[
                "add_phenotype",
                "create_phenotype",
                "delete_phenotype",
            ],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # Age phenotype unchanged
                    {
                        "id": "age_001",
                        "name": "Adult Age Range",
                        "class_name": "AgePhenotype",
                        "type": "inclusion",
                        "description": "Include adults aged 18-65",
                        "domain": "person",
                        "value_filter": {
                            "class_name": "ValueFilter",
                            "min_value": {
                                "class_name": "GreaterThanOrEqualTo",
                                "value": 18,
                            },
                            "max_value": {
                                "class_name": "LessThanOrEqualTo",
                                "value": 65,
                            },
                        },
                    },
                    # Diabetes phenotype with new time filter
                    {
                        "id": "diabetes_001",
                        "name": "*",  # Name may be updated
                        "class_name": "CodelistPhenotype",
                        "type": "inclusion",
                        "description": "*",  # Description may be updated
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "codelist": {"ICD10": ["E11", "E11.0", "E11.1"]},
                            "class_name": "Codelist",
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                        "relative_time_range": [
                            {
                                "class_name": "RelativeTimeRangeFilter",
                                "when": "before",
                                "min_days": {
                                    "class_name": "*",  # Could be GreaterThanOrEqualTo or GreaterThan
                                    "value": "*",  # Should be 0 or None
                                    "operator": "*",
                                },
                                "max_days": {
                                    "class_name": "*",  # Could be LessThan or LessThanOrEqual
                                    "value": "365",  # Should be ~365
                                    "operator": "*",
                                },
                            }
                        ],
                    },
                    # HbA1c unchanged
                    {
                        "id": "hba1c_001",
                        "name": "HbA1c Measurement",
                        "class_name": "MeasurementPhenotype",
                        "type": "characteristics",
                        "description": "Hemoglobin A1c lab results",
                        "domain": "measurement",
                        "codelist": {
                            "codelist": {"LOINC": ["4548-4"]},
                            "class_name": "Codelist",
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                        "value_filter": {
                            "class_name": "ValueFilter",
                            "min_value": {
                                "class_name": "GreaterThan",
                                "value": 6.5,
                                "operator": ">",
                            },
                        },
                    },
                ],
            },
        ),
        # SCENARIO 6: Create Multiple Phenotypes at Once
        TestScenario(
            name="Add Two Exclusion Criteria Together",
            initial_cohort=create_base_cohort(),
            user_request="Add two new exclusion criteria: 1) Pregnancy using ICD-10 codes Z33, Z34, and O00-O99, and 2) Cancer history using ICD-10 codes C00-C97. Name them 'Pregnancy Exclusion' and 'Cancer History Exclusion' respectively. Both should be CodelistPhenotype.",
            expected_description="Should create two new CodelistPhenotype exclusion criteria for pregnancy and cancer",
            expected_tool_calls=[
                "add_phenotype",  # First phenotype
                "add_phenotype",  # Second phenotype
            ],
            unexpected_tool_calls=["delete_phenotype", "update_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # All existing phenotypes unchanged
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # First new phenotype - Pregnancy
                    {
                        "id": "*",
                        "name": "*",
                        "class_name": "CodelistPhenotype",
                        "type": "exclusion",
                        "description": "*",
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "codelist": {
                                "ICD10": "*"
                            },  # Should contain Z33, Z34, O00-O99 but format may vary
                            "class_name": "Codelist",
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                    },
                    # Second new phenotype - Cancer
                    {
                        "id": "*",
                        "name": "*",
                        "class_name": "CodelistPhenotype",
                        "type": "exclusion",
                        "description": "*",
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "codelist": {
                                "ICD10": "*"
                            },  # Should contain C00-C97 but format may vary
                            "class_name": "Codelist",
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                    },
                ],
            },
        ),
        # SCENARIO 7: Continuous Coverage Requirement (TimeRangePhenotype)
        TestScenario(
            name="Add 180 Days Pre-Index Coverage",
            initial_cohort=create_base_cohort(),
            user_request="Add a requirement for continuous health insurance coverage of at least 180 days before the diabetes diagnosis. Call it 'Pre-Index Coverage'.",
            expected_description="Should create a TimeRangePhenotype that checks for 180 days of continuous coverage before index",
            expected_tool_calls=[
                "add_phenotype",  # Create TimeRangePhenotype
            ],
            unexpected_tool_calls=["delete_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # All existing phenotypes unchanged
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # New TimeRangePhenotype
                    {
                        "id": "*",
                        "name": "*",
                        "class_name": "TimeRangePhenotype",
                        "type": "inclusion",
                        "description": "*",
                        "domain": "*",  # Could be OBSERVATION_PERIOD or similar
                        "relative_time_range": {
                            "class_name": "RelativeTimeRangeFilter",
                            "when": "before",
                            "min_days": {
                                "class_name": "*",
                                "value": "*",  # Should be around 0 or minimal
                                "operator": "*",
                            },
                            "max_days": {
                                "class_name": "*",
                                "value": "180",  # Should be around 180 or greater
                                "operator": "*",
                            },
                        },
                    },
                ],
            },
        ),
        # SCENARIO 8: Death as Outcome (DeathPhenotype)
        TestScenario(
            name="Add Death Outcome",
            initial_cohort=create_base_cohort(),
            user_request="Add death as an outcome. We want to track mortality within 1 year after index. Call it 'One Year Mortality'.",
            expected_description="Should create a DeathPhenotype with relative time range after index date (NO anchor_phenotype_id needed)",
            expected_tool_calls=[
                "add_phenotype",  # Create DeathPhenotype
            ],
            unexpected_tool_calls=["delete_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # All existing phenotypes unchanged
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # New DeathPhenotype
                    {
                        "id": "*",
                        "name": "*",
                        "class_name": "DeathPhenotype",
                        "type": "outcome",
                        "description": "*",
                        "domain": "*",  # Typically PERSON or DEATH
                        "relative_time_range": [
                            {
                                "class_name": "RelativeTimeRangeFilter",
                                "when": "after",
                                "min_days": "*",
                                "max_days": {
                                    "class_name": "*",
                                    "operator": "*",
                                    "value": "365",  # Should be ~365 for 1 year
                                },
                                "anchor_phenotype": None,  # Must be None (defaults to index date)
                            }
                        ],
                    },
                ],
            },
        ),
        # SCENARIO 9: Multiple Events within Time Window (EventCountPhenotype)
        TestScenario(
            name="Add Recurrent Atrial Fibrillation",
            initial_cohort=create_base_cohort(),
            user_request="Define the index date as the first occurrence of two AF diagnoses (ICD-10 codes I48, I48.0, I48.1, I48.2) within 90 days of each other, using the second date as the index date. Call it 'Recurrent AF'.",
            expected_description="Should create an EventCountPhenotype that requires at least 2 AF events within 90 days",
            expected_tool_calls=[
                "add_phenotype",  # Could be EventCountPhenotype or create base phenotype first
                "atomic_update_component_date_select",  # Should set which event date to use as index
            ],
            unexpected_tool_calls=["delete_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # All existing phenotypes unchanged
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # New EventCountPhenotype with actual PhenEx structure from to_dict()
                    {
                        "id": "*",
                        "name": "RECURRENT AF",  # PhenEx uppercases the name
                        "class_name": "EventCountPhenotype",
                        "type": "entry",
                        "description": "*",
                        "phenotype": {
                            "class_name": "CodelistPhenotype",
                            "type": "component",  # 🔧 Nested phenotype is marked as component type
                            "name": "*",
                            "description": "*",
                            "domain": "CONDITION_OCCURRENCE",
                            "codelist": {
                                "class_name": "Codelist",
                                "codelist": "*",  # Accept any codelist structure
                                "name": "*",
                                "use_code_type": "*",
                                "remove_punctuation": "*",
                            },
                            "date_range": None,
                            "relative_time_range": None,
                            "return_date": "all",  # Must be "all" for EventCountPhenotype
                            "return_value": None,
                            "categorical_filter": None,
                        },
                        "value_filter": {
                            "class_name": "GreaterThanOrEqualTo",  # Direct comparator, not wrapped in ValueFilter
                            "operator": ">=",
                            "value": 2,
                        },
                        "relative_time_range": {
                            "class_name": "RelativeTimeRangeFilter",  # Single dict, not array
                            "min_days": {
                                "class_name": "GreaterThanOrEqualTo",
                                "operator": ">=",
                                "value": 0,
                            },
                            "max_days": {
                                "class_name": "Value",
                                "operator": "*",
                                "value": 90,
                            },
                            "when": "before",
                            "anchor_phenotype": None,  # Explicitly None
                        },
                        "return_date": "first",
                        "component_date_select": "second",
                    },
                ],
            },
        ),
        # SCENARIO 10: Codelist Lookup by Name (list_codelists tool for file reference)
        TestScenario(
            name="Add Atrial Fibrillation with File Codelist",
            initial_cohort=create_base_cohort(),
            user_request="Add a phenotype for atrial fibrillation diagnosis to the inclusion criteria. Use the 'Atrial Fibrillation' codelist from the uploaded files.",
            expected_description="Should use list_codelists to find AF codelist, then create CodelistPhenotype with file reference",
            expected_tool_calls=[
                "list_codelists",  # Should list available codelists
                "create_phenotype",  # Create phenotype
                "atomic_update_codelist",  # Set codelist reference
            ],
            unexpected_tool_calls=["delete_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # All existing phenotypes unchanged
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # New CodelistPhenotype with file codelist reference (new format)
                    {
                        "id": "*",
                        "name": "*",
                        "class_name": "CodelistPhenotype",
                        "type": "inclusion",
                        "description": "*",
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "class_name": "Codelist",
                            "codelist": {
                                "file_id": "cl_afib_001",  # Known from MOCK_CODELISTS
                                "file_name": "atrial_fibrillation.csv",  # Filename format from mock
                                "codelist_name": "Atrial Fibrillation",  # Exact name from file
                                "code_column": "code",  # Known from mock column_mapping
                                "code_type_column": "code_type",  # Known from mock column_mapping
                                "codelist_column": "codelist",  # Known from mock column_mapping
                            },
                            "codelist_type": "from file",  # Note: space, not underscore
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                        "date_range": None,
                        "relative_time_range": None,
                        "return_date": "*",
                        "return_value": None,
                        "categorical_filter": None,
                    },
                ],
            },
        ),
        # SCENARIO 11: Add Categorical Filter to Existing Phenotype
        TestScenario(
            name="Add Hospital Visit Filter to Diagnosis",
            initial_cohort=create_base_cohort(),
            user_request="For the diabetes phenotype, restrict it to only diagnoses that occurred during inpatient hospitalizations. Use VISIT_CONCEPT_ID values 9201 (Inpatient Visit) and 262 (Emergency Room and Inpatient Visit).",
            expected_description="Should add categorical_filter to existing diabetes phenotype",
            expected_tool_calls=[
                "atomic_update_categorical_filter",
            ],
            unexpected_tool_calls=["delete_phenotype", "add_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # Age phenotype unchanged
                    *[
                        p
                        for p in create_base_cohort()["phenotypes"]
                        if p["id"] == "age_001"
                    ],
                    # Diabetes phenotype with new categorical filter
                    {
                        "id": "diabetes_001",
                        "name": "Type 2 Diabetes Diagnosis",
                        "class_name": "CodelistPhenotype",
                        "type": "inclusion",
                        "description": "ICD-10 codes for Type 2 diabetes mellitus",
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "class_name": "Codelist",
                            "codelist": {"ICD10": ["E11", "E11.0", "E11.1"]},
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                        "date_range": None,
                        "relative_time_range": None,
                        "return_date": "first",
                        "return_value": None,
                        "categorical_filter": {
                            "class_name": "CategoricalFilter",
                            "column_name": "VISIT_CONCEPT_ID",
                            "allowed_values": [9201, 262],
                            "domain": "VISIT_OCCURRENCE",
                            "operator": "isin",
                        },
                    },
                    # HbA1c phenotype unchanged
                    *[
                        p
                        for p in create_base_cohort()["phenotypes"]
                        if p["id"] == "hba1c_001"
                    ],
                ],
            },
        ),
        # SCENARIO 12: Add Time Range Phenotype for Coverage Period
        TestScenario(
            name="Add Continuous Coverage Requirement",
            initial_cohort=create_base_cohort(),
            user_request="Add a requirement for at least 60 days of continuous health plan enrollment before the diabetes diagnosis. Call it 'Pre-Index Coverage Period'.",
            expected_description="Should create TimeRangePhenotype for OBSERVATION_PERIOD domain with 60-day lookback",
            expected_tool_calls=[
                "add_phenotype",
            ],
            unexpected_tool_calls=["delete_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # All existing phenotypes unchanged
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # New TimeRangePhenotype
                    {
                        "id": "*",
                        "name": "*",
                        "class_name": "TimeRangePhenotype",
                        "type": "inclusion",
                        "description": "*",
                        "domain": "OBSERVATION_PERIOD",
                        "relative_time_range": {
                            "class_name": "RelativeTimeRangeFilter",
                            "min_days": {
                                "class_name": "GreaterThanOrEqualTo",
                                "operator": ">=",
                                "value": 60,
                            },
                            "max_days": None,
                            "when": "before",
                            "anchor_phenotype": None,
                        },
                        "allow_null_end_date": "*",
                    },
                ],
            },
        ),
        # SCENARIO 13: Add Multiple Drug Exclusions with Same Time Window
        TestScenario(
            name="Add Multiple Drug Exclusions",
            initial_cohort=create_base_cohort(),
            user_request="Add three exclusion criteria: patients who received Dobutamine, Milrinone, or Epinephrine within 14 days before the diabetes diagnosis should be excluded. Use these as drug exclusions.",
            expected_description="Should create 3 CodelistPhenotype exclusions with 14-day lookback",
            expected_tool_calls=[
                "add_phenotype",  # Multiple calls expected
            ],
            unexpected_tool_calls=["delete_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # All existing phenotypes unchanged
                    *[p for p in create_base_cohort()["phenotypes"]],
                    # Three new drug exclusions (pattern matching)
                    {
                        "id": "*",
                        "name": "*",
                        "class_name": "CodelistPhenotype",
                        "type": "exclusion",
                        "description": "*",
                        "domain": "DRUG_EXPOSURE",
                        "codelist": "*",
                        "date_range": None,
                        "relative_time_range": [
                            {
                                "class_name": "RelativeTimeRangeFilter",
                                "min_days": {
                                    "class_name": "GreaterThanOrEqualTo",
                                    "operator": ">=",
                                    "value": 0,
                                },
                                "max_days": {
                                    "class_name": "LessThanOrEqualTo",
                                    "operator": "<=",
                                    "value": 14,
                                },
                                "when": "before",
                                "anchor_phenotype": None,
                            }
                        ],
                        "return_date": "*",
                        "return_value": None,
                        "categorical_filter": None,
                    },
                ],
            },
        ),
        # SCENARIO 14: Add Date Range Filter to Entry Criterion
        TestScenario(
            name="Add Study Period Date Range",
            initial_cohort=create_base_cohort(),
            user_request="Update the diabetes phenotype to only include diagnoses from January 1, 2015 onward (study period start date).",
            expected_description="Should add date_range filter to diabetes phenotype",
            expected_tool_calls=[
                "atomic_update_date_range",
            ],
            unexpected_tool_calls=["delete_phenotype", "add_phenotype"],
            expected_final_cohort={
                "id": "test_cohort_001",
                "name": "Diabetes Research Cohort",
                "class_name": "Cohort",
                "phenotypes": [
                    # Age phenotype unchanged
                    *[
                        p
                        for p in create_base_cohort()["phenotypes"]
                        if p["id"] == "age_001"
                    ],
                    # Diabetes phenotype with date range
                    {
                        "id": "diabetes_001",
                        "name": "Type 2 Diabetes Diagnosis",
                        "class_name": "CodelistPhenotype",
                        "type": "inclusion",
                        "description": "ICD-10 codes for Type 2 diabetes mellitus",
                        "domain": "CONDITION_OCCURRENCE",
                        "codelist": {
                            "class_name": "Codelist",
                            "codelist": {"ICD10": ["E11", "E11.0", "E11.1"]},
                            "codelist_type": "manual",
                            "use_code_type": True,
                            "remove_punctuation": False,
                        },
                        "date_range": {
                            "class_name": "ValueFilter",
                            "min_value": {
                                "class_name": "AfterOrOn",
                                "operator": ">=",
                                "value": "*",  # Date value
                                "date_format": None,
                            },
                            "max_value": None,
                            "column_name": "EVENT_DATE",
                        },
                        "relative_time_range": None,
                        "return_date": "first",
                        "return_value": None,
                        "categorical_filter": None,
                    },
                    # HbA1c phenotype unchanged
                    *[
                        p
                        for p in create_base_cohort()["phenotypes"]
                        if p["id"] == "hba1c_001"
                    ],
                ],
            },
        ),
    ]

    return scenarios


async def run_test_scenario(scenario: TestScenario, scenario_num: int):
    """Run a single test scenario with detailed logging."""

    scenario_label = f"[Scenario {scenario_num}: {scenario.name}]"

    print_section_header(f"TEST SCENARIO {scenario_num}: {scenario.name}", level=1)

    # 1. Show initial state
    print_section_header(f"1. INITIAL COHORT STATE {scenario_label}", level=2)
    print(f"Cohort ID: {scenario.initial_cohort['id']}")
    print(f"Cohort Name: {scenario.initial_cohort['name']}")
    print_phenotypes(
        scenario.initial_cohort.get("phenotypes", []), "Initial Phenotypes"
    )

    # 2. Show user request
    print_section_header(f"2. USER REQUEST {scenario_label}", level=2)
    print(f"Request: {scenario.user_request}")
    print(f"\nExpected Outcome: {scenario.expected_description}")

    # 3. Create context and run AI
    context = CohortContext(
        user_id="test_user",
        cohort_id=scenario.initial_cohort["id"],
        study_id="test_study",
        current_cohort=deepcopy(scenario.initial_cohort),
        db_manager=enhanced_db_manager,
    )

    print_section_header(f"3. AI EXECUTION {scenario_label}", level=2)
    print("Running AI agent...")

    # Clear previous operations
    enhanced_db_manager.operations.clear()
    if hasattr(enhanced_db_manager, "function_calls"):
        enhanced_db_manager.function_calls.clear()

    ai_actions = []
    ai_error = None

    try:
        # Format cohort state like the real endpoint does
        cohort = context.current_cohort
        cohort_id = cohort.get("id", "Unknown")
        cohort_name = cohort.get("name", "Unknown")
        phenotypes = cohort.get("phenotypes", [])

        initial_state = f"""📊 CURRENT COHORT STATE:
ID: {cohort_id}
Name: {cohort_name}
Total Phenotypes: {len(phenotypes)}

📋 PHENOTYPE LIST:
"""

        if not phenotypes:
            initial_state += "   (No phenotypes in cohort)\n"
        else:
            for i, p in enumerate(phenotypes, 1):
                phenotype_id = p.get("id", "Unknown")
                name = p.get("name", "Unnamed")
                ptype = p.get("type", "Unknown")
                class_name = p.get("class_name", "Unknown")
                description = p.get("description", "No description")

                initial_state += f"""   {i}. ID: {phenotype_id}
      Name: {name}
      Type: {ptype}
      Class: {class_name}
      Description: {description}
      
"""

        initial_state += f"\n🔍 Use this information to understand the current state before making changes."

        # Extract phenotype IDs for explicit instruction like the real endpoint
        current_phenotypes = context.current_cohort.get("phenotypes", [])
        phenotype_id_list = [
            f"'{p.get('id')}' ({p.get('name')})" for p in current_phenotypes
        ]

        # Format the user message with context like the real endpoint does
        formatted_user_message = f"""
🔍 **CURRENT COHORT STATE:**
{initial_state}

🚨🚨🚨 **MANDATORY: THESE ARE THE ONLY VALID PHENOTYPE IDs - DO NOT MODIFY OR GUESS ALTERNATIVES!** 🚨🚨🚨
{', '.join(phenotype_id_list) if phenotype_id_list else 'No phenotypes in cohort'}

🚨🚨🚨 **WARNING: IF YOU USE ANY ID NOT LISTED ABOVE, THE OPERATION WILL FAIL!** 🚨🚨🚨

User request: {scenario.user_request}

🚨 **CRITICAL RULES:**
- ONLY use the exact phenotype IDs listed above
- DO NOT modify, abbreviate, or create variations of the IDs
- DO NOT guess phenotype IDs based on names or descriptions
- COPY the exact ID string from the list above
- If you need to delete "HbA1c measurement", use the exact ID from the list above

Please modify this cohort according to the user's instructions. Use the available tools to add, update, or delete phenotypes as needed.
"""
        # Run the AI with the properly formatted message
        result = await agent.run(formatted_user_message, deps=context)

        print(f"\n✅ AI Response: {result.output}")

        # Extract tool calls
        if hasattr(result, "all_messages"):
            for msg in result.all_messages():
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tool_call in msg.tool_calls:
                        # Extract args safely - could be dict, string, or None
                        args = {}
                        if hasattr(tool_call, "args"):
                            if isinstance(tool_call.args, dict):
                                args = tool_call.args
                            elif isinstance(tool_call.args, str):
                                # Try to parse JSON string
                                try:
                                    args = json.loads(tool_call.args)
                                except (json.JSONDecodeError, ValueError):
                                    args = {"raw_args": tool_call.args}
                            elif tool_call.args is not None:
                                args = {"raw_args": str(tool_call.args)}

                        action = {"tool": tool_call.tool_name, "args": args}
                        ai_actions.append(action)

        # Don't print tool calls here - they'll be shown in section 4

    except Exception as e:
        ai_error = str(e)
        print(f"\n❌ AI Error: {ai_error}")
        print(f"\n🔧 Connection Diagnostics:")
        print(
            f"   • Azure OpenAI Endpoint: {os.getenv('AZURE_OPENAI_ENDPOINT', 'NOT SET')}"
        )
        print(
            f"   • API Key configured: {'Yes' if os.getenv('AZURE_OPENAI_API_KEY') else 'No'}"
        )
        print(f"   • HTTP Proxy: {os.getenv('http_proxy', 'Not set')}")
        print(f"   • HTTPS Proxy: {os.getenv('https_proxy', 'Not set')}")

        # Show more details about the error
        if "Connection error" in str(e):
            print(f"   • This appears to be a network connectivity issue")
            print(f"   • Check proxy settings and network connectivity")
        elif "API key" in str(e).lower():
            print(f"   • This appears to be an API key issue")
        elif "quota" in str(e).lower() or "rate" in str(e).lower():
            print(f"   • This appears to be a quota or rate limiting issue")

    # 4. AI Tool Call Summary
    print_section_header(f"4. AI TOOL CALL SUMMARY {scenario_label}", level=2)

    if ai_actions:
        print(f"Total tool calls made: {len(ai_actions)}")
        print(f"\nDetailed tool call breakdown:")
        for i, action in enumerate(ai_actions, 1):
            print(f"  {i}. {action['tool']}")
            args = action.get("args", {})

            # Show all arguments in a structured way
            if args:
                print(f"     Parameters:")
                for key, value in args.items():
                    # Format value for readability
                    if isinstance(value, dict):
                        # For nested objects, show compact JSON
                        value_str = json.dumps(value, indent=10)
                        print(f"       {key}:")
                        for line in value_str.split("\n"):
                            print(f"         {line}")
                    elif isinstance(value, str) and len(value) > 60:
                        # Truncate long strings
                        print(f"       {key}: '{value[:60]}...'")
                    else:
                        print(f"       {key}: {repr(value)}")

            print()

        # Count tool types
        tool_counts = {}
        for action in ai_actions:
            tool_name = action["tool"]
            tool_counts[tool_name] = tool_counts.get(tool_name, 0) + 1

        print(f"Tool usage summary:")
        for tool_name, count in tool_counts.items():
            print(f"  • {tool_name}: {count} calls")

    else:
        print("No tool calls were made - AI provided text-only guidance")

    if ai_error:
        print(f"\n❌ AI encountered an error: {ai_error}")

    # 5. Show final state and comparison
    print_section_header(f"5. FINAL COHORT STATE {scenario_label}", level=2)

    final_cohort = context.current_cohort
    print(f"Cohort ID: {final_cohort['id']}")
    print(f"Cohort Name: {final_cohort['name']}")
    print_phenotypes(final_cohort.get("phenotypes", []), "Final Phenotypes")

    # Show RAW JSON structure for verification
    print("\n" + "=" * 60)
    print("RAW FINAL COHORT JSON STRUCTURE:")
    print("=" * 60)
    print(json.dumps(final_cohort, indent=2))
    print("=" * 60)

    # 6. Compare and analyze
    compare_cohorts(scenario.initial_cohort, final_cohort)

    # 6.5. Automated validation against expected outcomes
    validation_results = automated_validation(
        scenario, scenario.initial_cohort, final_cohort, ai_actions
    )

    # 6. Final automated assessment
    print_section_header(f"6. AUTOMATED ASSESSMENT {scenario_label}", level=2)

    # Calculate phenotype count change
    initial_count = len(scenario.initial_cohort.get("phenotypes", []))
    final_count = len(final_cohort.get("phenotypes", []))
    count_change = final_count - initial_count

    # Determine if tool calls were appropriate for this scenario
    expected_tool_calls = scenario.expected_tool_calls or []
    expects_no_calls = len(expected_tool_calls) == 0

    # Success criteria depends on whether we expect tool calls or not
    if expects_no_calls:
        # For information-only scenarios, success = no error, no tool calls, validation passed
        overall_success = (
            not ai_error and len(ai_actions) == 0 and validation_results["overall_pass"]
        )
    else:
        # For action scenarios, success = no error, some tool calls, validation passed
        overall_success = (
            not ai_error and len(ai_actions) > 0 and validation_results["overall_pass"]
        )

    if overall_success:
        print(f"🎉 SCENARIO PASSED AUTOMATED VALIDATION!")
        print(f"   ✅ AI responded successfully")
        if expects_no_calls:
            print(f"   ✅ AI correctly made no tool calls (information-only request)")
        else:
            print(f"   ✅ AI took appropriate actions ({len(ai_actions)} tool calls)")
        print(
            f"   ✅ Expected outcomes achieved ({validation_results['score_percentage']:.1f}% score)"
        )
        print(
            f"   ℹ️  Phenotype count change: {count_change:+d} (from {initial_count} to {final_count})"
        )
    else:
        print(f"❌ SCENARIO FAILED AUTOMATED VALIDATION")
        if ai_error:
            print(f"   ❌ AI encountered error: {ai_error}")
        elif expects_no_calls and len(ai_actions) > 0:
            print(
                f"   ❌ AI made tool calls ({len(ai_actions)}) but should have made none (information-only request)"
            )
        elif not expects_no_calls and len(ai_actions) == 0:
            print(f"   ❌ AI made no tool calls but should have taken action")
        elif not validation_results["overall_pass"]:
            print(
                f"   ❌ Expected outcomes not achieved ({validation_results['score_percentage']:.1f}% score)"
            )
        print(
            f"   ℹ️  Phenotype count change: {count_change:+d} (from {initial_count} to {final_count})"
        )

    # Return summary for overall results
    return {
        "scenario_num": scenario_num,
        "scenario": scenario.name,
        "ai_responded": not ai_error,
        "tools_called": len(ai_actions),
        "phenotype_change": count_change,
        "error": ai_error,
        "validation_results": validation_results,
        "automated_pass": overall_success,
    }


async def run_manual_test_suite(selected_scenarios=None):
    """Run the complete manual test suite.

    Args:
        selected_scenarios: Optional list of scenario numbers to run (e.g., [1, 3, 5])
    """

    print_section_header("STARTING MANUAL AI AGENT TEST SUITE")

    all_scenarios = define_test_scenarios()

    # Filter scenarios if specific ones are selected
    if selected_scenarios:
        scenarios = [
            (i, all_scenarios[i - 1])
            for i in selected_scenarios
            if 1 <= i <= len(all_scenarios)
        ]
        if len(scenarios) != len(selected_scenarios):
            print(
                f"⚠️  Warning: Some scenario numbers were out of range (1-{len(all_scenarios)})"
            )
        print(
            f"🎯 Running {len(scenarios)} selected scenario(s) out of {len(all_scenarios)} total"
        )
    else:
        scenarios = [(i + 1, s) for i, s in enumerate(all_scenarios)]

    results = []

    # Simple loop: ask before each scenario
    for i, scenario in scenarios:
        print(f"\n{'='*80}")
        print(f"  Scenario {i}: {scenario.name}")
        print(f"  Request: {scenario.user_request}")
        print(f"  Press Enter to run, or 's' to skip")
        print(f"{'='*80}")
        user_input = input().strip().lower()

        if user_input == "s":
            print(f"⏭️  Skipped Scenario {i}")
            continue

        # Run the scenario
        result = await run_test_scenario(scenario, i)
        results.append(result)

    # Final summary
    print_section_header("TEST SUITE SUMMARY")

    for result in results:
        scenario_num = result.get("scenario_num", "?")
        automated_pass = result.get("automated_pass", False)
        validation_score = result.get("validation_results", {}).get(
            "score_percentage", 0
        )

        if automated_pass:
            status_icon = "🎉"
            status_text = "AUTOMATED PASS"
        elif result["ai_responded"] and result["tools_called"] > 0:
            status_icon = "⚠️"
            status_text = "PARTIAL SUCCESS"
        elif result["ai_responded"]:
            status_icon = "🔕"
            status_text = "NO ACTIONS"
        else:
            status_icon = "❌"
            status_text = "ERROR"

        print(f"{status_icon} Scenario {scenario_num}: {result['scenario']}")
        print(f"   Status: {status_text}")
        print(f"   Response: {'Yes' if result['ai_responded'] else 'Error'}")
        print(f"   Tools Called: {result['tools_called']}")
        print(f"   Phenotype Change: {result['phenotype_change']:+d}")
        print(f"   Validation Score: {validation_score:.1f}%")

        if result["error"]:
            print(f"   Error: {result['error'][:60]}...")
        elif not automated_pass and result["ai_responded"]:
            validation_results = result.get("validation_results", {})
            if validation_results.get("errors"):
                print(f"   Failed Checks: {len(validation_results['errors'])}")
        print()

    # Calculate overall statistics
    executed = len([r for r in results if r["ai_responded"] and r["tools_called"] > 0])
    automated_passed = len([r for r in results if r.get("automated_pass", False)])
    total_scenarios = len(results)

    print(f"📊 OVERALL RESULTS:")
    print(f"   Total Scenarios: {total_scenarios}")
    print(
        f"   Successfully Executed: {executed}/{total_scenarios} ({(executed/total_scenarios)*100:.1f}%)"
    )
    print(
        f"   Automated Validation Passed: {automated_passed}/{total_scenarios} ({(automated_passed/total_scenarios)*100:.1f}%)"
    )

    if automated_passed == total_scenarios:
        print(f"\n🏆 EXCELLENT: All scenarios passed automated validation!")
        print(f"🚀 The AI agent is working correctly for all test cases")
    elif automated_passed >= total_scenarios * 0.8:
        print(f"\n✅ GOOD: Most scenarios passed automated validation")
        print(f"� Review failed scenarios for potential improvements")
    elif executed == total_scenarios:
        print(f"\n⚠️  NEEDS WORK: All scenarios executed but validation failed")
        print(f"🐛 Check AI behavior against expected outcomes")
    else:
        print(f"\n❌ CRITICAL: Some scenarios failed to execute")
        print(f"🚨 Check AI agent configuration and connectivity")

    return results


def generate_automated_report(results, output_file="ai_validation_report.json"):
    """Generate a detailed JSON report for automated CI/CD validation."""

    import time

    report = {
        "timestamp": time.time(),
        "total_scenarios": len(results),
        "summary": {
            "executed": len(
                [r for r in results if r["ai_responded"] and r["tools_called"] > 0]
            ),
            "automated_passed": len(
                [r for r in results if r.get("automated_pass", False)]
            ),
            "execution_rate": 0,
            "pass_rate": 0,
        },
        "scenarios": [],
    }

    # Calculate rates
    if report["total_scenarios"] > 0:
        report["summary"]["execution_rate"] = (
            report["summary"]["executed"] / report["total_scenarios"]
        ) * 100
        report["summary"]["pass_rate"] = (
            report["summary"]["automated_passed"] / report["total_scenarios"]
        ) * 100

    # Add detailed scenario results
    for i, result in enumerate(results, 1):
        scenario_report = {
            "scenario_number": i,
            "name": result["scenario"],
            "status": "pass" if result.get("automated_pass", False) else "fail",
            "ai_responded": result["ai_responded"],
            "tools_called": result["tools_called"],
            "phenotype_change": result["phenotype_change"],
            "error": result.get("error"),
            "validation": result.get("validation_results", {}),
        }
        report["scenarios"].append(scenario_report)

    # Save to file
    report_path = Path.cwd() / output_file
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)

    print(f"📄 Automated validation report saved to: {report_path}")

    # Return pass/fail for CI/CD
    all_passed = report["summary"]["automated_passed"] == report["total_scenarios"]
    return all_passed, report


async def run_automated_test_suite(selected_scenarios=None):
    """Run test suite in automated mode (no user interaction, for CI/CD).

    Args:
        selected_scenarios: Optional list of scenario numbers to run (e.g., [1, 3, 5])
    """

    print_section_header("AUTOMATED AI AGENT TEST SUITE")

    all_scenarios = define_test_scenarios()

    # Filter scenarios if specific ones are selected
    if selected_scenarios:
        scenarios = [
            (i, all_scenarios[i - 1])
            for i in selected_scenarios
            if 1 <= i <= len(all_scenarios)
        ]
        if len(scenarios) != len(selected_scenarios):
            print(
                f"⚠️  Warning: Some scenario numbers were out of range (1-{len(all_scenarios)})"
            )
        print(
            f"🎯 Running {len(scenarios)} selected scenario(s) out of {len(all_scenarios)} total"
        )
    else:
        scenarios = [(i + 1, s) for i, s in enumerate(all_scenarios)]

    results = []

    print(f"🤖 Running {len(scenarios)} scenarios in automated mode...")
    print(f"⚡ No user interaction - full automation for CI/CD")

    for i, scenario in scenarios:
        print(f"\n🔄 Running Scenario {i}/{len(scenarios)}: {scenario.name}")
        result = await run_test_scenario(scenario, i)
        results.append(result)

        # Show quick status
        if result.get("automated_pass"):
            print(f"   ✅ PASSED")
        else:
            print(f"   ❌ FAILED")

    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="AI Agent Test Suite")
    parser.add_argument(
        "--automated",
        action="store_true",
        help="Run in automated mode (no user interaction, for CI/CD)",
    )
    parser.add_argument(
        "--scenarios",
        type=str,
        help='Comma-separated list of scenario numbers to run (e.g., "1,3,5" or "9")',
    )
    parser.add_argument(
        "--list", action="store_true", help="List all available scenarios and exit"
    )
    args = parser.parse_args()

    # Handle --list flag
    if args.list:
        scenarios = define_test_scenarios()
        print_section_header("AVAILABLE TEST SCENARIOS")
        for i, scenario in enumerate(scenarios, 1):
            print(f"\n{i}. {scenario.name}")
            print(f"   Description: {scenario.expected_description}")
            print(f"   User Request: {scenario.user_request}")
        print(f"\n\nTotal: {len(scenarios)} scenarios")
        print(f"\nUsage: python manual_ai_test_suite.py --scenarios 1,3,5")
        sys.exit(0)

    # Parse scenario selection
    selected_scenarios = None
    if args.scenarios:
        try:
            selected_scenarios = [int(s.strip()) for s in args.scenarios.split(",")]
            print(f"🎯 Running selected scenarios: {selected_scenarios}")
        except ValueError:
            print(f"❌ Invalid scenario numbers: {args.scenarios}")
            print(f"   Use comma-separated integers (e.g., '1,3,5' or '9')")
            sys.exit(1)

    try:
        if args.automated:
            results = asyncio.run(
                run_automated_test_suite(selected_scenarios=selected_scenarios)
            )
        else:
            results = asyncio.run(
                run_manual_test_suite(selected_scenarios=selected_scenarios)
            )
        print(f"\n✅ Test suite completed!")

        # Generate automated report
        all_passed, report = generate_automated_report(results)

        if all_passed:
            print(f"🏆 ALL SCENARIOS PASSED AUTOMATED VALIDATION!")
            print(f"🚀 AI agent is working correctly - ready for production")
            sys.exit(0)
        else:
            passed_count = report["summary"]["automated_passed"]
            total_count = report["total_scenarios"]
            print(
                f"⚠️  {passed_count}/{total_count} scenarios passed automated validation"
            )
            print(f"🔍 Review failed scenarios in the detailed report")
            print(f"🔧 AI agent needs improvement before production use")
            sys.exit(1)

    except KeyboardInterrupt:
        print(f"\n⏹️  Test suite interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        sys.exit(1)
