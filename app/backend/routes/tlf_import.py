"""
TLF Import + review routes.

Entry points:
  1. GET  /studies/private/with-executions   — studies with successful runs (for picker)
  2. POST /study/tlf-import                  — create study from uploaded folder
  3. GET  /study/{study_id}/tlf-manifest     — manifest + per-file descriptions for the
                                               most recent successful execution
"""

import json
import logging
import os
import random
import re
import string
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel

from ..database import db_manager
from ..utils.auth import get_authenticated_user_id
from ..utils import storage

router = APIRouter()
logger = logging.getLogger(__name__)

STUDY_ARTIFACTS_DIR = os.environ.get("STUDY_ARTIFACTS_DIR", "/data/study_artifacts")


# ── Response models ───────────────────────────────────────────────────────────

class StudyWithExecution(BaseModel):
    study_id: str
    study_name: str
    last_execution_id: str
    executed_at: str | None
    manifest_path: str | None


class TLFImportResponse(BaseModel):
    study_id: str
    execution_id: str
    manifest_path: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/studies/private/with-module-status", tags=["study"])
async def get_studies_with_module_status(request: Request):
    """
    Return all user studies enriched with per-module activity status.
    Used to power the study cards on the home page.
    """
    user_id = get_authenticated_user_id(request)
    return await db_manager.get_studies_with_module_status(user_id)


@router.get("/studies/private/with-executions", tags=["tlf"])
async def get_studies_with_successful_executions(request: Request):
    """
    Return the user's studies that have at least one successful execution run.
    Used to populate the "select existing study" dropdown in the TLF intake wizard.
    """
    user_id = get_authenticated_user_id(request)

    rows = await db_manager.get_studies_with_successful_executions(user_id)
    return rows


@router.post("/study/tlf-import", tags=["tlf"])
async def import_tlf_study(
    request: Request,
    files: List[UploadFile] = File(...),
    study_name: str = Form(default=""),
    study_description: str = Form(default=""),
):
    """
    Create a new PhenEx study from an uploaded folder of result files.

    - Accepts a list of files (uploaded as multipart/form-data webkitRelativePath
      or flat list).
    - Creates a stub study record in the DB.
    - Saves the uploaded files under STUDY_ARTIFACTS_DIR/{study_id}/{execution_id}/.
    - Synthesises a manifest.json in the same format produced by a live execution.
    - Creates a study_execution record with status='success' pointing at that manifest.

    Returns study_id, execution_id and manifest_path.
    """
    user_id = get_authenticated_user_id(request)

    study_id = "".join(random.choices(string.ascii_letters + string.digits, k=10))
    execution_id = "".join(random.choices(string.ascii_letters + string.digits, k=10))
    executed_at = datetime.now(timezone.utc).isoformat()

    # Derive a name from the first file's path if none supplied
    if not study_name:
        study_name = _infer_study_name(files)

    # Persist the stub study
    await db_manager.update_study_for_user(
        user_id=user_id,
        study_id=study_id,
        name=study_name,
        description=study_description or f"Imported TLF study — {executed_at[:10]}",
        baseline_characteristics=None,
        outcomes=None,
        database=None,
        visible_by=[],
        is_public=False,
    )

    # Create the execution record upfront (status will be updated to success below)
    await db_manager.save_study_execution(
        execution_id=execution_id,
        study_id=study_id,
        user_id=user_id,
    )

    # Save files and build the manifest — use storage abstraction so this
    # works whether STUDY_ARTIFACTS_DIR is a local path or an s3:// URI.
    exec_dir = storage.join(STUDY_ARTIFACTS_DIR, study_id, execution_id)
    storage.makedirs(exec_dir)

    saved_files: list[str] = []

    for upload in files:
        # Preserve relative directory structure when the browser sends
        # webkitRelativePath via the filename field.
        rel_path = upload.filename or "unknown"
        rel_path = rel_path.lstrip("/").lstrip("\\")

        dest = storage.join(exec_dir, rel_path)
        contents = await upload.read()
        storage.write_bytes(dest, contents)
        saved_files.append(rel_path)

    # Build manifest in the same schema as a live execution
    manifest = {
        "execution_id": execution_id,
        "study_id": study_id,
        "study_name": study_name,
        "executed_at": executed_at,
        "artifacts_dir": exec_dir,
        "files": sorted(saved_files),
        "import_source": "tlf_upload",
    }

    manifest_path = storage.join(exec_dir, "manifest.json")
    storage.write_json(manifest_path, manifest)

    # Mark execution as successful
    await db_manager.update_study_execution(
        execution_id=execution_id,
        status="success",
        manifest_path=manifest_path,
    )

    logger.info(
        f"TLF import: study_id={study_id} execution_id={execution_id} "
        f"files={len(saved_files)} manifest={manifest_path}"
    )

    return TLFImportResponse(
        study_id=study_id,
        execution_id=execution_id,
        manifest_path=manifest_path,
    )


@router.get("/study/{study_id}/tlf-manifest", tags=["tlf"])
async def get_tlf_manifest(request: Request, study_id: str):
    """
    Return the manifest of the most recent successful execution for a study,
    enriched with a human-readable description for each file.

    Response shape:
    {
      "study_id": "...",
      "study_name": "...",
      "execution_id": "...",
      "executed_at": "...",
      "files": [
        { "path": "cohort_a/table1.csv", "description": "...", "category": "table" },
        ...
      ]
    }
    """
    user_id = get_authenticated_user_id(request)

    # Fetch latest successful execution
    executions = await db_manager.get_study_executions(study_id, user_id)
    successful = [e for e in executions if e.get("status") == "success" and e.get("manifest_path")]
    if not successful:
        raise HTTPException(status_code=404, detail="No successful execution found for this study")

    latest = successful[0]
    manifest_path = latest["manifest_path"]

    try:
        manifest = storage.read_json(manifest_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Manifest file not found on disk.")
    except Exception as e:
        err_str = str(e)
        if "NoSuchKey" in err_str or "does not exist" in err_str.lower():
            raise HTTPException(
                status_code=404,
                detail="Execution output files are no longer available (may have been deleted from storage).",
            )
        raise HTTPException(status_code=500, detail=f"Could not read manifest: {err_str}")

    study = await db_manager.get_study_for_user(user_id, study_id)
    study_name = (study or {}).get("name", "")

    files_with_desc = [
        _describe_file(f) for f in manifest.get("files", [])
        if not f.endswith("manifest.json")
    ]

    return {
        "study_id": study_id,
        "study_name": study_name,
        "execution_id": latest["execution_id"],
        "executed_at": latest.get("ended_at") or latest.get("started_at"),
        "files": files_with_desc,
    }


@router.get("/study/{study_id}/tlf-plot/{plot_path:path}", tags=["tlf"])
async def serve_plot(request: Request, study_id: str, plot_path: str):
    """
    Serve a generated plot image.
    
    plot_path should be like: "plots/20260120_123456_abc123.png"
    """
    user_id = get_authenticated_user_id(request)
    
    # Verify user has access to this study
    executions = await db_manager.get_study_executions(study_id, user_id)
    if not executions:
        raise HTTPException(status_code=404, detail="Study not found or access denied.")
    
    # Get the first execution's manifest to find artifacts_dir
    execution = executions[0]
    manifest_path = execution.get("manifest_path")
    if not manifest_path:
        raise HTTPException(status_code=404, detail="No artifacts found for this study.")
    
    artifacts_dir = storage.dirname(manifest_path)
    
    # Security: no path traversal
    clean_path = plot_path.replace("\\", "/")
    if ".." in clean_path.split("/"):
        raise HTTPException(status_code=400, detail="Invalid plot path.")
    
    # Build full path
    if storage.is_s3(artifacts_dir):
        full_path = storage.join(artifacts_dir, plot_path)
    else:
        full_path = os.path.normpath(os.path.join(artifacts_dir, plot_path))
        if not full_path.startswith(os.path.normpath(artifacts_dir)):
            raise HTTPException(status_code=400, detail="Invalid plot path.")
    
    if not storage.isfile(full_path):
        raise HTTPException(status_code=404, detail="Plot not found.")
    
    # Read and return the image
    try:
        from fastapi.responses import Response
        image_bytes = storage.read_bytes(full_path)
        return Response(content=image_bytes, media_type="image/png")
    except Exception as e:
        logger.error(f"Failed to serve plot {plot_path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load plot.")


@router.get("/study/{study_id}/tlf-file-preview", tags=["tlf"])
async def get_file_preview(request: Request, study_id: str, execution_id: str, file_path: str):
    """
    Return a preview of a single output file from a study execution.
    Used by the TLF viewer's central panel when a user clicks a file.
    
    Returns JSON: {"content": "...", "path": "...", "type": "text"|"html"|"image"|"binary"}
    """
    import io
    import base64

    user_id = get_authenticated_user_id(request)

    # Verify execution belongs to user
    executions = await db_manager.get_study_executions(study_id, user_id)
    record = next(
        (e for e in executions if e["execution_id"] == execution_id), None
    )
    if not record:
        raise HTTPException(status_code=404, detail="Execution not found.")

    manifest_path = record.get("manifest_path")
    if not manifest_path:
        raise HTTPException(status_code=404, detail="No manifest for this execution.")

    artifacts_dir = storage.dirname(manifest_path)

    # Security: no path traversal
    clean = file_path.replace("\\", "/")
    if ".." in clean.split("/"):
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if storage.is_s3(artifacts_dir):
        full_path = storage.join(artifacts_dir, file_path)
    else:
        full_path = os.path.normpath(os.path.join(artifacts_dir, file_path))
        if not full_path.startswith(os.path.normpath(artifacts_dir)):
            raise HTTPException(status_code=400, detail="Invalid file path.")

    if not storage.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found.")

    ext = os.path.splitext(full_path)[1].lower()

    try:
        if ext in (".parquet",):
            import pandas as pd
            raw = storage.read_bytes(full_path)
            df = pd.read_parquet(io.BytesIO(raw))
            content = _df_preview(df)
            return {"content": content, "path": file_path, "type": "text"}

        elif ext == ".csv":
            import pandas as pd
            raw = storage.read_bytes(full_path)
            df = pd.read_csv(io.BytesIO(raw))
            content = _df_preview(df)
            return {"content": content, "path": file_path, "type": "text"}

        elif ext in (".xlsx", ".xls"):
            try:
                import pandas as pd
                raw = storage.read_bytes(full_path)
                df = pd.read_excel(io.BytesIO(raw))
                content = _df_preview(df)
                return {"content": content, "path": file_path, "type": "text"}
            except Exception:
                return {
                    "content": "[Excel file — could not parse for preview]",
                    "path": file_path,
                    "type": "text"
                }

        elif ext == ".json":
            data = storage.read_json(full_path)
            content = json.dumps(data, indent=2)[:10000]
            return {"content": content, "path": file_path, "type": "text"}

        elif ext == ".html":
            content = storage.read_text(full_path, errors="replace")
            return {"content": content, "path": file_path, "type": "html"}

        elif ext in (".png", ".jpg", ".jpeg", ".gif"):
            raw = storage.read_bytes(full_path)
            b64 = base64.b64encode(raw).decode('utf-8')
            mime = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
            }.get(ext, "image/png")
            return {
                "content": f"data:{mime};base64,{b64}",
                "path": file_path,
                "type": "image"
            }

        elif ext in (".svg",):
            content = storage.read_text(full_path, errors="replace")
            return {"content": content, "path": file_path, "type": "svg"}

        elif ext == ".pdf":
            raw = storage.read_bytes(full_path)
            b64 = base64.b64encode(raw).decode('utf-8')
            return {
                "content": f"data:application/pdf;base64,{b64}",
                "path": file_path,
                "type": "pdf"
            }

        else:
            content = storage.read_text(full_path, errors="replace")[:10000]
            return {"content": content, "path": file_path, "type": "text"}

    except Exception as e:
        return {
            "content": f"Error reading file: {str(e)}",
            "path": file_path,
            "type": "text"
        }


def _df_preview(df) -> str:
    """Format a DataFrame as a readable text preview."""
    rows, cols = df.shape
    lines = [f"{rows:,} rows x {cols} columns\n"]
    lines.append(f"Columns: {', '.join(df.columns.tolist())}\n")
    lines.append("─" * 80)
    # Show first 50 rows
    preview_rows = min(rows, 50)
    lines.append(df.head(preview_rows).to_string(index=False))
    if rows > 50:
        lines.append(f"\n... ({rows - 50:,} more rows)")
    return "\n".join(lines)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _describe_file(rel_path: str) -> dict:
    """Infer a human-readable category and description from a file path."""
    name = os.path.basename(rel_path)
    stem = os.path.splitext(name)[0]
    ext = os.path.splitext(name)[1].lower()
    parts = rel_path.replace("\\", "/").split("/")
    parent = parts[-2] if len(parts) > 1 else ""

    # Normalise stem for matching
    slug = re.sub(r"[\s_\-]+", "_", stem.lower())

    # ── Category + description rules ──────────────────────────────────────
    if ext in (".png", ".jpg", ".jpeg", ".svg", ".pdf") and any(
        kw in slug for kw in ("kaplan", "km", "survival", "curve", "forest", "plot", "figure", "fig")
    ):
        category = "figure"
        desc = _figure_description(slug, parent)

    elif ext in (".png", ".jpg", ".jpeg", ".svg", ".pdf"):
        category = "figure"
        desc = f"Figure — {_humanise(stem)}"

    elif ext == ".pdf" and "report" in slug:
        category = "report"
        desc = f"PDF report — {_humanise(stem)}"

    elif ext in (".csv", ".xlsx", ".xls"):
        category, desc = _table_description(slug, parent, ext)

    elif ext == ".log" or ext == ".txt":
        category = "log"
        desc = f"Log file — {_humanise(stem)}"

    elif ext == ".json":
        category = "metadata"
        desc = f"Metadata — {_humanise(stem)}"

    elif ext == ".py":
        category = "code"
        desc = f"Generated Python script — {_humanise(stem)}"

    elif ext == ".sql":
        category = "code"
        desc = f"Generated SQL — {_humanise(stem)}"

    elif ext == ".html":
        category = "report"
        desc = f"HTML report — {_humanise(stem)}"

    else:
        category = "other"
        desc = _humanise(stem)

    return {"path": rel_path, "category": category, "description": desc}


def _table_description(slug: str, parent: str, ext: str) -> tuple[str, str]:
    context = parent.lower() if parent else slug

    if any(kw in slug for kw in ("table1", "table_1", "baseline", "characteristic")):
        return "table", "Table 1 — baseline characteristics"
    if any(kw in slug for kw in ("attrition", "flowchart", "consort")):
        return "table", "Attrition / patient flow table"
    if any(kw in slug for kw in ("outcome", "primary", "secondary", "endpoint")):
        return "table", f"Outcomes table — {_humanise(slug)}"
    if any(kw in slug for kw in ("tte", "time_to_event", "survival", "km")):
        return "table", f"Time-to-event results — {_humanise(slug)}"
    if any(kw in slug for kw in ("listing", "list")):
        return "listing", f"Patient listing — {_humanise(slug)}"
    if any(kw in slug for kw in ("adverse", "ae", "safety")):
        return "table", f"Safety / AE table — {_humanise(slug)}"
    if any(kw in slug for kw in ("demographic", "demog")):
        return "table", "Demographic summary table"
    if context and any(kw in context for kw in ("table", "tbl")):
        return "table", f"Table — {_humanise(slug)}"
    if context and any(kw in context for kw in ("listing", "lst")):
        return "listing", f"Listing — {_humanise(slug)}"

    return "table", f"Data file — {_humanise(slug)}"


def _figure_description(slug: str, parent: str) -> str:
    if any(kw in slug for kw in ("kaplan", "km", "survival")):
        return "Kaplan-Meier survival curve"
    if any(kw in slug for kw in ("forest", "meta")):
        return "Forest plot"
    if any(kw in slug for kw in ("bar", "histogram")):
        return f"Bar chart / histogram — {_humanise(slug)}"
    if any(kw in slug for kw in ("scatter", "scatter")):
        return f"Scatter plot — {_humanise(slug)}"
    if any(kw in slug for kw in ("attrition", "flowchart")):
        return "Attrition flow diagram"
    return f"Figure — {_humanise(slug)}"


def _humanise(s: str) -> str:
    """Convert snake_case / camelCase filename stems to readable words."""
    # camelCase → spaced
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
    # underscores / hyphens → spaces
    s = re.sub(r"[_\-]+", " ", s)
    return s.strip().title()


def _infer_study_name(files: List[UploadFile]) -> str:
    """
    Try to derive a human-readable study name from the uploaded file paths.
    Uses the top-level directory name when webkitRelativePath-style names are
    present, otherwise falls back to a timestamped default.
    """
    for f in files:
        if f.filename and "/" in f.filename:
            top_dir = f.filename.split("/")[0]
            if top_dir:
                return top_dir.replace("_", " ").replace("-", " ").strip()
    return f"Imported Study {datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
