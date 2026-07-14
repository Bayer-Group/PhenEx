"""
Utilities for building and introspecting a study's configured analytical database.

This centralizes the logic that turns a study's stored `database` config (mocker or
Snowflake) into a live PhenEx `Database`, and provides READ-ONLY introspection helpers
so the AI agent can inspect which domains/tables exist and what codes / code types are
actually present. This lets the agent choose correct code types and formatting instead
of guessing (e.g. avoid picking RxNorm codes when the database has none).
"""

import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# Cache built mocker databases by n_patients so the (expensive) synthetic build only
# happens once per process. Snowflake connections are cheap-ish and not cached here.
_mock_db_cache: dict = {}

# Domains worth sampling codes from (code-bearing OMOP domains). Introspection samples
# codes only for these to keep queries cheap.
_CODE_SAMPLE_DOMAINS = [
    "CONDITION_OCCURRENCE",
    "CONDITION_OCCURRENCE_SOURCE",
    "DRUG_EXPOSURE",
    "DRUG_EXPOSURE_SOURCE",
    "PROCEDURE_OCCURRENCE",
    "PROCEDURE_OCCURRENCE_SOURCE",
    "MEASUREMENT",
    "OBSERVATION",
]


def _resolve_mapper(database_config: dict):
    """Resolve the PhenEx DomainsDictionary for a study's mapper name."""
    mapper_name = (database_config or {}).get("mapper", "OMOP")
    if mapper_name == "OMOP":
        from phenex.mappers import OMOPDomains

        return OMOPDomains
    raise ValueError(f"Unsupported mapper '{mapper_name}'. Only 'OMOP' is supported.")


def build_database_from_config(database_config: dict):
    """
    Build a live PhenEx `Database` (connector + mapper) from a study's stored config.

    Supports the 'mocker' connector (synthetic in-memory OMOP data, cached per
    n_patients) and 'snowflake'/'Snowflake'. Returns a `phenex.core.database.Database`.

    Raises ValueError/RuntimeError on misconfiguration or missing connector support.
    """
    if not database_config:
        raise ValueError("No database configured for this study.")

    mapper = _resolve_mapper(database_config)
    db_cfg = database_config.get("config") or {}
    connector_type = (database_config.get("connector") or "snowflake").lower()

    if connector_type == "mocker":
        n_patients = db_cfg.get("n_patients", 1000) if db_cfg else 1000
        if n_patients not in _mock_db_cache:
            from phenex.sim import DatabaseMocker

            logger.info(f"Building DatabaseMocker with {n_patients} patients (one-time)...")
            _mock_db_cache[n_patients] = DatabaseMocker(
                domains_dict=mapper, n_patients=n_patients
            ).get_database()
            logger.info("DatabaseMocker ready and cached.")
        return _mock_db_cache[n_patients]

    if connector_type == "snowflake":
        # NOTE: the connector lives in phenex.ibis_connect (there is no
        # phenex.connectors.snowflake module).
        from phenex.ibis_connect import SnowflakeConnector
        from phenex.core.database import Database

        source = db_cfg.get("source_database")
        dest = db_cfg.get("destination_database")
        if not source:
            raise ValueError("Snowflake source_database is required.")
        con = SnowflakeConnector(
            SNOWFLAKE_SOURCE_DATABASE=source,
            SNOWFLAKE_DEST_DATABASE=dest,
        )
        return Database(connector=con, mapper=mapper)

    raise ValueError(f"Unsupported connector '{connector_type}'.")


def _sample_column_values(ibis_table, column: str, limit: int) -> List[str]:
    """Return up to `limit` distinct, non-null values of a column as strings."""
    try:
        df = (
            ibis_table.select(column)
            .distinct()
            .limit(limit)
            .execute()
        )
        values = df[column].dropna().tolist()
        return [str(v) for v in values]
    except Exception as e:  # pragma: no cover - defensive; depends on live DB
        logger.warning(f"Failed to sample column '{column}': {e}")
        return []


def introspect_database(
    database_config: dict,
    domains: Optional[List[str]] = None,
    sample_limit: int = 20,
) -> Dict[str, Any]:
    """
    READ-ONLY introspection of the study's configured database.

    Returns a structured summary describing, for each available domain:
    - the physical source table
    - the mapped columns
    - whether a CODE_TYPE column exists and is populated
    - distinct CODE_TYPE values (sample)
    - a sample of distinct CODE values (so the agent can see the real code format)

    This is intentionally defensive: individual domain failures are captured rather
    than aborting the whole introspection.
    """
    database = build_database_from_config(database_config)
    con = database.connector
    mapper = database.mapper

    mapped = mapper.get_mapped_tables(con)

    target_domains = domains or list(mapped.keys())

    result: Dict[str, Any] = {
        "connector": (database_config.get("connector") or "snowflake"),
        "mapper": database_config.get("mapper", "OMOP"),
        "available_domains": [d for d, t in mapped.items() if t is not None],
        "domains": {},
    }

    for domain in target_domains:
        table = mapped.get(domain)
        if table is None:
            continue
        try:
            columns = list(table.columns)
        except Exception as e:
            logger.warning(f"Could not read columns for domain '{domain}': {e}")
            continue

        domain_info: Dict[str, Any] = {"columns": columns}
        has_code = "CODE" in columns
        has_code_type = "CODE_TYPE" in columns
        domain_info["has_code_column"] = has_code
        domain_info["has_code_type_column"] = has_code_type

        # Only sample codes for code-bearing domains, and only for the domains we care
        # about (or an explicit request) to keep this cheap.
        should_sample = has_code and (
            domains is not None or domain in _CODE_SAMPLE_DOMAINS
        )
        if should_sample:
            ibis_table = table.table
            domain_info["sample_codes"] = _sample_column_values(
                ibis_table, "CODE", sample_limit
            )
            if has_code_type:
                code_types = _sample_column_values(
                    ibis_table, "CODE_TYPE", sample_limit
                )
                domain_info["code_types"] = code_types
                domain_info["code_type_populated"] = len(code_types) > 0

        result["domains"][domain] = domain_info

    return result


def sample_domain_codes(
    database_config: dict, domain: str, limit: int = 50
) -> Dict[str, Any]:
    """
    Return a sample of distinct CODE and CODE_TYPE values for a single domain.
    Useful for the agent to inspect actual code formatting before choosing codes.
    """
    database = build_database_from_config(database_config)
    con = database.connector
    mapped = database.mapper.get_mapped_tables(con)
    table = mapped.get(domain)
    if table is None:
        available = [d for d, t in mapped.items() if t is not None]
        raise ValueError(
            f"Domain '{domain}' not available. Available domains: {available}"
        )

    columns = list(table.columns)
    ibis_table = table.table
    out: Dict[str, Any] = {"domain": domain, "columns": columns}
    if "CODE" in columns:
        out["sample_codes"] = _sample_column_values(ibis_table, "CODE", limit)
    if "CODE_TYPE" in columns:
        out["code_types"] = _sample_column_values(ibis_table, "CODE_TYPE", limit)
    return out
