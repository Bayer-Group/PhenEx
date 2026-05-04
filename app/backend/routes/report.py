"""API routes for serving PhenEx study report data.

Serves table1 / table1_outcomes JSON files produced by the PhenEx Study
class from the on-disk data directory.  Designed so the frontend can
eventually swap the base URL to an external hosting location.
"""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _resolve_run_dir(run_id: str) -> Path:
    """Return the run directory, raising 404 if it doesn't exist."""
    # Sanitise to prevent path traversal
    safe = Path(run_id).name
    run_dir = DATA_DIR / safe
    if not run_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Run '{safe}' not found")
    return run_dir


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
    if not DATA_DIR.is_dir():
        return []
    return sorted(
        d.name for d in DATA_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    )


# ── List cohorts inside a run ────────────────────────────────────────────

@router.get("/report/runs/{run_id}/cohorts")
async def list_cohorts(run_id: str) -> List[str]:
    """Return cohort directory names within a run."""
    run_dir = _resolve_run_dir(run_id)
    return sorted(
        d.name for d in run_dir.iterdir()
        if d.is_dir()
    )


# ── Run metadata ─────────────────────────────────────────────────────────

@router.get("/report/runs/{run_id}/info")
async def get_run_info(run_id: str) -> Dict[str, str]:
    """Return the info.txt content as key-value pairs."""
    run_dir = _resolve_run_dir(run_id)
    info_file = run_dir / "info.txt"
    if not info_file.is_file():
        return {}
    result: Dict[str, str] = {}
    for line in info_file.read_text().splitlines():
        if ":" in line and not line.startswith("="):
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip()
            if key and value:
                result[key] = value
    return result


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
    run_dir = _resolve_run_dir(run_id)
    cohort_dir = run_dir / Path(cohort_name).name
    if not cohort_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Cohort '{cohort_name}' not found")

    json_file = cohort_dir / f"{report}.json"
    if not json_file.is_file():
        raise HTTPException(status_code=404, detail=f"'{report}.json' not found in cohort")

    try:
        with json_file.open() as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading report: {e}")

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
    run_dir = _resolve_run_dir(run_id)
    cohort_dir = run_dir / Path(cohort_name).name
    if not cohort_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Cohort '{cohort_name}' not found")

    json_file = cohort_dir / f"{report}.json"
    if not json_file.is_file():
        raise HTTPException(status_code=404, detail=f"'{report}.json' not found")

    try:
        with json_file.open() as f:
            data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading report: {e}")

    distributions = data.get("value_distributions", {})

    if variable is not None:
        if variable not in distributions:
            raise HTTPException(status_code=404, detail=f"Variable '{variable}' not found")
        return _nan_to_none({variable: distributions[variable]})

    return _nan_to_none(distributions)
