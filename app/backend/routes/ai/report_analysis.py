"""AI-powered report analysis endpoint.

Reads frozen cohort definitions and table1 data from the run directory,
strips large fields (codelists, value_distributions), then sends the
compact summaries to Azure OpenAI for comparative analysis.
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import report_storage as storage

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Load environment ─────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv

    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass


# ── Helpers ──────────────────────────────────────────────────────────────


def _strip_codelists(obj: Any) -> Any:
    """Recursively remove 'codelist' and 'value_distributions' keys."""
    if isinstance(obj, dict):
        return {
            k: _strip_codelists(v)
            for k, v in obj.items()
            if k not in ("codelist", "value_distributions")
        }
    if isinstance(obj, list):
        return [_strip_codelists(v) for v in obj]
    return obj


def _load_frozen_cohort(run_id: str, cohort_name: str) -> Dict[str, Any] | None:
    """Load and strip a frozen cohort JSON, returning None on failure."""
    data = storage.find_frozen_cohort(run_id, cohort_name)
    if data is None:
        return None
    return _strip_codelists(data)


def _load_combined_table1(run_id: str) -> Dict[str, Any]:
    """Load the run-level combined table1 (cohort_name -> table1 data).

    Reports are stored as a single ``combined_table1.json`` at the run level,
    not as per-cohort ``table1.json`` files, so read it once per request.
    """
    data = storage.read_run_file(run_id, "combined_table1.json")
    return data if isinstance(data, dict) else {}


def _table1_summary(table1: Any) -> Dict[str, Any] | None:
    """Extract rows + sections (no distributions) from a cohort's table1 data."""
    if not isinstance(table1, dict):
        return None
    return {
        "rows": table1.get("rows", []),
        "sections": table1.get("sections", {}),
    }


def _get_openai_client():
    """Create an Azure OpenAI client from environment variables."""
    try:
        from openai import AzureOpenAI
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="openai package is not installed",
        )

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("OPENAI_API_VERSION", "2025-01-01-preview")

    if not endpoint or not api_key:
        raise HTTPException(
            status_code=503,
            detail="Azure OpenAI credentials not configured",
        )

    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_key=api_key,
        api_version=api_version,
        http_client=__import__("httpx").Client(verify=False),
    )


# ── Request / Response models ────────────────────────────────────────────


class AnalyzeRequest(BaseModel):
    run_id: str
    cohort_names: List[str]


# ── Endpoint ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a clinical epidemiology expert analyzing baseline characteristics 
from a pharmacoepidemiology study. You are given cohort definitions and table1 
summary statistics for multiple cohorts/subcohorts.

For each phenotype (row) in the table, provide a brief 1-2 sentence analysis 
comparing the cohorts. Focus on:
- Whether differences are clinically meaningful
- Whether results are expected given the cohort definitions  
- Notable outliers or unexpected patterns
- Potential confounders or biases

Return your analysis as a JSON object where keys are the phenotype names 
and values are your analysis text. Only output the JSON object, nothing else."""


@router.post("/report/analyze")
async def analyze_report(request: AnalyzeRequest):
    """Compare selected cohorts using AI analysis.

    Reads frozen cohort definitions and table1 data, sends a compact
    summary to Azure OpenAI, and returns per-phenotype analysis text.
    """
    safe_run = Path(request.run_id).name
    # Validate that the run exists (raises 404 via storage)
    storage.list_cohorts(safe_run)

    combined_table1 = _load_combined_table1(safe_run)

    # Gather data for each cohort
    cohort_summaries = {}
    for name in request.cohort_names:
        safe_name = Path(name).name
        table1 = _table1_summary(combined_table1.get(safe_name))
        if table1:
            cohort_summaries[safe_name] = {
                "definition": _load_frozen_cohort(safe_run, safe_name),
                "table1": table1,
            }

    if not cohort_summaries:
        raise HTTPException(
            status_code=404,
            detail="No valid cohort data found for the requested cohorts",
        )

    # Build the user message
    user_message = json.dumps(cohort_summaries, default=str)

    # Call Azure OpenAI
    client = _get_openai_client()
    model = os.getenv("OPENAI_DEPLOYMENT_NAME", "gpt-4o")

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_completion_tokens=4000,
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or "{}"
        analysis = json.loads(content)
    except json.JSONDecodeError:
        analysis = {"_raw": content}
    except Exception as e:
        logger.error("Azure OpenAI call failed: %s", e)
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    return {
        "analysis": analysis,
        "cohorts_analyzed": list(cohort_summaries.keys()),
    }
