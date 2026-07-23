import json
import logging
from typing import Literal
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..utils.constants import resolve_constants_in_cohort

router = APIRouter()
logger = logging.getLogger(__name__)


def _generate_python_code(study: dict, cohorts: list[dict]) -> str:
    """Generate a Python script (.py) for the study."""

    lines = []

    # Header
    lines.append('"""')
    lines.append(f"Study: {study['name']}")
    if study.get("description"):
        lines.append(f"\n{study['description']}")
    lines.append(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append('"""')
    lines.append("")

    # Imports
    lines.append("# Import PhenEx library")
    lines.append("from phenex import Cohort")
    lines.append("from phenex.phenotypes import (")
    lines.append("    CodelistPhenotype,")
    lines.append("    AgePhenotype,")
    lines.append("    DeathPhenotype,")
    lines.append("    CategoricalPhenotype,")
    lines.append("    MeasurementPhenotype,")
    lines.append("    TimeRangePhenotype,")
    lines.append("    EventCountPhenotype,")
    lines.append("    LogicPhenotype,")
    lines.append(")")
    lines.append("from phenex.codelists import Codelist")
    lines.append("from phenex.filters import (")
    lines.append("    RelativeTimeRange,")
    lines.append("    ValueFilter,")
    lines.append("    CategoricalFilter,")
    lines.append(")")
    lines.append("")

    # Database configuration
    if study.get("database"):
        lines.append("# Database Configuration")
        lines.append("DATABASE_CONFIG = {")
        for key, value in study["database"].items():
            lines.append(
                f'    "{key}": {json.dumps(value, indent=4).replace(chr(10), chr(10) + "    ")},'
            )
        lines.append("}")
        lines.append("")

    # Baseline characteristics
    if study.get("baseline_characteristics"):
        lines.append("# Baseline Characteristics Configuration")
        lines.append(
            f'BASELINE_CHARACTERISTICS = {json.dumps(study["baseline_characteristics"], indent=4)}'
        )
        lines.append("")

    # Outcomes
    if study.get("outcomes"):
        lines.append("# Outcomes Configuration")
        lines.append(f'OUTCOMES = {json.dumps(study["outcomes"], indent=4)}')
        lines.append("")

    lines.append(
        "# ============================================================================"
    )
    lines.append("# Cohort Definitions")
    lines.append(
        "# ============================================================================"
    )
    lines.append("")

    # Generate each cohort
    for i, cohort in enumerate(cohorts):
        cohort_data = cohort.get("cohort_data", {})
        phenotypes = cohort_data.get("phenotypes", [])

        lines.append(f'# Cohort {i + 1}: {cohort["name"]}')
        if cohort.get("description"):
            lines.append(f'# {cohort["description"]}')
        lines.append("")

        # Organize phenotypes by type
        entry_phenotypes = [p for p in phenotypes if p.get("type") == "entry"]
        inclusion_phenotypes = [p for p in phenotypes if p.get("type") == "inclusion"]
        exclusion_phenotypes = [p for p in phenotypes if p.get("type") == "exclusion"]
        baseline_phenotypes = [p for p in phenotypes if p.get("type") == "baseline"]
        outcome_phenotypes = [p for p in phenotypes if p.get("type") == "outcome"]

        # Generate phenotype definitions
        def generate_phenotype(pheno: dict, var_prefix: str) -> tuple[str, str]:
            """Generate code for a phenotype. Returns (variable_name, code_lines)."""
            pheno_id = pheno.get("id", "").replace("-", "_")
            var_name = f"{var_prefix}_{pheno_id}"
            class_name = pheno.get("class_name", "CodelistPhenotype")

            code_lines = []
            code_lines.append(f"{var_name} = {class_name}(")
            code_lines.append(f'    name="{pheno.get("name", "")}",')

            if pheno.get("domain"):
                code_lines.append(f'    domain="{pheno["domain"]}",')

            if pheno.get("return_date"):
                code_lines.append(f'    return_date="{pheno["return_date"]}",')

            # Codelist (for CodelistPhenotype)
            if pheno.get("codelist"):
                codelist = pheno["codelist"]
                # Handle both dict and string formats
                if isinstance(codelist, dict) and codelist.get("codelist"):
                    codes = codelist["codelist"]
                    # Format codes nicely
                    if isinstance(codes, dict):
                        # Pretty print the codelist
                        codes_json = json.dumps(codes, indent=4)
                        # Indent properly for nested structure
                        indented_codes = "\n        ".join(codes_json.split("\n"))
                        code_lines.append(f"    codelist=Codelist(")
                        code_lines.append(f"        {indented_codes},")
                        code_lines.append(f"    ),")
                    else:
                        code_lines.append(f"    codelist={codes},")
                elif isinstance(codelist, str):
                    # If codelist is directly a string (e.g., a reference or ID)
                    code_lines.append(f'    codelist="{codelist}",')

            # Value filter (for AgePhenotype, MeasurementPhenotype)
            if pheno.get("value_filter"):
                value_filter = pheno["value_filter"]
                # Convert list to dict if needed (take first element)
                if isinstance(value_filter, list):
                    if len(value_filter) > 0:
                        value_filter = value_filter[0]
                    else:
                        value_filter = None

                if value_filter and isinstance(value_filter, dict):
                    code_lines.append(f"    value_filter=ValueFilter(")
                    if value_filter.get("column_name"):
                        code_lines.append(
                            f'        column_name="{value_filter["column_name"]}",'
                        )
                    if value_filter.get("min_value"):
                        min_val = value_filter["min_value"]
                        if (
                            isinstance(min_val, dict)
                            and min_val.get("value") is not None
                        ):
                            code_lines.append(f'        min_value={min_val["value"]},')
                    if value_filter.get("max_value"):
                        max_val = value_filter["max_value"]
                        if (
                            isinstance(max_val, dict)
                            and max_val.get("value") is not None
                        ):
                            code_lines.append(f'        max_value={max_val["value"]},')
                    code_lines.append(f"    ),")

            # Categorical filter (for CategoricalPhenotype)
            if pheno.get("categorical_filter"):
                cat_filter = pheno["categorical_filter"]
                # Convert list to dict if needed (take first element)
                if isinstance(cat_filter, list):
                    if len(cat_filter) > 0:
                        cat_filter = cat_filter[0]
                    else:
                        cat_filter = None

                if cat_filter and isinstance(cat_filter, dict):
                    code_lines.append(f"    categorical_filter=CategoricalFilter(")
                    if cat_filter.get("column_name"):
                        code_lines.append(
                            f'        column_name="{cat_filter["column_name"]}",'
                        )
                    if cat_filter.get("operator"):
                        code_lines.append(
                            f'        operator="{cat_filter["operator"]}",'
                        )
                    if cat_filter.get("values"):
                        code_lines.append(f'        values={cat_filter["values"]},')
                    code_lines.append(f"    ),")

            # Time range - handle both list and dict formats
            if pheno.get("relative_time_range"):
                time_range = pheno["relative_time_range"]
                # Convert list to dict if needed (take first element)
                if isinstance(time_range, list):
                    if len(time_range) > 0:
                        time_range = time_range[0]
                    else:
                        time_range = None

                if time_range and isinstance(time_range, dict):
                    code_lines.append(f"    relative_time_range=RelativeTimeRange(")
                    if time_range.get("when"):
                        code_lines.append(f'        when="{time_range["when"]}",')
                    if time_range.get("min_days"):
                        min_days = time_range["min_days"]
                        if (
                            isinstance(min_days, dict)
                            and min_days.get("value") is not None
                        ):
                            code_lines.append(f'        min_days={min_days["value"]},')
                    if time_range.get("max_days"):
                        max_days = time_range["max_days"]
                        if (
                            isinstance(max_days, dict)
                            and max_days.get("value") is not None
                        ):
                            code_lines.append(f'        max_days={max_days["value"]},')
                    code_lines.append(f"    ),")

            code_lines.append(")")
            return var_name, "\n".join(code_lines)

        # Generate entry criterion
        entry_vars = []
        if entry_phenotypes:
            lines.append("# Entry Criterion (Index Date)")
            for pheno in entry_phenotypes:
                var_name, code = generate_phenotype(pheno, "entry")
                entry_vars.append(var_name)
                lines.append(code)
                lines.append("")

        # Generate inclusions
        inclusion_vars = []
        if inclusion_phenotypes:
            lines.append("# Inclusion Criteria")
            for pheno in inclusion_phenotypes:
                var_name, code = generate_phenotype(pheno, "inclusion")
                inclusion_vars.append(var_name)
                lines.append(code)
                lines.append("")

        # Generate exclusions
        exclusion_vars = []
        if exclusion_phenotypes:
            lines.append("# Exclusion Criteria")
            for pheno in exclusion_phenotypes:
                var_name, code = generate_phenotype(pheno, "exclusion")
                exclusion_vars.append(var_name)
                lines.append(code)
                lines.append("")

        # Generate baseline
        baseline_vars = []
        if baseline_phenotypes:
            lines.append("# Baseline Characteristics")
            for pheno in baseline_phenotypes:
                var_name, code = generate_phenotype(pheno, "baseline")
                baseline_vars.append(var_name)
                lines.append(code)
                lines.append("")

        # Generate outcomes
        outcome_vars = []
        if outcome_phenotypes:
            lines.append("# Outcome Measures")
            for pheno in outcome_phenotypes:
                var_name, code = generate_phenotype(pheno, "outcome")
                outcome_vars.append(var_name)
                lines.append(code)
                lines.append("")

        # Create cohort instance
        cohort_var = f"cohort_{i + 1}"
        lines.append(f"# Create cohort instance")
        lines.append(f"{cohort_var} = Cohort(")
        lines.append(f'    name="{cohort["name"]}",')
        if cohort.get("description"):
            lines.append(f'    description="{cohort["description"]}",')

        if entry_vars:
            lines.append(f"    entry_criterion={entry_vars[0]},")

        if inclusion_vars:
            if len(inclusion_vars) == 1:
                lines.append(f"    inclusions={inclusion_vars[0]},")
            else:
                lines.append(f"    inclusions=[")
                for var in inclusion_vars:
                    lines.append(f"        {var},")
                lines.append(f"    ],")

        if exclusion_vars:
            if len(exclusion_vars) == 1:
                lines.append(f"    exclusions={exclusion_vars[0]},")
            else:
                lines.append(f"    exclusions=[")
                for var in exclusion_vars:
                    lines.append(f"        {var},")
                lines.append(f"    ],")

        lines.append(")")
        lines.append("")
        lines.append("")

    # Footer with execution example
    lines.append(
        "# ============================================================================"
    )
    lines.append("# Execution Example")
    lines.append(
        "# ============================================================================"
    )
    lines.append("")
    lines.append('if __name__ == "__main__":')
    lines.append("    # Execute cohorts")
    lines.append("    # Note: Configure your database connection first")
    lines.append("    ")
    for i in range(len(cohorts)):
        cohort_var = f"cohort_{i + 1}"
        lines.append(f"    # Execute {cohort_var}")
        lines.append(f"    # results_{i + 1} = {cohort_var}.execute(database)")
    lines.append("    ")
    lines.append("    pass")
    lines.append("")

    return "\n".join(lines)


def _generate_notebook(study: dict, cohorts: list[dict]) -> dict:
    """Generate a Jupyter notebook (.ipynb) for the study."""

    cells = []

    # Title cell
    title_md = f"# {study['name']}\n\n"
    if study.get("description"):
        title_md += f"{study['description']}\n\n"
    title_md += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    cells.append(
        {"cell_type": "markdown", "metadata": {}, "source": title_md.split("\n")}
    )

    # Imports cell
    imports_code = """# Import PhenEx library
from phenex import Cohort
from phenex.phenotypes import (
    CodelistPhenotype,
    AgePhenotype,
    DeathPhenotype,
    CategoricalPhenotype,
    MeasurementPhenotype,
    TimeRangePhenotype,
    EventCountPhenotype,
    LogicPhenotype,
)
from phenex.codelists import Codelist
from phenex.filters import (
    RelativeTimeRange,
    ValueFilter,
    CategoricalFilter,
)
import pandas as pd"""

    cells.append(
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": imports_code.split("\n"),
        }
    )

    # Database configuration cell
    if study.get("database"):
        db_md = "## Database Configuration"
        cells.append({"cell_type": "markdown", "metadata": {}, "source": [db_md]})

        db_code = f"DATABASE_CONFIG = {json.dumps(study['database'], indent=4)}"
        cells.append(
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": db_code.split("\n"),
            }
        )

    # Study configuration cell
    if study.get("baseline_characteristics") or study.get("outcomes"):
        config_md = "## Study Configuration"
        cells.append({"cell_type": "markdown", "metadata": {}, "source": [config_md]})

        config_lines = []
        if study.get("baseline_characteristics"):
            config_lines.append(
                f"BASELINE_CHARACTERISTICS = {json.dumps(study['baseline_characteristics'], indent=4)}"
            )
        if study.get("outcomes"):
            if config_lines:
                config_lines.append("")
            config_lines.append(f"OUTCOMES = {json.dumps(study['outcomes'], indent=4)}")

        cells.append(
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": config_lines,
            }
        )

    # Helper function to generate phenotype code (reuse from _generate_python_code)
    def generate_phenotype_for_notebook(
        pheno: dict, var_prefix: str
    ) -> tuple[str, list[str]]:
        """Generate code for a phenotype. Returns (variable_name, code_lines_list)."""
        pheno_id = pheno.get("id", "").replace("-", "_")
        var_name = f"{var_prefix}_{pheno_id}"
        class_name = pheno.get("class_name", "CodelistPhenotype")

        code_lines = []
        code_lines.append(f"{var_name} = {class_name}(")
        code_lines.append(f'    name="{pheno.get("name", "")}",')

        if pheno.get("domain"):
            code_lines.append(f'    domain="{pheno["domain"]}",')

        if pheno.get("return_date"):
            code_lines.append(f'    return_date="{pheno["return_date"]}",')

        # Codelist
        if pheno.get("codelist"):
            codelist = pheno["codelist"]
            # Handle both dict and string formats
            if isinstance(codelist, dict) and codelist.get("codelist"):
                codes = codelist["codelist"]
                if isinstance(codes, dict):
                    codes_json = json.dumps(codes, indent=4)
                    indented_codes = "\n        ".join(codes_json.split("\n"))
                    code_lines.append(f"    codelist=Codelist(")
                    code_lines.append(f"        {indented_codes},")
                    code_lines.append(f"    ),")
                else:
                    code_lines.append(f"    codelist={codes},")
            elif isinstance(codelist, str):
                # If codelist is directly a string (e.g., a reference or ID)
                code_lines.append(f'    codelist="{codelist}",')

        # Value filter
        if pheno.get("value_filter"):
            value_filter = pheno["value_filter"]
            code_lines.append(f"    value_filter=ValueFilter(")
            if value_filter.get("column_name"):
                code_lines.append(
                    f'        column_name="{value_filter["column_name"]}",'
                )
            if value_filter.get("min_value"):
                min_val = value_filter["min_value"]
                if isinstance(min_val, dict) and min_val.get("value") is not None:
                    code_lines.append(f'        min_value={min_val["value"]},')
            if value_filter.get("max_value"):
                max_val = value_filter["max_value"]
                if isinstance(max_val, dict) and max_val.get("value") is not None:
                    code_lines.append(f'        max_value={max_val["value"]},')
            code_lines.append(f"    ),")

        # Categorical filter
        if pheno.get("categorical_filter"):
            cat_filter = pheno["categorical_filter"]
            code_lines.append(f"    categorical_filter=CategoricalFilter(")
            if cat_filter.get("column_name"):
                code_lines.append(f'        column_name="{cat_filter["column_name"]}",')
            if cat_filter.get("operator"):
                code_lines.append(f'        operator="{cat_filter["operator"]}",')
            if cat_filter.get("values"):
                code_lines.append(f'        values={cat_filter["values"]},')
            code_lines.append(f"    ),")

        # Time range
        if pheno.get("relative_time_range"):
            time_range = pheno["relative_time_range"]
            if isinstance(time_range, list):
                if len(time_range) > 0:
                    time_range = time_range[0]
                else:
                    time_range = None

            if time_range and isinstance(time_range, dict):
                code_lines.append(f"    relative_time_range=RelativeTimeRange(")
                if time_range.get("when"):
                    code_lines.append(f'        when="{time_range["when"]}",')
                if time_range.get("min_days"):
                    min_days = time_range["min_days"]
                    if isinstance(min_days, dict) and min_days.get("value") is not None:
                        code_lines.append(f'        min_days={min_days["value"]},')
                if time_range.get("max_days"):
                    max_days = time_range["max_days"]
                    if isinstance(max_days, dict) and max_days.get("value") is not None:
                        code_lines.append(f'        max_days={max_days["value"]},')
                code_lines.append(f"    ),")

        code_lines.append(")")
        return var_name, code_lines

    # Each cohort gets its own section
    for i, cohort in enumerate(cohorts):
        cohort_data = cohort.get("cohort_data", {})
        phenotypes = cohort_data.get("phenotypes", [])

        # Cohort header
        cohort_md = f"## Cohort {i + 1}: {cohort['name']}\n\n"
        if cohort.get("description"):
            cohort_md += f"{cohort['description']}"

        cells.append(
            {"cell_type": "markdown", "metadata": {}, "source": cohort_md.split("\n")}
        )

        # Organize phenotypes by type
        entry_phenotypes = [p for p in phenotypes if p.get("type") == "entry"]
        inclusion_phenotypes = [p for p in phenotypes if p.get("type") == "inclusion"]
        exclusion_phenotypes = [p for p in phenotypes if p.get("type") == "exclusion"]
        baseline_phenotypes = [p for p in phenotypes if p.get("type") == "baseline"]
        outcome_phenotypes = [p for p in phenotypes if p.get("type") == "outcome"]

        # Generate all phenotype code
        all_code_lines = []
        entry_vars = []
        inclusion_vars = []
        exclusion_vars = []

        # Entry phenotypes
        if entry_phenotypes:
            all_code_lines.append("# Entry Criterion (Index Date)")
            for pheno in entry_phenotypes:
                var_name, code = generate_phenotype_for_notebook(pheno, "entry")
                entry_vars.append(var_name)
                all_code_lines.extend(code)
                all_code_lines.append("")

        # Inclusion phenotypes
        if inclusion_phenotypes:
            all_code_lines.append("# Inclusion Criteria")
            for pheno in inclusion_phenotypes:
                var_name, code = generate_phenotype_for_notebook(pheno, "inclusion")
                inclusion_vars.append(var_name)
                all_code_lines.extend(code)
                all_code_lines.append("")

        # Exclusion phenotypes
        if exclusion_phenotypes:
            all_code_lines.append("# Exclusion Criteria")
            for pheno in exclusion_phenotypes:
                var_name, code = generate_phenotype_for_notebook(pheno, "exclusion")
                exclusion_vars.append(var_name)
                all_code_lines.extend(code)
                all_code_lines.append("")

        # Create cohort instance
        cohort_var = f"cohort_{i + 1}"
        all_code_lines.append(f"# Create cohort instance")
        all_code_lines.append(f"{cohort_var} = Cohort(")
        all_code_lines.append(f'    name="{cohort["name"]}",')
        if cohort.get("description"):
            all_code_lines.append(f'    description="{cohort["description"]}",')

        if entry_vars:
            all_code_lines.append(f"    entry_criterion={entry_vars[0]},")

        if inclusion_vars:
            if len(inclusion_vars) == 1:
                all_code_lines.append(f"    inclusions={inclusion_vars[0]},")
            else:
                all_code_lines.append(f"    inclusions=[")
                for var in inclusion_vars:
                    all_code_lines.append(f"        {var},")
                all_code_lines.append(f"    ],")

        if exclusion_vars:
            if len(exclusion_vars) == 1:
                all_code_lines.append(f"    exclusions={exclusion_vars[0]},")
            else:
                all_code_lines.append(f"    exclusions=[")
                for var in exclusion_vars:
                    all_code_lines.append(f"        {var},")
                all_code_lines.append(f"    ],")

        all_code_lines.append(")")

        cells.append(
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": all_code_lines,
            }
        )

        # Add execution cell
        exec_code = f"# Execute {cohort_var}\n# results_{i + 1} = {cohort_var}.execute(database)\n# print(f'Cohort size: {{len(results_{i + 1})}}')"
        cells.append(
            {
                "cell_type": "code",
                "execution_count": None,
                "metadata": {},
                "outputs": [],
                "source": exec_code.split("\n"),
            }
        )

    # Summary cell
    summary_md = "## Results Summary\n\nAnalyze your cohort execution results here."
    cells.append(
        {"cell_type": "markdown", "metadata": {}, "source": summary_md.split("\n")}
    )

    cells.append(
        {
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": [
                "# Display summary statistics",
                "# df = pd.DataFrame(...)",
                "# df.describe()",
            ],
        }
    )

    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
            "language_info": {"name": "python", "version": "3.11.0"},
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }

    return notebook


@router.get("/study/{study_id}/export", tags=["study export"])
async def export_study(
    request: Request, study_id: str, format: Literal["py", "ipynb"] = "py"
):
    """
    Export a study to Python (.py) or Jupyter Notebook (.ipynb) format.

    Query Parameters:
    - format: "py" for Python script, "ipynb" for Jupyter notebook (default: "py")

    Returns:
    - File download with study code

    Raises:
    - 401: If user is not authenticated
    - 404: If study not found or user has no access
    - 400: If invalid format specified
    """
    user_id = get_authenticated_user_id(request)

    # Validate format
    if format not in ["py", "ipynb"]:
        raise HTTPException(
            status_code=400, detail="Invalid format. Must be 'py' or 'ipynb'"
        )

    # Get study
    study = await db_manager.get_study_for_user(user_id, study_id)
    if not study:
        raise HTTPException(status_code=404, detail="Study not found")

    # Get cohorts
    cohorts = await db_manager.get_cohorts_for_study(study_id, user_id)
    if not cohorts:
        logger.warning(f"Study {study_id} has no cohorts to export")
        cohorts = []

    # Get constants to resolve references
    constants = await db_manager.get_constants_for_study(study_id, user_id)

    # Load full cohort data
    full_cohorts = []
    for c in cohorts:
        cohort_dict = await db_manager.get_cohort_for_user(user_id, c["id"])
        if cohort_dict and "cohort_data" in cohort_dict:
            # Resolve constants before exporting
            resolved_data = resolve_constants_in_cohort(
                cohort_dict["cohort_data"], constants
            )
            cohort_dict["cohort_data"] = resolved_data
            full_cohorts.append(cohort_dict)

    # Generate file content
    # Sanitize filename - remove special characters that could cause issues
    safe_study_name = study["name"].replace(" ", "_")
    # Remove or replace problematic characters
    safe_study_name = "".join(
        c if c.isalnum() or c in ("_", "-") else "_" for c in safe_study_name
    )

    if format == "py":
        content = _generate_python_code(study, full_cohorts)
        media_type = "text/x-python; charset=utf-8"
        filename = f"{safe_study_name}_{study_id}.py"
        # Encode to bytes with UTF-8
        content_bytes = content.encode("utf-8")
    else:  # ipynb
        notebook = _generate_notebook(study, full_cohorts)
        content = json.dumps(notebook, indent=2, ensure_ascii=False)
        media_type = "application/x-ipynb+json; charset=utf-8"
        filename = f"{safe_study_name}_{study_id}.ipynb"
        # Encode to bytes with UTF-8
        content_bytes = content.encode("utf-8")

    # Return as downloadable file
    return Response(
        content=content_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
