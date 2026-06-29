"""
PhenEx Cohort Builder MCP Server

FastMCP server that provides tools for:
- PhenEx cohort building: defining phenotypes, validating and executing cohorts
- Snowflake data warehouse exploration: browsing databases, schemas, tables, and data
"""

import os
import sys
import logging
from pathlib import Path

# Ensure sibling modules (phenotype_registry, cohort_tools, etc.) are importable
# regardless of the working directory the process is started from.
_mcp_dir = str(Path(__file__).resolve().parent)
if _mcp_dir not in sys.path:
    sys.path.insert(0, _mcp_dir)

from typing import Dict, List, Optional, Any
from dotenv import load_dotenv
from fastmcp import FastMCP

# Configure logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("phenex-mcp")
logger.setLevel(getattr(logging, log_level, logging.INFO))

from phenotype_registry import (
    get_available_classes,
    get_spec,
)
import snowflake_explorer as sf_explorer
from cohort_tools import validate_phenotype, validate_cohort, execute_cohort
from code_generator import generate_python
import codelist_store

# Load environment variables from .env file in this directory
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

# Initialize FastMCP server
mcp = FastMCP("PhenEx Cohort Builder")


# ============================================================
# CONFIGURATION
# ============================================================

# Environment variables to expose in get_config, grouped by purpose.
# Values marked as secret are masked in the output.
_CONFIG_KEYS = [
    # (env_var, display_name, secret)
    ("SNOWFLAKE_USER", "Snowflake user", False),
    ("SNOWFLAKE_ACCOUNT", "Snowflake account", False),
    ("SNOWFLAKE_WAREHOUSE", "Snowflake warehouse", False),
    ("SNOWFLAKE_ROLE", "Snowflake role", False),
    ("SNOWFLAKE_PASSWORD", "Snowflake password", True),
    ("SNOWFLAKE_SOURCE_DATABASE", "Source database", False),
    ("SNOWFLAKE_SOURCE_SCHEMA", "Source schema", False),
    ("SNOWFLAKE_DEST_DATABASE", "Destination database", False),
    ("PHENEX_CODELIST_DIR", "Codelist directory", False),
    ("PHENEX_CODELIST_CODE_COLUMN", "Codelist code column", False),
    ("PHENEX_CODELIST_NAME_COLUMN", "Codelist name column", False),
    ("PHENEX_CODELIST_CODE_TYPE_COLUMN", "Codelist code type column", False),
    ("MCP_TRANSPORT", "MCP transport", False),
    ("MCP_HOST", "MCP host", False),
    ("MCP_PORT", "MCP port", False),
    ("LOG_LEVEL", "Log level", False),
]


@mcp.tool()
def phenex_get_config() -> Dict[str, Any]:
    """
    Return the current server configuration (environment variables).

    Sensitive values (passwords, tokens) are masked. Use this to verify
    which Snowflake account, database, schema, and codelist directory are
    configured before running queries or executing cohorts.

    Returns:
        Dictionary with:
        - config (dict): Key-value pairs of all configured settings
        - missing (list): Environment variables that are not set
    """
    config = {}
    missing = []
    for env_var, display_name, secret in _CONFIG_KEYS:
        value = os.getenv(env_var)
        if value is None:
            missing.append(env_var)
        elif secret:
            config[env_var] = "****"
        else:
            config[env_var] = value
    return {"config": config, "missing": missing}


# ============================================================
# PHENEX CLASS DISCOVERY TOOLS
# ============================================================


@mcp.tool()
def phenex_get_mappers() -> Dict[str, Any]:
    """
    Discover all available data-source mappers and their domain configurations.

    Mappers convert from a source data format (e.g. OMOP CDM) to PhenEx's
    internal column model.  The AI workflow is:

    1. Call this tool to see which mapper families are available.
    2. Pick the mapper that matches the target database's format.
    3. For each phenotype, pick the right **domain** within that mapper
       (e.g. CONDITION_OCCURRENCE_SOURCE for ICD source codes).
    4. Check has_code_type — if False, set use_code_type=False on the codelist.

    Returns:
        Dictionary with:
        - mappers (dict): Each key is a mapper family name, value has:
            * domains (dict): domain_name → {source_table, column_mapping,
              table_type, has_code_type, note?}
    """
    try:
        import inspect
        import phenex.mappers as mappers_module
        from phenex.mappers import DomainsDictionary

        # Discover all module-level DomainsDictionary instances
        result = {}
        for attr_name in dir(mappers_module):
            obj = getattr(mappers_module, attr_name)
            if not isinstance(obj, DomainsDictionary):
                continue

            # Derive a friendly mapper family name from the variable name
            # e.g. "OMOPDomains" → "OMOP"
            family = attr_name.replace("Domains", "").replace("domains", "")
            if not family:
                family = attr_name

            domains = {}
            for domain_name, mapper_cls in obj.domains_dict.items():
                info = {
                    "source_table": mapper_cls.NAME_TABLE,
                    "column_mapping": dict(mapper_cls.DEFAULT_MAPPING),
                    "table_type": (
                        mapper_cls.__bases__[0].__name__
                        if mapper_cls.__bases__
                        else mapper_cls.__name__
                    ),
                }
                if (
                    "CODE" in mapper_cls.DEFAULT_MAPPING
                    and "CODE_TYPE" not in mapper_cls.DEFAULT_MAPPING
                ):
                    info["has_code_type"] = False
                    info["note"] = (
                        "No CODE_TYPE column — use use_code_type=False in your codelist"
                    )
                elif "CODE_TYPE" in mapper_cls.DEFAULT_MAPPING:
                    info["has_code_type"] = True
                domains[domain_name] = info

            result[family] = {"variable": attr_name, "domains": domains}

        if not result:
            return {
                "success": False,
                "error": "No DomainsDictionary instances found in phenex.mappers",
            }

        return {"success": True, "mappers": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@mcp.tool()
def phenex_list_classes(category: str = "") -> Dict[str, Any]:
    """
    List all available PhenEx classes grouped by category: phenotypes, filters, reporters, and other.

    PhenEx (Phenotype Extractor) provides pre-built classes for clinical data extraction.
    Use this tool first to discover what building blocks are available for cohort building.

    Args:
        category: Optional category to filter by. One of: "phenotypes", "filters",
                  "reporters", "other". If empty, returns all categories.

    Returns:
        Dictionary containing:
        - phenotypes (list): Phenotype classes for identifying patient characteristics and events
        - filters (list): Filter and value classes for restricting events within phenotypes
        - reporters (list): Reporter classes for generating analysis outputs (Table1, Waterfall, etc.)
        - other (list): Other useful classes (Cohort, Subcohort, Study)
        Each entry has:
            * name (str): Class name (e.g., "CodelistPhenotype", "RelativeTimeRangeFilter")
            * description (str): What the class does and when to use it

    After reviewing available classes, use phenex_inspect_class() to get detailed
    parameters and usage examples for a specific class.
    """
    try:
        result = get_available_classes(category=category)
        if "error" in result:
            return {"success": False, **result}
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@mcp.tool()
def phenex_inspect_class(class_name: str) -> Dict[str, Any]:
    """
    Get detailed specification and usage examples for a PhenEx class.

    Use this after phenex_list_classes() to drill into a specific class and see
    its constructor parameters, types, defaults, and code examples.

    Args:
        class_name: Name of the class to inspect.
                    Must exactly match a name from phenex_list_classes().
                    Examples: "CodelistPhenotype", "RelativeTimeRangeFilter",
                              "ValueFilter", "Codelist", "AgePhenotype",
                              "GreaterThan", "After"

    Returns:
        Dictionary containing:
        - success (bool): Whether the spec was retrieved successfully
        - name (str): Class name
        - description (str): Brief description
        - parameters (dict): All constructor parameters with types, required flags, defaults
        - example (str): Example usage code
    """
    try:
        spec = get_spec(class_name)
        if "error" in spec:
            return {"success": False, **spec}
        return {"success": True, **spec}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# PHENEX CODELIST TOOLS
# ============================================================


@mcp.tool()
def phenex_find_codelists(
    name_pattern: Optional[str] = None,
    code_type_pattern: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Search for codelists available in the configured codelist directory.

    Without any filters, returns the first 25 codelists. Use regex patterns
    to narrow results by codelist name and/or code vocabulary type.

    Scans CSV/Excel files in the directory specified by PHENEX_CODELIST_DIR.

    Args:
        name_pattern: Optional regex pattern to filter codelist names
                     (case-insensitive). Examples: "diabetes", "^af_", "hba1c|glucose"
        code_type_pattern: Optional regex pattern to filter by code vocabulary type
                          (case-insensitive). Examples: "ICD10", "CPT|HCPCS", "RxNorm"

    Returns:
        Dictionary containing:
        - success (bool): Whether the operation succeeded
        - codelists (list): Array of codelist summaries, each with:
            * name (str): Codelist name
            * code_types (list): Vocabularies present (e.g. ["ICD10CM", "ICD9CM"])
            * total_codes (int): Total number of codes
            * sample_codes (list): Up to 10 sample codes with code_type
        - count (int): Total number of matching codelists
        - returned (int): Number of codelists returned (may be less than count)
        - truncated (bool): Whether results were truncated (max 25)
        - error (str): Error message if operation failed
    """
    try:
        result = codelist_store.find_codelists(
            name_pattern=name_pattern,
            code_type_pattern=code_type_pattern,
        )
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "error": str(e), "codelists": [], "count": 0}


@mcp.tool()
def phenex_get_codelist(name: str) -> Dict[str, Any]:
    """
    Get the full contents of a specific codelist by name.

    Args:
        name: Exact codelist name as shown by phenex_find_codelists().

    Returns:
        Dictionary containing:
        - success (bool): Whether the codelist was found
        - name (str): Codelist name
        - code_types (list): Vocabularies present
        - total_codes (int): Total number of codes
        - codelist (dict): Full codelist — keys are code types, values are lists of codes
        - error (str): Error message if codelist not found
        - available_codelists (list): All available names (if not found)
    """
    try:
        result = codelist_store.get_codelist(name)
        if "error" in result:
            return {"success": False, **result}
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# PHENEX CODE GENERATION TOOLS
# ============================================================


@mcp.tool()
def phenex_generate_python(
    definition: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate a runnable Python script from any PhenEx definition dict.

    Accepts any PhenEx expression — a Cohort, a single phenotype, a filter,
    a Codelist, etc. Compiles the dict with from_dict() to verify correctness,
    then emits clean, idiomatic Python code that constructs the same object.

    Use this tool:
    - After building and validating a definition to show the user the
      equivalent Python code for review
    - To produce a .py artifact the user can save and re-run independently
    - To guarantee that the Python shown matches exactly what was validated

    Args:
        definition: Any PhenEx definition dict with a 'class_name' (or 'type')
                    field. Examples:
                    - A full Cohort dict with entry_criterion, inclusions, etc.
                    - A single phenotype: {"type": "CodelistPhenotype", ...}
                    - A filter: {"type": "RelativeTimeRangeFilter", ...}
                    - A codelist: {"class_name": "Codelist", ...}

    Returns:
        Dictionary containing:
        - success (bool): Whether code generation succeeded
        - code (str): The generated Python script with imports and
                      constructor calls. Ready to save as a .py file.
        - error (str): Error message if generation failed. Fix errors with
                      phenex_validate_phenotype / phenex_validate_cohort
                      first, then retry.

    Example — single phenotype:

        Input:
            {"type": "CodelistPhenotype", "name": "diabetes",
             "domain": "CONDITION_OCCURRENCE_SOURCE",
             "codelist": {"ICD10CM": ["E11.0", "E11.9"]},
             "return_date": "first"}

        Output code:
            from phenex.codelists import Codelist
            from phenex.phenotypes import CodelistPhenotype

            diabetes = CodelistPhenotype(
                name='DIABETES',
                domain='CONDITION_OCCURRENCE_SOURCE',
                return_date='first',
                codelist=Codelist(
                    codelist={'ICD10CM': ['E11.0', 'E11.9']},
                    name='diabetes_codes',
                ),
            )

    Example — full cohort:

        Input:
            {"class_name": "Cohort", "name": "afib_cohort",
             "entry_criterion": {"type": "CodelistPhenotype", "name": "af",
                "domain": "CONDITION_OCCURRENCE_SOURCE",
                "codelist": {"ICD10CM": ["I48.0", "I48.1"]},
                "return_date": "first"},
             "characteristics": [
                {"type": "AgePhenotype", "name": "age"},
                {"type": "SexPhenotype", "name": "sex"}]}

        Output code:
            from phenex.codelists import Codelist
            from phenex.core import Cohort
            from phenex.phenotypes import AgePhenotype, CodelistPhenotype, SexPhenotype

            af = CodelistPhenotype(
                name='AF',
                domain='CONDITION_OCCURRENCE_SOURCE',
                return_date='first',
                codelist=Codelist(codelist={'ICD10CM': ['I48.0', 'I48.1']}, ...),
            )

            age = AgePhenotype(name='AGE')
            sex = SexPhenotype(name='SEX')

            afib_cohort = Cohort(
                name='afib_cohort',
                entry_criterion=af,
                characteristics=[age, sex],
            )
    """
    return generate_python(definition)


# ============================================================
# PHENEX COHORT TOOLS
# ============================================================


@mcp.tool()
def phenex_validate_phenotype(
    phenotype_definition: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Validate a single phenotype definition by compiling it.

    Use this to check that an individual phenotype is correctly defined before
    assembling it into a full cohort. The tool translates the simplified format
    to PheNEx native format and attempts to compile it with from_dict().

    Args:
        phenotype_definition: Dictionary defining a single phenotype, e.g.:

            Inline codelist:
            {
                "type": "CodelistPhenotype",
                "name": "atrial_fibrillation",
                "domain": "CONDITION_OCCURRENCE_SOURCE",
                "codelist": {"ICD10CM": ["I48.0", "I48.1", "I48.2", "I48.91"]},
                "use_code_type": false,
                "remove_punctuation": true,
                "return_date": "first"
            }

            Codelist by reference (name from codelist store):
            {
                "type": "CodelistPhenotype",
                "name": "atrial_fibrillation",
                "domain": "CONDITION_OCCURRENCE_SOURCE",
                "codelist": "atrial_fibrillation",
                "return_date": "first"
            }

    Returns:
        Dictionary containing:
        - valid (bool): Whether the phenotype compiles successfully
        - errors (list): Compilation error messages (empty if valid)
        - warnings (list): Non-fatal warnings
        - phenotype_name (str): Name from the definition
        - phenotype_type (str): Class name (e.g., "CodelistPhenotype")
        - compiled_class (str): Actual Python class name after compilation (if valid)
        - message (str): Human-readable summary
    """
    return validate_phenotype(phenotype_definition)


@mcp.tool()
def phenex_validate_cohort(
    cohort_definition: Dict[str, Any],
    cohort_name: str,
) -> Dict[str, Any]:
    """
    Validate a PhenEx cohort definition (as JSON/dict) without executing it.

    Cohorts are defined as structured JSON objects matching the Cohort class
    constructor. This tool validates the structure and attempts to compile
    with from_dict().

    Args:
        cohort_definition: Dictionary defining the cohort structure with:
            - name (str): Cohort name
            - entry_criterion (dict): Phenotype that defines the index date (required)
            - inclusions (list[dict]): Phenotypes that must be True for inclusion
            - exclusions (list[dict]): Phenotypes that must be False (excluded)
            - characteristics (list[dict]): Baseline characteristic phenotypes
            - outcomes (list[dict]): Outcome phenotypes
            - description (str): Optional cohort description
            Each phenotype dict needs at least 'type' and 'name'.
            Codelists can be inline dicts or by-reference strings.
        cohort_name: Name for the cohort (used for schema naming).
                    Must be alphanumeric + underscores, starting with letter.
                    Results will be written to: PHENEX_AI__{cohort_name.upper()}

    Returns:
        Dictionary containing:
        - valid (bool): Whether the cohort definition is valid
        - errors (list): List of validation error messages (empty if valid)
        - warnings (list): Non-fatal warnings
        - cohort_name (str): Validated cohort name
        - target_schema (str): Snowflake schema name (PHENEX_AI__{name})
        - phenotypes_used (list): List of phenotype types in definition
        - phenotype_count (int): Number of phenotypes defined

    Example cohort definition:
        {
            "name": "afib_optum",
            "entry_criterion": {
                "type": "CodelistPhenotype",
                "name": "atrial_fibrillation",
                "domain": "CONDITION_OCCURRENCE_SOURCE",
                "codelist": {"ICD10CM": ["I48.0", "I48.1", "I48.2", "I48.91"]},
                "return_date": "first"
            },
            "inclusions": [
                {"type": "AgePhenotype", "name": "age_18_plus",
                 "min_age": {"type": "GreaterThanOrEqualTo", "value": 18}}
            ],
            "exclusions": [
                {"type": "CodelistPhenotype", "name": "pregnancy",
                 "domain": "CONDITION_OCCURRENCE_SOURCE",
                 "codelist": "pregnancy_codes"}
            ]
        }
    """
    return validate_cohort(cohort_definition, cohort_name)


@mcp.tool()
def phenex_execute_cohort(
    cohort_definition: Dict[str, Any],
    cohort_name: Optional[str] = None,
    validate_only: bool = True,
    SNOWFLAKE_SOURCE_DATABASE: Optional[str] = None,
    SNOWFLAKE_SOURCE_SCHEMA: Optional[str] = None,
    SNOWFLAKE_DEST_DATABASE: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute a cohort definition using PhenEx against Snowflake.

    Compiles a cohort definition (dict) into PhenEx code via from_dict()
    and executes it against Snowflake. Results are written to a namespaced schema
    for safety: PHENEX_AI__{COHORT_NAME}.

    Args:
        cohort_definition: Dict with cohort specification matching the Cohort class:
            - name (str): Cohort name
            - entry_criterion (dict): Phenotype defining the index date
            - inclusions (list[dict]): Inclusion phenotypes
            - exclusions (list[dict]): Exclusion phenotypes
            - characteristics (list[dict]): Baseline characteristics
            - outcomes (list[dict]): Outcome phenotypes
            - description (str): Optional description

        cohort_name: Optional name override. If not provided, will use cohort_definition["name"]

        validate_only: If True (default), only validates the cohort without executing.
                      Set to False to actually execute against Snowflake.

        SNOWFLAKE_SOURCE_DATABASE: Source database name (e.g., "OPTUM_CLAIMS").
            Falls back to SNOWFLAKE_SOURCE_DATABASE env var if not provided.

        SNOWFLAKE_SOURCE_SCHEMA: Source schema name (e.g., "OMOP_CDM").
            Falls back to SNOWFLAKE_SOURCE_SCHEMA env var if not provided.

        SNOWFLAKE_DEST_DATABASE: Destination database name (e.g., "ANALYTICS").
            Falls back to SNOWFLAKE_DEST_DATABASE env var if not provided.

    Returns:
        Dict with execution results including:
        - success, validated, executed booleans
        - cohort_name, source/dest database info
        - validation_errors, validation_warnings
        - patient_count (if executed)
        - tables_created (if executed)
    """
    name = cohort_name or cohort_definition.get("name", "unnamed_cohort")
    return execute_cohort(
        cohort_definition=cohort_definition,
        cohort_name=name,
        validate_only=validate_only,
        SNOWFLAKE_SOURCE_DATABASE=SNOWFLAKE_SOURCE_DATABASE,
        SNOWFLAKE_SOURCE_SCHEMA=SNOWFLAKE_SOURCE_SCHEMA,
        SNOWFLAKE_DEST_DATABASE=SNOWFLAKE_DEST_DATABASE,
    )


# ============================================================
# SNOWFLAKE DATA WAREHOUSE EXPLORATION TOOLS
# ============================================================


@mcp.tool()
def snowflake_list_databases(
    pattern: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    List or search databases in Snowflake.

    Snowflake Hierarchy: Account → Database → Schema → Table

    Args:
        pattern: Optional SQL LIKE pattern to filter database names.
                Use % as wildcard. Examples: '%OMOP%', 'PROD_%'
        limit: Maximum number of databases to return (default 100)

    Returns:
        Dictionary with success, databases list, count, limit.
    """
    try:
        databases = sf_explorer.list_databases(pattern, limit)
        result = {
            "success": True,
            "databases": databases,
            "count": len(databases),
            "limit": limit,
        }
        if pattern:
            result["pattern"] = pattern
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "databases": [],
            "count": 0,
            "limit": limit,
        }


@mcp.tool()
def snowflake_list_schemas(
    database: str,
    pattern: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    List schemas within a database in Snowflake.

    IMPORTANT: Schema names are NOT globally unique — specify which database to look inside.

    Args:
        database: Which database to look inside for schemas (required).
        pattern: Optional SQL LIKE pattern to filter schema names.
        limit: Maximum number of schemas to return (default 100)

    Returns:
        Dictionary with success, schemas list, count, limit.
    """
    try:
        schemas = sf_explorer.list_schemas(database, pattern, limit)
        result = {
            "success": True,
            "schemas": schemas,
            "count": len(schemas),
            "limit": limit,
        }
        if pattern:
            result["pattern"] = pattern
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "schemas": [],
            "count": 0,
            "limit": limit,
        }


@mcp.tool()
def snowflake_list_tables(
    schema: str,
    database: str,
    pattern: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    List tables and views within a schema.

    Args:
        schema: Which schema to look inside for tables (required)
        database: Which database contains this schema (required)
        pattern: Optional SQL LIKE pattern to filter table names.
        limit: Maximum number of tables to return (default 100)

    Returns:
        Dictionary with success, tables list, count, limit, schema.

    Common OMOP CDM tables: PERSON, CONDITION_OCCURRENCE, DRUG_EXPOSURE,
    PROCEDURE_OCCURRENCE, MEASUREMENT, OBSERVATION, VISIT_OCCURRENCE
    """
    try:
        tables = sf_explorer.list_tables(schema, database, pattern, limit)
        result = {
            "success": True,
            "tables": tables,
            "count": len(tables),
            "limit": limit,
            "schema": schema,
        }
        if pattern:
            result["pattern"] = pattern
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "tables": [],
            "count": 0,
            "limit": limit,
            "schema": schema,
        }


@mcp.tool()
def snowflake_get_table_columns(
    table: str,
    schema: str,
    database: str,
) -> Dict[str, Any]:
    """
    Get detailed column information for a table.

    Args:
        table: Table name (required)
        schema: Schema containing the table (required)
        database: Database name (required)

    Returns:
        Dictionary with success, columns list, count, table, schema.

    Key OMOP CDM columns: person_id, condition_concept_id, drug_concept_id,
    measurement_concept_id, value_as_number, *_start_date
    """
    try:
        columns = sf_explorer.get_table_columns(table, schema, database)
        return {
            "success": True,
            "columns": columns,
            "count": len(columns),
            "table": table,
            "schema": schema,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "columns": [],
            "count": 0,
            "table": table,
            "schema": schema,
        }


@mcp.tool()
def snowflake_preview_table(
    table: str,
    schema: str,
    database: str,
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Preview sample rows from a table.

    Args:
        table: Table name (required)
        schema: Schema containing the table (required)
        database: Database name (required)
        limit: Maximum number of rows to return (default 10, max 1000)

    Returns:
        Dictionary with success, columns, rows, row_count, limit.
    """
    try:
        result = sf_explorer.preview_table(table, schema, database, limit)
        return {"success": True, **result, "table": table, "schema": schema}
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "columns": [],
            "rows": [],
            "row_count": 0,
            "limit": limit,
            "table": table,
            "schema": schema,
        }


@mcp.tool()
def snowflake_select_rows(
    database: str,
    schema: str,
    table: str,
    columns: Optional[List[str]] = None,
    where: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    Select rows from a table with optional filtering.

    Args:
        database: Database name (required)
        schema: Schema name (required)
        table: Table name (required)
        columns: List of column names to select (None = all columns)
        where: Optional WHERE clause without 'WHERE' keyword
        limit: Maximum rows to return (default 100, max 1000)

    Returns:
        Dictionary with columns, rows, row_count, limit.
    """
    try:
        return sf_explorer.select_rows(
            database=database,
            schema=schema,
            table=table,
            columns=columns,
            where=where,
            limit=limit,
        )
    except Exception as e:
        return {
            "error": str(e),
            "columns": [],
            "rows": [],
            "row_count": 0,
            "limit": limit,
        }


@mcp.tool()
def snowflake_get_distinct_values(
    database: str,
    schema: str,
    table: str,
    column: str,
    where: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """
    Get distinct values from a column.

    Use this to discover what codes, vocabularies, or unique values exist in a column.

    Args:
        database: Database name (required)
        schema: Schema name (required)
        table: Table name (required)
        column: Column name to get distinct values from (required)
        where: Optional WHERE clause without 'WHERE' keyword
        limit: Maximum distinct values to return (default 100, max 1000)

    Returns:
        Dictionary with column, values, count, limit.
    """
    try:
        return sf_explorer.get_distinct_values(
            database=database,
            schema=schema,
            table=table,
            column=column,
            where=where,
            limit=limit,
        )
    except Exception as e:
        return {
            "error": str(e),
            "column": column,
            "values": [],
            "count": 0,
            "limit": limit,
        }


@mcp.tool()
def snowflake_count_rows(
    database: str,
    schema: str,
    table: str,
    where: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Count rows in a table with optional filtering.

    Args:
        database: Database name (required)
        schema: Schema name (required)
        table: Table name (required)
        where: Optional WHERE clause without 'WHERE' keyword

    Returns:
        Dictionary with count, table.
    """
    try:
        return sf_explorer.count_rows(
            database=database, schema=schema, table=table, where=where
        )
    except Exception as e:
        return {
            "error": str(e),
            "count": 0,
            "table": f'"{database}"."{schema}"."{table}"',
        }


# ============================================================
# PROMPTS
# ============================================================


@mcp.prompt()
def explore_phenotypes():
    """Explore available PhenEx phenotype types for cohort building."""
    return """I'd like to explore what phenotype types are available in PhenEx for building clinical cohorts.

Please:
1. List all available phenotype types
2. For each type, show me the use cases
3. Then get detailed specifications for CodelistPhenotype and MeasurementPhenotype"""


@mcp.prompt()
def explore_snowflake_data():
    """Explore the Snowflake data warehouse structure."""
    return """I want to explore the data available in my Snowflake data warehouse.

Please help me:
1. List all available databases
2. For the OMOP schema (if it exists), show me what tables are available
3. For the PERSON table (if it exists), show me the column structure
4. Preview a few rows from the PERSON table"""


@mcp.prompt()
def design_cohort():
    """Design a clinical cohort using PhenEx phenotypes."""
    return """I need to design a clinical cohort. Let's work through this systematically:

1. First, show me what phenotype types are available
2. Then explore what data tables are available in Snowflake
3. Help me understand which phenotypes would be useful for defining:
   - Inclusion criteria (diagnosis codes, age, measurements)
   - Exclusion criteria
   - Baseline characteristics

Please guide me through this process step by step."""


# ============================================================
# SERVER ENTRY POINT
# ============================================================


def run_server():
    """Run the MCP server (stdio by default, HTTP when MCP_TRANSPORT=http)."""
    transport = os.getenv("MCP_TRANSPORT", "stdio").lower()
    if transport in ("http", "streamable-http"):
        port = int(os.getenv("MCP_PORT", "9000"))
        host = os.getenv("MCP_HOST", "0.0.0.0")
        mcp.run(
            transport="streamable-http",
            host=host,
            port=port,
            log_level=log_level.lower(),
        )
    elif transport == "sse":
        port = int(os.getenv("MCP_PORT", "9000"))
        host = os.getenv("MCP_HOST", "0.0.0.0")
        mcp.run(transport="sse", host=host, port=port, log_level=log_level.lower())
    else:
        mcp.run()


if __name__ == "__main__":
    run_server()
