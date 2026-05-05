"""API routes for serving PhenEx study report data.

Serves table1 / table1_outcomes JSON files produced by the PhenEx Study
class.  Data is read from S3 when ``REPORT_S3_BUCKET`` is set, otherwise
from the local ``data/`` directory.
"""

import math
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
import logging

from . import report_storage as storage

router = APIRouter()
logger = logging.getLogger(__name__)


def _nan_to_none(obj: Any) -> Any:
    """Recursively replace NaN/Inf floats with None for JSON serialisation."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _nan_to_none(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_nan_to_none(v) for v in obj]
    return obj


# ── List available runs ──────────────────────────────────────────────────

@router.get("/report/runs")
async def list_runs() -> List[str]:
    """Return the names of available run directories (timestamp folders)."""
    return storage.list_runs()


# ── List cohorts inside a run ────────────────────────────────────────────

@router.get("/report/runs/{run_id}/cohorts")
async def list_cohorts(run_id: str) -> List[str]:
    """Return cohort directory names within a run."""
    return storage.list_cohorts(run_id)


# ── Run metadata ─────────────────────────────────────────────────────────

@router.get("/report/runs/{run_id}/info")
async def get_run_info(run_id: str) -> Dict[str, str]:
    """Return the info.txt content as key-value pairs."""
    return storage.read_info(run_id)


# ── Table1 data (rows + sections, no distributions) ─────────────────────

@router.get("/report/runs/{run_id}/cohorts/{cohort_name}/table1")
async def get_table1(
    run_id: str,
    cohort_name: str,
    report: str = Query("table1", regex=r"^table1(_outcomes)?$"),
) -> Dict[str, Any]:
    """Return table1 rows and sections for a single cohort.

    Use ``?report=table1_outcomes`` for the outcomes table.
    Excludes value_distributions to keep the payload small.
    """
    data = storage.read_json(run_id, cohort_name, f"{report}.json")
    return _nan_to_none({
        "rows": data.get("rows", []),
        "sections": data.get("sections", {}),
    })


# ── Value distributions (lazy-loaded per variable) ───────────────────────

@router.get("/report/runs/{run_id}/cohorts/{cohort_name}/table1/distributions")
async def get_distributions(
    run_id: str,
    cohort_name: str,
    variable: Optional[str] = Query(None),
    report: str = Query("table1", regex=r"^table1(_outcomes)?$"),
) -> Dict[str, Any]:
    """Return value distributions for numeric variables.

    If ``variable`` is given, only that variable's distribution is returned.
    Otherwise returns a dict mapping variable name → list of values.
    """
    # Prefer the dedicated distributions file; fall back to the legacy
    # embedded key for older runs that haven't been re-exported yet.
    try:
        distributions = storage.read_json(
            run_id, cohort_name, f"{report}_value_distributions.json"
        )
    except HTTPException:
        data = storage.read_json(run_id, cohort_name, f"{report}.json")
        distributions = data.get("value_distributions", {})

    if variable is not None:
        if variable not in distributions:
            raise HTTPException(status_code=404, detail=f"Variable '{variable}' not found")
        return _nan_to_none({variable: distributions[variable]})

    return _nan_to_none(distributions)


# ── Combined table1 (all cohorts in one file) ────────────────────────────

@router.get("/report/runs/{run_id}/table1_combined")
async def get_table1_combined(
    run_id: str,
    report: str = Query("table1", regex=r"^table1(_outcomes)?$"),
) -> Dict[str, Any]:
    """Return combined table1 data for all cohorts in a single response.

    Looks for ``combined_<report>.json`` in the run directory.  Falls back
    to loading each cohort's file individually if the combined file is
    missing.
    """
    combined = storage.read_run_file(run_id, f"combined_{report}.json")
    if combined is not None:
        return _nan_to_none(combined)

    # Fallback: build on the fly from individual cohort files
    cohort_names = storage.list_cohorts(run_id)
    result: Dict[str, Any] = {}
    for name in cohort_names:
        try:
            data = storage.read_json(run_id, name, f"{report}.json")
            result[name] = {
                "rows": data.get("rows", []),
                "sections": data.get("sections", {}),
            }
        except Exception:
            pass
    return _nan_to_none(result)
