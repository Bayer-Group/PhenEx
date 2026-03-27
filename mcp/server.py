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

from phenotype_registry import get_available_phenotypes, get_phenotype_spec, get_codelist_spec
import snowflake_explorer as sf_explorer
from cohort_tools import validate_phenotype, validate_cohort, execute_cohort
import codelist_store

# Load environment variables from .env file in this directory
load_dotenv(Path(__file__).resolve().parent / ".env", override=False)

# Initialize FastMCP server
mcp = FastMCP("PhenEx Cohort Builder")


# ============================================================
# PHENEX PHENOTYPE TOOLS
# ============================================================


@mcp.tool()
def phenex_list_available_phenotypes() -> Dict[str, Any]:
    """
    List all available PhenEx phenotype types with descriptions and use cases.

    PhenEx (Phenotype Extractor) provides pre-built phenotype classes for common clinical
    data extraction patterns. Use this tool to discover what types of phenotypes you can
    define for cohort building.

    Returns:
        Dictionary containing:
        - phenotypes (list): Array of available phenotype types, each with:
            * name (str): Phenotype class name (e.g., "CodelistPhenotype")
            * description (str): What the phenotype does
            * use_cases (list): Example clinical use cases
        - count (int): Total number of available phenotypes

    After reviewing available phenotypes, use phenex_get_phenotype_spec() to get detailed
    parameters and usage examples for a specific phenotype class.
    """
    try:
        phenotypes = get_available_phenotypes()

        if isinstance(phenotypes, list) and len(phenotypes) > 0:
            if "error" in phenotypes[0]:
                return {
                    "success": False,
                    "error": phenotypes[0]["error"],
                    "phenotypes": [],
                    "count": 0,
                }

        return {"success": True, "phenotypes": phenotypes, "count": len(phenotypes)}
    except Exception as e:
        return {"success": False, "error": str(e), "phenotypes": [], "count": 0}


@mcp.tool()
def phenex_get_phenotype_spec(phenotype_class: str) -> Dict[str, Any]:
    """
    Get detailed specification and usage examples for a specific PhenEx phenotype class.

    Also supports "Codelist" to get full documentation on the Codelist class, which is
    the fundamental building block for code-based phenotypes.

    Args:
        phenotype_class: Name of the phenotype class to get specs for.
                        Must exactly match a name from phenex_list_available_phenotypes(),
                        or "Codelist" for codelist documentation.
                        Examples: "CodelistPhenotype", "Codelist", "AgePhenotype", "MeasurementPhenotype"

    Returns:
        Dictionary containing:
        - success (bool): Whether the spec was retrieved successfully
        - name (str): Phenotype class name
        - description (str): Brief description
        - use_cases (list): Example clinical use cases
        - parameters (dict): All constructor parameters with types, required flags, defaults
        - docstring (str): Complete class documentation
        - example (str): Example usage code
    """
    if phenotype_class == "Codelist":
        return get_codelist_spec()

    try:
        spec = get_phenotype_spec(phenotype_class)
        if "error" in spec:
            return {"success": False, **spec}
        return {"success": True, **spec}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============================================================
# PHENEX CODELIST TOOLS
# ============================================================


@mcp.tool()
def phenex_list_available_codelists() -> Dict[str, Any]:
    """
    List all codelists available in the configured codelist directory.

    Scans CSV/Excel files in the directory specified by PHENEX_CODELIST_DIR.
    Each file should contain columns for code, codelist name, and code type
    (configurable via PHENEX_CODELIST_CODE_COLUMN, PHENEX_CODELIST_NAME_COLUMN,
    PHENEX_CODELIST_CODE_TYPE_COLUMN; defaults: 'code', 'codelist', 'code_type').

    Returns:
        Dictionary containing:
        - success (bool): Whether the operation succeeded
        - codelists (list): Array of codelist summaries, each with:
            * name (str): Codelist name
            * code_types (list): Vocabularies present (e.g. ["ICD10CM", "ICD9CM"])
            * total_codes (int): Total number of codes
            * sample_codes (list): Up to 10 sample codes with code_type
        - count (int): Number of codelists found
        - error (str): Error message if operation failed
    """
    try:
        result = codelist_store.list_available_codelists()
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "error": str(e), "codelists": [], "count": 0}


@mcp.tool()
def phenex_get_codelist(name: str) -> Dict[str, Any]:
    """
    Get the full contents of a specific codelist by name.

    Args:
        name: Exact codelist name as shown by phenex_list_available_codelists().

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
            {
                "type": "CodelistPhenotype",
                "name": "atrial_fibrillation",
                "domain": "CONDITION_OCCURRENCE_SOURCE",
                "codelist": {"ICD10CM": ["I48.0", "I48.1", "I48.2", "I48.91"]},
                "use_code_type": false,
                "remove_punctuation": true,
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

    Cohorts are defined as structured JSON objects, not Python code strings.
    This tool validates the structure and attempts to compile with from_dict().

    Args:
        cohort_definition: Dictionary defining the cohort structure with:
            - name (str): Cohort name
            - phenotypes (list): List of phenotype definitions, each with:
                * type (str): Phenotype class name (e.g., "CodelistPhenotype")
                * Additional fields specific to the phenotype type
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
            "phenotypes": [
                {
                    "type": "CodelistPhenotype",
                    "domain": "CONDITION_OCCURRENCE_SOURCE",
                    "codelist": {
                        "ICD10CM": ["I48", "I48.0", "I48.1", "I48.2", "I48.91"]
                    },
                    "name": "atrial_fibrillation",
                    "use_code_type": false,
                    "remove_punctuation": true
                }
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
        cohort_definition: Dict with cohort specification including:
            - name: Cohort name
            - phenotypes: List of phenotype definitions (dicts)
            - description: Optional cohort description

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
        result = {"success": True, "databases": databases, "count": len(databases), "limit": limit}
        if pattern:
            result["pattern"] = pattern
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "databases": [], "count": 0, "limit": limit}


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
        result = {"success": True, "schemas": schemas, "count": len(schemas), "limit": limit}
        if pattern:
            result["pattern"] = pattern
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "schemas": [], "count": 0, "limit": limit}


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
        result = {"success": True, "tables": tables, "count": len(tables), "limit": limit, "schema": schema}
        if pattern:
            result["pattern"] = pattern
        return result
    except Exception as e:
        return {"success": False, "error": str(e), "tables": [], "count": 0, "limit": limit, "schema": schema}


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
        return {"success": True, "columns": columns, "count": len(columns), "table": table, "schema": schema}
    except Exception as e:
        return {"success": False, "error": str(e), "columns": [], "count": 0, "table": table, "schema": schema}


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
            "success": False, "error": str(e), "columns": [], "rows": [],
            "row_count": 0, "limit": limit, "table": table, "schema": schema,
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
            database=database, schema=schema, table=table,
            columns=columns, where=where, limit=limit,
        )
    except Exception as e:
        return {"error": str(e), "columns": [], "rows": [], "row_count": 0, "limit": limit}


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
            database=database, schema=schema, table=table,
            column=column, where=where, limit=limit,
        )
    except Exception as e:
        return {"error": str(e), "column": column, "values": [], "count": 0, "limit": limit}


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
        return sf_explorer.count_rows(database=database, schema=schema, table=table, where=where)
    except Exception as e:
        return {"error": str(e), "count": 0, "table": f'"{database}"."{schema}"."{table}"'}


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
        mcp.run(transport="streamable-http", host=host, port=port, log_level=log_level.lower())
    elif transport == "sse":
        port = int(os.getenv("MCP_PORT", "9000"))
        host = os.getenv("MCP_HOST", "0.0.0.0")
        mcp.run(transport="sse", host=host, port=port, log_level=log_level.lower())
    else:
        mcp.run()


if __name__ == "__main__":
    run_server()
