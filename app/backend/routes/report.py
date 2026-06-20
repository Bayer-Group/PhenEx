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
def list_runs() -> List[str]:
    """Return the names of available run directories (timestamp folders)."""
    return storage.list_runs()


# ── List files in a run directory (debug) ────────────────────────────────

@router.get("/report/runs/{run_id}/files")
def list_run_files(run_id: str) -> List[str]:
    """Return filenames (non-directory) at the run level.  Useful for debugging."""
    return storage.list_run_files(run_id)


# ── List cohorts inside a run ────────────────────────────────────────────


@router.get("/report/runs/{run_id}/cohorts")
def list_cohorts(run_id: str) -> List[str]:
    """Return cohort directory names within a run."""
    return storage.list_cohorts(run_id)


# ── Run metadata ─────────────────────────────────────────────────────────


@router.get("/report/runs/{run_id}/info")
def get_run_info(run_id: str) -> Dict[str, str]:
    """Return the info.txt content as key-value pairs."""
    return storage.read_info(run_id)


# ── Table1 data (rows + sections, no distributions) ─────────────────────


@router.get("/report/runs/{run_id}/cohorts/{cohort_name}/table1")
def get_table1(
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
        "kdes": data.get("kdes", {}),
    })


# ── Value distributions (lazy-loaded per variable) ───────────────────────


@router.get("/report/runs/{run_id}/cohorts/{cohort_name}/table1/distributions")
def get_distributions(
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
            raise HTTPException(
                status_code=404, detail=f"Variable '{variable}' not found"
            )
        return _nan_to_none({variable: distributions[variable]})

    return _nan_to_none(distributions)


# ── Combined frozen cohort definitions ──────────────────────────────────

@router.get("/report/runs/{run_id}/frozen_cohorts_combined")
def get_frozen_cohorts_combined(run_id: str) -> list:
    """Return the combined list of frozen cohort definitions (codelists stripped).

    Reads ``combined_frozen_cohorts.json`` from the run directory, produced by
    the ``report_concatenator.py`` script.  Returns an empty list if not found.
    """
    data = storage.read_run_file(run_id, "combined_frozen_cohorts.json")
    if data is None:
        return []
    return _nan_to_none(data)


# ── Combined waterfall (all cohorts in one file) ─────────────────────────

@router.get("/report/runs/{run_id}/waterfall_combined")
def get_waterfall_combined(run_id: str) -> Dict[str, Any]:
    """Return combined waterfall data for all cohorts in a single response.

    Reads ``combined_waterfall.json`` from the run directory, produced by
    the ``report_concatenator.py`` script.
    """
    data = storage.read_run_file(run_id, "combined_waterfall.json")
    if data is None:
        raise HTTPException(status_code=404, detail="combined_waterfall.json not found")
    return _nan_to_none(data)


# ── Combined KDE distributions (all cohorts in one file) ─────────────────

@router.get("/report/runs/{run_id}/kde_combined")
def get_kde_combined(
    run_id: str,
    report: str = Query("table1", regex=r"^table1(_outcomes)?$"),
) -> Dict[str, Any]:
    """Return combined KDE distributions for all cohorts.

    Reads ``combined_<report>_value_distributions.json`` from the run directory.
    Returns an empty dict if not found.
    """
    filename = f"{report}_value_distributions.json"
    data = storage.read_run_file(run_id, filename)
    if data is None:
        return {}
    return _nan_to_none(data)


# ── Combined table1 (all cohorts in one file) ────────────────────────────

@router.get("/report/runs/{run_id}/table1_combined")
def get_table1_combined(
    run_id: str,
    report: str = Query("table1", regex=r"^table1(_outcomes)?$"),
) -> Dict[str, Any]:
    """Return combined table1 data for all cohorts in a single response.

    Reads ``combined_<report>.json`` from the run directory (produced by
    ``report_concatenator.py``).
    """
    filename = f"combined_{report}.json"
    logger.info("get_table1_combined: run_id=%r filename=%r", run_id, filename)
    try:
        combined = storage.read_run_file(run_id, filename)
    except Exception as e:
        logger.exception("get_table1_combined: error reading %s", filename)
        raise HTTPException(status_code=500, detail=f"Error reading {filename}: {e}")
    if combined is None:
        raise HTTPException(status_code=404, detail=f"'{filename}' not found for run '{run_id}'")
    return _nan_to_none(combined)


# ── Combined Table2 (incidence rates, all cohorts) ───────────────────────

@router.get("/report/runs/{run_id}/table2_combined")
def get_table2_combined(run_id: str) -> Dict[str, Any]:
    """Return combined Table2 incidence-rate data for all cohorts.

    Reads ``combined_Table2.json`` produced by ``report_concatenator.py``.
    Returns an empty dict if not found.
    """
    data = storage.read_run_file(run_id, "combined_Table2.json")
    if data is None:
        return {}
    return _nan_to_none(data)


# ── Combined TimeToEvent (Kaplan–Meier, all cohorts) ─────────────────────

@router.get("/report/runs/{run_id}/time_to_event_combined")
def get_time_to_event_combined(run_id: str) -> Dict[str, Any]:
    """Return combined time-to-event (KM) data for all cohorts.

    Reads ``combined_TimeToEvent.json`` produced by ``report_concatenator.py``.
    Returns an empty dict if not found.
    """
    data = storage.read_run_file(run_id, "combined_TimeToEvent.json")
    if data is None:
        return {}
    return _nan_to_none(data)


@router.get("/report/runs/{run_id}/study_registry")
def get_study_registry(run_id: str) -> Dict[str, Any]:
    """Return the study registry (row metadata and comments).

    Reads ``study_registry.json`` produced by ``study_registry_generator.py``.
    Returns an empty dict if not found.
    """
    data = storage.read_run_file(run_id, "study_registry.json")
    if data is None:
        return {}
    return data


@router.get("/report/runs/{run_id}/cohort_descriptions")
def get_cohort_descriptions(run_id: str) -> Dict[str, Any]:
    """Return cohort descriptions (display names and descriptions).

    Reads ``cohort_descriptions.json`` from the run directory.
    Returns an empty dict if not found.
    """
    data = storage.read_run_file(run_id, "cohort_descriptions.json")
    if data is None:
        return {}
    return data


@router.get("/report/runs/{run_id}/reports")
def get_reports(run_id: str) -> Dict[str, Any]:
    """Return reports definitions.

    Reads ``reports.json`` from the run directory.
    Returns ``{"reports": []}`` if not found.
    """
    data = storage.read_run_file(run_id, "reports.json")
    if data is None:
        return {"reports": []}
    return data
