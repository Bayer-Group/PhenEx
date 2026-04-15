"""
Cohort validation, translation, and execution helpers for PhenEx.
"""

import re
import os
import traceback
from typing import Dict, Any, List, Optional

# Known phenotype class names for error guidance
KNOWN_PHENOTYPE_TYPES = [
    "CodelistPhenotype", "AgePhenotype", "SexPhenotype", "MeasurementPhenotype",
    "MeasurementChangePhenotype", "EventCountPhenotype", "TimeRangePhenotype",
    "TimeRangeCountPhenotype", "TimeRangeDayCountPhenotype", "TimeRangeDaysToNextRange",
    "DeathPhenotype", "CategoricalPhenotype", "BinPhenotype", "ScorePhenotype",
    "ArithmeticPhenotype", "LogicPhenotype", "WithinSameEncounterPhenotype",
]

# Common required fields per phenotype type
REQUIRED_FIELDS_BY_TYPE = {
    "CodelistPhenotype": ["domain", "codelist"],
    "MeasurementPhenotype": ["domain", "codelist"],
    "AgePhenotype": ["name"],
    "SexPhenotype": ["name"],
    "DeathPhenotype": ["name"],
    "EventCountPhenotype": ["name", "input_phenotype"],
    "ScorePhenotype": ["name", "expression"],
    "ArithmeticPhenotype": ["name", "expression"],
    "LogicPhenotype": ["name", "expression"],
    "BinPhenotype": ["name", "input_phenotype"],
}


def _get_close_matches(name: str, candidates: List[str], n: int = 3) -> List[str]:
    """Return candidate strings that are close matches to name (case-insensitive)."""
    import difflib
    # Try case-insensitive matching
    lower_map = {c.lower(): c for c in candidates}
    matches = difflib.get_close_matches(name.lower(), lower_map.keys(), n=n, cutoff=0.5)
    return [lower_map[m] for m in matches]


def _diagnose_compilation_error(error: Exception, pheno_type: str, definition: Dict[str, Any]) -> str:
    """Produce an actionable remediation hint from a compilation exception."""
    err_str = str(error)
    err_type = type(error).__name__

    # Unknown class_name in from_dict
    if err_type == "KeyError" and "class_name" not in definition:
        return (
            f"The class '{err_str}' is not recognized by PhenEx. "
            f"Call phenex_list_classes() to see valid class names."
        )

    # Missing required parameter
    if "required" in err_str.lower() or "missing" in err_str.lower():
        required = REQUIRED_FIELDS_BY_TYPE.get(pheno_type, [])
        missing = [f for f in required if f not in definition]
        if missing:
            return (
                f"Missing required field(s): {missing}. "
                f"Call phenex_inspect_class('{pheno_type}') to see all required parameters."
            )
        return (
            f"{err_type}: {err_str}. "
            f"Call phenex_inspect_class('{pheno_type}') to see all required parameters and their types."
        )

    # Type errors (e.g. passing string where int expected)
    if err_type == "TypeError":
        return (
            f"Type mismatch: {err_str}. "
            f"Call phenex_inspect_class('{pheno_type}') to check the expected types for each parameter."
        )

    # Assertion errors (e.g. invalid domain, bad operator)
    if err_type == "AssertionError":
        return (
            f"Validation failed: {err_str}. "
            f"Check that domain, operator, and enum-like fields use exact expected values. "
            f"Call phenex_inspect_class('{pheno_type}') for valid options."
        )

    # Value errors
    if err_type == "ValueError":
        return (
            f"Invalid value: {err_str}. "
            f"Call phenex_inspect_class('{pheno_type}') to review accepted values for each parameter."
        )

    # Generic fallback — still actionable
    return (
        f"{err_type}: {err_str}. "
        f"Call phenex_inspect_class('{pheno_type}') to review the full specification and examples."
    )


def _resolve_codelist_reference(name: str) -> Dict[str, Any]:
    """
    Look up a codelist by name from the codelist store and return it as a
    native from_dict()-compatible Codelist dict.

    Raises ValueError if the codelist is not found.
    """
    import codelist_store

    result = codelist_store.get_codelist(name)
    if "error" in result:
        raise ValueError(result["error"])

    return {
        "class_name": "Codelist",
        "name": name,
        "codelist": result["codelist"],
        "use_code_type": True,
        "remove_punctuation": False,
    }


def translate_phenotype_to_native(pheno: Dict[str, Any]) -> Dict[str, Any]:
    """
    Translate a single phenotype from simplified tool format to PhenEx native from_dict() format.

    Simplified format (what the tool docs show):
        {"type": "CodelistPhenotype", "name": "af", "domain": "CONDITION_OCCURRENCE_SOURCE",
         "codelist": {"ICD10CM": ["I48.0", "I48.1"]}, "remove_punctuation": true, "return_date": "first"}

    Codelist by reference (name from codelist store):
        {"type": "CodelistPhenotype", "name": "af", "domain": "CONDITION_OCCURRENCE_SOURCE",
         "codelist": "atrial_fibrillation", "return_date": "first"}

    PhenEx native format (what from_dict() expects):
        {"class_name": "CodelistPhenotype", "name": "af", "domain": "CONDITION_OCCURRENCE_SOURCE",
         "codelist": {"class_name": "Codelist", "name": "af_codes", "codelist": {"ICD10CM": [...]},
                      "use_code_type": true, "remove_punctuation": true},
         "return_date": "first"}
    """
    native = pheno.copy()

    # Convert 'type' -> 'class_name'
    if "type" in native and "class_name" not in native:
        native["class_name"] = native.pop("type")

    # Resolve codelist by reference (string = name in codelist store)
    if "codelist" in native and isinstance(native["codelist"], str):
        codelist_name = native["codelist"]
        resolved = _resolve_codelist_reference(codelist_name)
        # Allow phenotype-level overrides for remove_punctuation / use_code_type
        if "remove_punctuation" in native:
            resolved["remove_punctuation"] = native.pop("remove_punctuation")
        if "use_code_type" in native:
            resolved["use_code_type"] = native.pop("use_code_type")
        native["codelist"] = resolved

    # Convert flat codelist dict to wrapped Codelist object
    elif (
        "codelist" in native
        and isinstance(native["codelist"], dict)
        and "class_name" not in native["codelist"]
    ):
        codelist_dict = native["codelist"]
        # These belong on the Codelist, not the phenotype — pull them from BOTH locations
        remove_punctuation = codelist_dict.pop(
            "remove_punctuation", native.pop("remove_punctuation", False)
        )
        use_code_type = codelist_dict.pop(
            "use_code_type", native.pop("use_code_type", True)
        )
        native["codelist"] = {
            "class_name": "Codelist",
            "name": native.get("name", "codelist") + "_codes",
            "codelist": codelist_dict,
            "use_code_type": use_code_type,
            "remove_punctuation": remove_punctuation,
        }

    # Recursively translate anchor_phenotype in relative_time_range if present
    if "relative_time_range" in native and isinstance(
        native["relative_time_range"], dict
    ):
        rtrf = native["relative_time_range"]
        if "class_name" not in rtrf:
            rtrf["class_name"] = "RelativeTimeRangeFilter"
        if "anchor_phenotype" in rtrf and isinstance(rtrf["anchor_phenotype"], dict):
            rtrf["anchor_phenotype"] = translate_phenotype_to_native(
                rtrf["anchor_phenotype"]
            )

    # Translate date_range if present
    if "date_range" in native and isinstance(native["date_range"], dict):
        dr = native["date_range"]
        if "class_name" not in dr:
            dr["class_name"] = "DateFilter"

    # Translate categorical_filter if present
    if "categorical_filter" in native and isinstance(
        native["categorical_filter"], dict
    ):
        cf = native["categorical_filter"]
        if "class_name" not in cf:
            cf["class_name"] = "CategoricalFilter"

    return native


def translate_to_phenex_native(
    cohort_definition: Dict[str, Any], cohort_name: str
) -> Dict[str, Any]:
    """
    Translate the simplified cohort format (shown in tool docs) to PhenEx's native
    from_dict() Cohort format.

    Simplified format:
        {"name": "my_cohort", "phenotypes": [
            {"type": "CodelistPhenotype", "name": "af", "domain": "...", "codelist": {...}}
        ]}

    PhenEx native format:
        {"class_name": "Cohort", "name": "my_cohort",
         "entry_criterion": {"class_name": "CodelistPhenotype", ...}}
    """
    # If already in native format, return as-is
    if cohort_definition.get("class_name") == "Cohort":
        return cohort_definition

    phenotypes = cohort_definition.get("phenotypes", [])
    if not phenotypes:
        return cohort_definition  # Let from_dict() raise a clear error

    # Translate each phenotype
    translated = [translate_phenotype_to_native(p) for p in phenotypes]

    # First phenotype is the entry criterion
    entry = translated[0]

    native = {
        "class_name": "Cohort",
        "name": cohort_definition.get("name", cohort_name),
        "entry_criterion": entry,
    }

    # Assign remaining phenotypes based on role hints
    if len(translated) > 1:
        inclusions = []
        exclusions = []
        characteristics = []
        outcomes = []
        for p in translated[1:]:
            role = p.pop("role", "inclusion")
            if role == "exclusion":
                exclusions.append(p)
            elif role == "characteristic":
                characteristics.append(p)
            elif role == "outcome":
                outcomes.append(p)
            else:
                inclusions.append(p)
        if inclusions:
            native["inclusions"] = inclusions
        if exclusions:
            native["exclusions"] = exclusions
        if characteristics:
            native["characteristics"] = characteristics
        if outcomes:
            native["outcomes"] = outcomes

    if "description" in cohort_definition:
        native["description"] = cohort_definition["description"]

    return native


def validate_phenotype(phenotype_definition: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate a single phenotype definition by attempting to compile it via from_dict().

    Returns a dict with 'valid', 'errors', and the compiled class name.
    """
    errors = []
    warnings = []

    if not isinstance(phenotype_definition, dict):
        return {
            "valid": False,
            "errors": ["phenotype_definition must be a dictionary"],
            "warnings": [],
        }

    # Must have a type/class_name
    pheno_type = phenotype_definition.get("type") or phenotype_definition.get(
        "class_name"
    )
    if not pheno_type:
        return {
            "valid": False,
            "errors": [
                "phenotype_definition must have a 'type' field. "
                "Set 'type' to a phenotype class name such as 'CodelistPhenotype'. "
                "Call phenex_list_classes() to see all valid type names."
            ],
            "warnings": [],
        }

    # Check for unknown phenotype type early
    if pheno_type not in KNOWN_PHENOTYPE_TYPES:
        close = _get_close_matches(pheno_type, KNOWN_PHENOTYPE_TYPES)
        hint = f" Did you mean: {', '.join(close)}?" if close else ""
        warnings.append(
            f"Unrecognized phenotype type '{pheno_type}'.{hint} "
            f"Call phenex_list_classes() to see all valid type names."
        )

    # Check for commonly missing required fields before compilation
    required = REQUIRED_FIELDS_BY_TYPE.get(pheno_type, [])
    missing = [f for f in required if f not in phenotype_definition]
    if missing:
        errors.append(
            f"Missing required field(s) for {pheno_type}: {missing}. "
            f"Call phenex_inspect_class('{pheno_type}') to see all required parameters."
        )
        return {
            "valid": False,
            "errors": errors,
            "warnings": warnings,
            "phenotype_name": name,
            "phenotype_type": pheno_type,
            "message": f"Phenotype '{name}' ({pheno_type}) is missing required fields: {missing}",
        }

    name = phenotype_definition.get("name", "unnamed")

    try:
        from phenex.util.serialization.from_dict import from_dict

        native = translate_phenotype_to_native(phenotype_definition.copy())
        compiled = from_dict(native)

        return {
            "valid": True,
            "errors": [],
            "warnings": warnings,
            "phenotype_name": name,
            "phenotype_type": pheno_type,
            "compiled_class": type(compiled).__name__,
            "message": f"Phenotype '{name}' ({pheno_type}) compiles successfully",
        }
    except Exception as e:
        remediation = _diagnose_compilation_error(e, pheno_type, phenotype_definition)
        return {
            "valid": False,
            "errors": [remediation],
            "warnings": warnings,
            "phenotype_name": name,
            "phenotype_type": pheno_type,
            "message": f"Phenotype '{name}' ({pheno_type}) failed to compile",
        }


def validate_cohort(
    cohort_definition: Dict[str, Any], cohort_name: str
) -> Dict[str, Any]:
    """
    Validate a cohort definition without executing it.

    Returns a dict with 'valid', 'errors', 'warnings', and metadata.
    """
    errors = []
    warnings = []
    phenotypes_used = []

    try:
        # 1. Validate cohort_name format
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", cohort_name):
            errors.append(
                f"Invalid cohort_name '{cohort_name}'. "
                f"Must start with a letter and contain only alphanumeric characters and underscores. "
                f"Example: 'af_cohort_v1'. This name is used to create the output schema PHENEX_AI__{cohort_name.upper()}."
            )

        target_schema = f"PHENEX_AI__{cohort_name.upper()}"

        # 2. Validate cohort_definition structure
        if not isinstance(cohort_definition, dict):
            errors.append("cohort_definition must be a dictionary")
            return {
                "valid": False,
                "errors": errors,
                "warnings": warnings,
                "cohort_name": cohort_name,
                "target_schema": target_schema,
            }

        # 3. Check for Cohort class_name (PhenEx format)
        if cohort_definition.get("class_name") == "Cohort":
            if "name" not in cohort_definition:
                errors.append("Cohort definition missing required field: 'name'")
            if "entry_criterion" not in cohort_definition:
                errors.append(
                    "Cohort definition missing required field: 'entry_criterion'"
                )
            else:
                entry = cohort_definition["entry_criterion"]
                if isinstance(entry, dict) and "class_name" in entry:
                    phenotypes_used.append(entry.get("class_name"))

            for field in ["inclusions", "exclusions", "characteristics", "outcomes"]:
                if field in cohort_definition and cohort_definition[field]:
                    for pheno in cohort_definition[field]:
                        if isinstance(pheno, dict) and "class_name" in pheno:
                            phenotypes_used.append(pheno.get("class_name"))

            phenotype_count = 1
            phenotype_count += len(cohort_definition.get("inclusions", []))
            phenotype_count += len(cohort_definition.get("exclusions", []))
            phenotype_count += len(cohort_definition.get("characteristics", []))
            phenotype_count += len(cohort_definition.get("outcomes", []))
        else:
            # Simplified format validation
            if "name" not in cohort_definition:
                errors.append(
                    "cohort_definition missing required field: 'name'. "
                    "Add a 'name' key with a descriptive string, e.g. {'name': 'my_cohort', 'phenotypes': [...]}"
                )

            if "phenotypes" not in cohort_definition:
                errors.append(
                    "cohort_definition missing required field: 'phenotypes'. "
                    "Add a 'phenotypes' list containing at least one phenotype dict. "
                    "Example: {'name': 'my_cohort', 'phenotypes': [{'type': 'CodelistPhenotype', 'name': 'dx', 'domain': '...', 'codelist': {...}}]}"
                )
            elif not isinstance(cohort_definition["phenotypes"], list):
                errors.append(
                    "'phenotypes' must be a list of phenotype dictionaries, not a "
                    f"{type(cohort_definition['phenotypes']).__name__}."
                )
            elif len(cohort_definition["phenotypes"]) == 0:
                errors.append(
                    "'phenotypes' list is empty — must have at least one phenotype. "
                    "The first phenotype becomes the entry criterion (defines the index date)."
                )
            else:
                for i, pheno in enumerate(cohort_definition["phenotypes"]):
                    if not isinstance(pheno, dict):
                        errors.append(
                            f"Phenotype at index {i} is a {type(pheno).__name__}, not a dictionary. "
                            f"Each phenotype must be a dict with at least 'type' and 'name'."
                        )
                        continue
                    if "type" not in pheno and "class_name" not in pheno:
                        errors.append(
                            f"Phenotype at index {i} (name='{pheno.get('name', 'unknown')}') is missing a 'type' field. "
                            f"Set 'type' to a phenotype class name like 'CodelistPhenotype'. "
                            f"Call phenex_list_classes() to see all valid type names."
                        )
                    else:
                        pheno_type = pheno.get("type") or pheno.get("class_name")
                        phenotypes_used.append(pheno_type)
                        if pheno_type not in KNOWN_PHENOTYPE_TYPES:
                            close = _get_close_matches(pheno_type, KNOWN_PHENOTYPE_TYPES)
                            hint = f" Did you mean: {', '.join(close)}?" if close else ""
                            warnings.append(
                                f"Phenotype at index {i}: unrecognized type '{pheno_type}'.{hint} "
                                f"Call phenex_list_classes() for valid types."
                            )

            phenotype_count = len(cohort_definition.get("phenotypes", []))

        # Additional validation
        if cohort_definition.get("name") != cohort_name:
            warnings.append(
                f"cohort_definition.name ('{cohort_definition.get('name')}') doesn't match cohort_name parameter ('{cohort_name}')"
            )

        # Deep validation: attempt actual from_dict() compilation to catch structural errors
        if len(errors) == 0:
            try:
                from phenex.util.serialization.from_dict import from_dict

                native_def = translate_to_phenex_native(
                    cohort_definition.copy(), cohort_name
                )
                _compiled = from_dict(native_def)
            except KeyError as key_err:
                errors.append(
                    f"Unknown class name '{key_err}' encountered during compilation. "
                    f"Check that all 'type' values in your phenotype definitions are valid PhenEx class names. "
                    f"Call phenex_list_classes() for valid names."
                )
            except Exception as compile_err:
                # Try to identify which phenotype caused the error
                err_msg = str(compile_err)
                errors.append(
                    f"Compilation failed: {type(compile_err).__name__}: {err_msg}. "
                    f"Try validating each phenotype individually with phenex_validate_phenotype() "
                    f"to isolate the problem phenotype, then call phenex_inspect_class() for that type."
                )

        is_valid = len(errors) == 0

        return {
            "valid": is_valid,
            "errors": errors,
            "warnings": warnings,
            "cohort_name": cohort_name,
            "target_schema": target_schema,
            "phenotypes_used": list(set(phenotypes_used)),
            "phenotype_count": phenotype_count,
            "message": (
                "Cohort definition is valid"
                if is_valid
                else f"Validation failed with {len(errors)} error(s)"
            ),
        }

    except Exception as e:
        return {
            "valid": False,
            "errors": [
                f"Unexpected validation error: {type(e).__name__}: {str(e)}. "
                f"Try validating each phenotype individually with phenex_validate_phenotype() "
                f"to narrow down the issue."
            ],
            "warnings": warnings,
            "cohort_name": cohort_name,
            "target_schema": f"PHENEX_AI__{cohort_name.upper()}",
        }


def execute_cohort(
    cohort_definition: Dict[str, Any],
    cohort_name: str,
    validate_only: bool = True,
    SNOWFLAKE_SOURCE_DATABASE: Optional[str] = None,
    SNOWFLAKE_SOURCE_SCHEMA: Optional[str] = None,
    SNOWFLAKE_DEST_DATABASE: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute a cohort definition using PhenEx against Snowflake.

    Compiles a cohort definition dict into PhenEx code via from_dict()
    and executes it. Results are written to PHENEX_AI__{COHORT_NAME}.
    """
    # Step 1: Validate
    validation = validate_cohort(cohort_definition, cohort_name)

    if not validation["valid"]:
        return {
            "success": False,
            "validated": False,
            "executed": False,
            "cohort_name": cohort_name,
            "target_schema": validation["target_schema"],
            "validation_errors": validation["errors"],
            "validation_warnings": validation.get("warnings", []),
            "execution_status": "Validation failed - cannot execute",
            "error": f"Validation failed with {len(validation['errors'])} error(s)",
        }

    # Step 2: Parse database configuration
    source_database = SNOWFLAKE_SOURCE_DATABASE or os.getenv(
        "SNOWFLAKE_SOURCE_DATABASE"
    )
    source_schema = SNOWFLAKE_SOURCE_SCHEMA or os.getenv("SNOWFLAKE_SOURCE_SCHEMA")
    dest_database = SNOWFLAKE_DEST_DATABASE or os.getenv("SNOWFLAKE_DEST_DATABASE")
    dest_schema = f"PHENEX_AI__{cohort_name.upper()}"

    config_errors = []
    if not source_database:
        config_errors.append(
            "SNOWFLAKE_SOURCE_DATABASE not set. Pass it as a parameter or set the "
            "SNOWFLAKE_SOURCE_DATABASE environment variable (e.g. 'MY_DATABASE')."
        )
    if not source_schema:
        config_errors.append(
            "SNOWFLAKE_SOURCE_SCHEMA not set. Pass it as a parameter or set the "
            "SNOWFLAKE_SOURCE_SCHEMA environment variable (e.g. 'OMOP_CDM'). "
            "Use snowflake_list_schemas() to browse available schemas."
        )
    if not dest_database:
        config_errors.append(
            "SNOWFLAKE_DEST_DATABASE not set. Pass it as a parameter or set the "
            "SNOWFLAKE_DEST_DATABASE environment variable. Results will be written to "
            f"{dest_schema} schema in this database."
        )

    if config_errors:
        return {
            "success": False,
            "validated": True,
            "executed": False,
            "cohort_name": cohort_name,
            "SNOWFLAKE_SOURCE_DATABASE": source_database,
            "SNOWFLAKE_SOURCE_SCHEMA": source_schema,
            "SNOWFLAKE_DEST_DATABASE": dest_database,
            "SNOWFLAKE_DEST_SCHEMA": dest_schema,
            "validation_errors": [],
            "validation_warnings": validation["warnings"],
            "execution_status": "Configuration incomplete",
            "error": f"Database configuration errors: {'; '.join(config_errors)}",
        }

    if validate_only:
        return {
            "success": True,
            "validated": True,
            "executed": False,
            "cohort_name": cohort_name,
            "SNOWFLAKE_SOURCE_DATABASE": source_database,
            "SNOWFLAKE_SOURCE_SCHEMA": source_schema,
            "SNOWFLAKE_DEST_DATABASE": dest_database,
            "SNOWFLAKE_DEST_SCHEMA": dest_schema,
            "validation_errors": [],
            "validation_warnings": validation["warnings"],
            "execution_status": "Validated successfully - use validate_only=False to execute",
            "phenotypes_used": validation["phenotypes_used"],
            "phenotype_count": validation["phenotype_count"],
            "message": f"Cohort will read from {source_database}.{source_schema} and write to {dest_database}.{dest_schema}",
        }

    # Step 3: Execute
    try:
        from phenex.util.serialization.from_dict import from_dict
        from phenex.ibis_connect import SnowflakeConnector
        from phenex.mappers import OMOPDomains

        logger_info = []

        # 3a: Translate simplified format to PhenEx native format
        cohort_definition = translate_to_phenex_native(cohort_definition, cohort_name)
        logger_info.append("Translated cohort definition to PhenEx native format")

        # 3b: Create SnowflakeConnector
        logger_info.append("Creating Snowflake connector...")

        source_db_qualified = f"{source_database}.{source_schema}"
        dest_db_qualified = f"{dest_database}.{dest_schema}"

        connector = SnowflakeConnector(
            SNOWFLAKE_SOURCE_DATABASE=source_db_qualified,
            SNOWFLAKE_DEST_DATABASE=dest_db_qualified,
        )
        logger_info.append(
            f"Connected to Snowflake: {source_db_qualified} -> {dest_db_qualified}"
        )

        # 3c: Compile cohort from dict
        logger_info.append("Compiling cohort definition...")
        try:
            cohort = from_dict(cohort_definition)
            logger_info.append(
                f"Compiled cohort: {getattr(cohort, 'name', type(cohort).__name__)}"
            )
        except Exception as from_dict_error:
            logger_info.append(
                f"from_dict() failed: {type(from_dict_error).__name__}: {str(from_dict_error)}"
            )
            raise

        # 3d: Get source tables using OMOP mapper
        logger_info.append("Loading source tables...")
        tables = OMOPDomains.get_mapped_tables(connector)
        logger_info.append(f"Loaded {len(tables)} domain tables")

        # 3e: Execute cohort
        logger_info.append("Executing cohort...")
        cohort.execute(tables=tables, con=connector, overwrite=True)
        logger_info.append("Cohort execution complete!")

        # 3f: Get results
        index_table = cohort.index_table
        patient_count = int(index_table.count().execute())

        tables_created = [
            f"{dest_database}.{dest_schema}.COHORT",
            f"{dest_database}.{dest_schema}.INCLUSIONS",
            f"{dest_database}.{dest_schema}.EXCLUSIONS",
        ]

        if cohort.characteristics:
            tables_created.append(f"{dest_database}.{dest_schema}.CHARACTERISTICS")
        if cohort.outcomes:
            tables_created.append(f"{dest_database}.{dest_schema}.OUTCOMES")

        return {
            "success": True,
            "validated": True,
            "executed": True,
            "cohort_name": cohort_name,
            "SNOWFLAKE_SOURCE_DATABASE": source_database,
            "SNOWFLAKE_SOURCE_SCHEMA": source_schema,
            "SNOWFLAKE_DEST_DATABASE": dest_database,
            "SNOWFLAKE_DEST_SCHEMA": dest_schema,
            "validation_errors": [],
            "validation_warnings": validation["warnings"],
            "execution_status": "Execution successful",
            "patient_count": patient_count,
            "tables_created": tables_created,
            "execution_log": logger_info,
            "message": f"Successfully created cohort with {patient_count} patients in {dest_database}.{dest_schema}",
        }

    except Exception as e:
        error_trace = traceback.format_exc()
        return {
            "success": False,
            "validated": True,
            "executed": False,
            "cohort_name": cohort_name,
            "SNOWFLAKE_SOURCE_DATABASE": source_database,
            "SNOWFLAKE_SOURCE_SCHEMA": source_schema,
            "SNOWFLAKE_DEST_DATABASE": dest_database,
            "SNOWFLAKE_DEST_SCHEMA": dest_schema,
            "validation_errors": [],
            "validation_warnings": validation["warnings"],
            "execution_status": "Execution failed",
            "error": str(e),
            "error_trace": error_trace,
            "execution_log": logger_info if "logger_info" in locals() else [],
            "message": f"Cohort execution failed: {str(e)}",
        }
