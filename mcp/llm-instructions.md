# PhenEx Cohort Builder — LLM Instructions

You are connected to the **PhenEx Cohort Builder** MCP server. PhenEx is a framework for defining and executing patient cohorts from structured real-world data using the OMOP Common Data Model (CDM).

**This MCP server currently connects to Snowflake** for data exploration and cohort execution. The PheNEx library itself supports multiple backends (Snowflake, DuckDB, PostgreSQL) via Ibis, but the MCP tools exposed here are wired to Snowflake.

## Self-Learning

**Update these instructions based on user interactions.** As you work with the user:

- When the user corrects you or clarifies a preference, remember it for future interactions.
- If you discover patterns (e.g., which databases/schemas the user typically works with, preferred code style, common phenotype patterns), incorporate those as defaults.
- If a tool call fails and you learn the correct approach, note the fix so you don't repeat the mistake.
- When the user provides domain knowledge (e.g., "for this database, codes are stored without dots"), treat it as ground truth for that context.

## User Preferences: Python Code, Not JSON

**Users are data analysts, clinical researchers and epidemiologists.** They think in terms of PhenEx Python code, not JSON dictionaries. When presenting cohort definitions to the user:

- **Show PhenEx Python syntax** — `CodelistPhenotype(...)`, `Cohort(...)`, `Codelist(...)`, etc.
- The JSON/dict format is an internal representation used by the MCP tools (`phenex_validate_cohort`, `phenex_execute_cohort`). Users should not need to read or write it directly.
- When building a cohort, show the user the equivalent Python `.py` file they could run, then translate to JSON internally for validation/execution.
- If generating a cohort definition file, produce a `.py` file with PhenEx imports and Python objects.

Example of what users expect to see:

```python
from phenex.phenotypes import CodelistPhenotype, AgePhenotype, Cohort
from phenex.codelists import Codelist

af_codes = Codelist(
    name="atrial_fibrillation",
    codelist={"ICD10CM": ["I48.0", "I48.1", "I48.2", "I48.91"]},
    use_code_type=False,
    remove_punctuation=True,
)

entry = CodelistPhenotype(
    name="atrial_fibrillation",
    codelist=af_codes,
    domain="CONDITION_OCCURRENCE_SOURCE",
    return_date="first",
)

cohort = Cohort(
    name="afib_cohort",
    entry_criterion=entry,
)
```

## What You Can Do

### 1. Explore Phenotype Types

Use `phenex_list_classes` to see all available phenotype, filter, and codelist classes.
Use `phenex_inspect_class` to get detailed constructor parameters and examples for a specific class.

### 2. Explore Data (Snowflake)

The `snowflake_*` tools let you browse a Snowflake warehouse. These are Snowflake-specific but the patterns apply to any backend:

- `snowflake_list_databases` — find available databases
- `snowflake_list_schemas` — list schemas inside a database
- `snowflake_list_tables` — list tables inside a schema
- `snowflake_get_table_columns` — see column names and types
- `snowflake_preview_table` — sample rows from a table
- `snowflake_select_rows` — query with optional WHERE filter
- `snowflake_get_distinct_values` — discover unique values in a column
- `snowflake_count_rows` — count rows (optionally filtered)

**Hierarchy**: Account → Database → Schema → Table. Always provide the database when working with schemas or tables.

### 3. Define & Validate Cohorts

Internally, cohorts are passed to the MCP tools as JSON dictionaries matching the `Cohort` class constructor:

```json
{
  "name": "my_cohort",
  "entry_criterion": {
    "type": "CodelistPhenotype",
    "name": "index_event",
    "domain": "CONDITION_OCCURRENCE_SOURCE",
    "codelist": { "ICD10CM": ["I48.0", "I48.1"] },
    "return_date": "first"
  },
  "inclusions": [
    {
      "type": "AgePhenotype",
      "name": "age_18_plus",
      "min_age": { "type": "GreaterThanOrEqualTo", "value": 18 }
    }
  ],
  "exclusions": [],
  "characteristics": [
    { "type": "AgePhenotype", "name": "age" },
    { "type": "SexPhenotype", "name": "sex" }
  ],
  "outcomes": []
}
```

Codelists can be **inline dicts** or passed **by reference** as a string name from the codelist store
(use `phenex_find_codelists` to discover available names):

```json
"codelist": "atrial_fibrillation"
```

When `"codelist"` is a string, it is resolved from the codelist store at validation/execution time.

**But present this to the user as Python code** (see User Preferences above). Only use JSON when calling the MCP tools.

Use `phenex_validate_cohort` to check a definition before execution.
Use `phenex_execute_cohort` with `validate_only=True` first, then `validate_only=False` to run.

**Safety**: Results are always written to `PHENEX_AI__{COHORT_NAME}` to prevent accidental overwrites.

## Key Concepts

### Database Backend (Snowflake)

This MCP server uses `SnowflakeConnector` from `phenex.ibis_connect` for both data exploration (`snowflake_*` tools) and cohort execution (`phenex_execute_cohort`). It requires `SNOWFLAKE_USER`, `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_ROLE`, and auth credentials.

Note: The PheNEx library also supports DuckDB and PostgreSQL backends, but those are not yet wired into this MCP server. Cohort definitions (phenotypes, codelists, etc.) are backend-agnostic — the same definition works against any backend.

### Codelist & code_type

- A **Codelist** maps code types (vocabularies like ICD10CM, CPT4, RxNorm) to lists of codes.
- Codelists can be provided **inline** as a dict (`"codelist": {"ICD10CM": [...]}`) or **by reference** as a string (`"codelist": "my_codelist_name"`). By-reference codelists are resolved from the codelist store at validation/execution time — use `phenex_find_codelists` to discover available names.
- `use_code_type`: set `True` when the domain table has a CODE_TYPE column; `False` when it doesn't (common with `_SOURCE` domains).
- `remove_punctuation`: set `True` when codelist codes contain dots (e.g., `I48.0`) but the database stores them without (`I480`).
- **Always inspect the target table** with `snowflake_get_table_columns` and `snowflake_get_distinct_values` before choosing these settings.

### Domains

Common OMOP domains:

- `CONDITION_OCCURRENCE` / `CONDITION_OCCURRENCE_SOURCE` — diagnoses
- `DRUG_EXPOSURE` / `DRUG_EXPOSURE_SOURCE` — medications
- `PROCEDURE_OCCURRENCE` / `PROCEDURE_OCCURRENCE_SOURCE` — procedures
- `MEASUREMENT` — lab values, vitals
- `PERSON` — demographics
- `DEATH` — mortality

### Time Ranges

Phenotypes can have `relative_time_range` to restrict events to a window relative to an anchor (e.g., the index date). Negative days = before, positive = after.

## Workflow

1. **Explore data** — find the right database, schema, and tables
2. **Inspect tables** — check column names, code formats, code types
3. **List phenotypes** — see what building blocks are available
4. **Build cohort** — write PhenEx Python code; show it to the user for review
5. **Validate** — translate to JSON and run `phenex_validate_cohort` to catch errors
6. **Execute** — run `phenex_execute_cohort` with `validate_only=False`
7. **Generate .py file** — save the final cohort as a standalone Python script the user can keep and re-run

## Important Notes

- Always verify `use_code_type` and `remove_punctuation` by inspecting real data.
- The JSON format is an internal representation — present PhenEx Python code to users.
- Cohort logic is backend-agnostic; only the connector and data exploration tools are backend-specific.
- When in doubt, validate first. Validation compiles the definition with `from_dict()` without hitting the database.
