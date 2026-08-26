"""Pluggable storage backend for report data.

When ``REPORT_S3_BUCKET`` is set the backend reads run / cohort data from S3.
Otherwise it falls back to the local ``data/`` directory (legacy behaviour).

Required environment variables for S3 mode
-------------------------------------------
REPORT_S3_BUCKET   – e.g. "phenextest"
REPORT_S3_PREFIX   – e.g. "public/"  (optional, defaults to "")

AWS credentials are expected via the standard boto3 chain
(AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN or IAM role).
"""

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────

LOCAL_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _get_s3_bucket() -> Optional[str]:
    """Read bucket name from env at call time (not import time)."""
    return os.environ.get("REPORT_S3_BUCKET")


def _get_s3_prefix() -> str:
    """Read prefix from env at call time, stripping slashes."""
    return os.environ.get("REPORT_S3_PREFIX", "").strip("/")


_s3_client_instance = None
_s3_client_lock = threading.Lock()


def _s3_client():
    """Return a process-wide, thread-safe boto3 S3 client.

    The client is created exactly once. Creating a new ``boto3.client`` on every
    request is both wasteful and *not thread-safe at construction* — under the
    concurrent threadpool requests FastAPI uses for sync routes, concurrent
    creation intermittently raises, which manifested as random "blank report"
    loads that a restart appeared to fix.
    """
    global _s3_client_instance
    if _s3_client_instance is None:
        with _s3_client_lock:
            if _s3_client_instance is None:
                import boto3  # imported here so the dep is optional in local mode
                from botocore.config import Config

                _s3_client_instance = boto3.client(
                    "s3",
                    config=Config(max_pool_connections=32),
                )
    return _s3_client_instance


def _s3_prefix(*parts: str) -> str:
    """Build an S3 key prefix from path segments."""
    prefix = _get_s3_prefix()
    segments = [prefix] + list(parts) if prefix else list(parts)
    return "/".join(segments) + "/"


def _sanitise(name: str) -> str:
    """Prevent path traversal by stripping directory components."""
    return Path(name).name


# ── Public API ───────────────────────────────────────────────────────────


def list_runs() -> List[str]:
    """Return available run directory names."""
    if _get_s3_bucket():
        return _s3_list_dirs(_s3_prefix())
    if not LOCAL_DATA_DIR.is_dir():
        return []
    return sorted(
        d.name
        for d in LOCAL_DATA_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    )


def list_cohorts(run_id: str) -> List[str]:
    """Return cohort directory names inside a run."""
    safe = _sanitise(run_id)
    logger.info(
        "list_cohorts: run_id=%r safe=%r s3=%s", run_id, safe, bool(_get_s3_bucket())
    )
    if _get_s3_bucket():
        _assert_prefix_exists(safe)
        result = _s3_list_dirs(_s3_prefix(safe))
        logger.info("list_cohorts: found %d cohorts in S3", len(result))
        return result
    run_dir = _resolve_local_run(safe)
    logger.info("list_cohorts: resolved local dir %s", run_dir)
    result = sorted(d.name for d in run_dir.iterdir() if d.is_dir())
    logger.info("list_cohorts: found %d cohorts locally", len(result))
    return result


def read_info(run_id: str) -> Dict[str, str]:
    """Read info.txt from a run and return key-value pairs."""
    safe = _sanitise(run_id)
    if _get_s3_bucket():
        text = _s3_read_text(safe, "info.txt")
    else:
        info_file = _resolve_local_run(safe) / "info.txt"
        if not info_file.is_file():
            return {}
        text = info_file.read_text()

    if text is None:
        return {}
    result: Dict[str, str] = {}
    for line in text.splitlines():
        if ":" in line and not line.startswith("="):
            key, _, value = line.partition(":")
            key, value = key.strip(), value.strip()
            if key and value:
                result[key] = value
    return result


def read_json(run_id: str, cohort_name: str, filename: str) -> Dict[str, Any]:
    """Read and parse a JSON file from ``{run}/{cohort}/{filename}``."""
    safe_run = _sanitise(run_id)
    safe_cohort = _sanitise(cohort_name)
    if _get_s3_bucket():
        text = _s3_read_text(safe_run, safe_cohort, filename)
        if text is None:
            raise HTTPException(
                status_code=404, detail=f"'{filename}' not found in cohort"
            )
        try:
            return json.loads(text)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading report: {e}")

    cohort_dir = _resolve_local_run(safe_run) / safe_cohort
    if not cohort_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Cohort '{safe_cohort}' not found")
    json_file = cohort_dir / filename
    if not json_file.is_file():
        raise HTTPException(status_code=404, detail=f"'{filename}' not found in cohort")
    try:
        with json_file.open() as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading report: {e}")


def find_frozen_cohort(run_id: str, cohort_name: str) -> Optional[Dict[str, Any]]:
    """Find and read frozen_*.json inside a cohort directory.

    Returns None if not found or on read errors.
    """
    safe_run = _sanitise(run_id)
    safe_cohort = _sanitise(cohort_name)

    bucket = _get_s3_bucket()
    if bucket:
        prefix = _s3_prefix(safe_run, safe_cohort)
        try:
            s3 = _s3_client()
            resp = s3.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                MaxKeys=1000,
            )
            for obj in resp.get("Contents", []):
                key = obj["Key"]
                basename = key.rsplit("/", 1)[-1]
                if basename.startswith("frozen_") and basename.endswith(".json"):
                    body = s3.get_object(Bucket=bucket, Key=key)["Body"].read()
                    return json.loads(body)
        except Exception as e:
            logger.warning("Failed to read frozen cohort %s: %s", cohort_name, e)
        return None

    cohort_dir = LOCAL_DATA_DIR / safe_run / safe_cohort
    if not cohort_dir.is_dir():
        return None
    candidates = list(cohort_dir.glob("frozen_*.json"))
    if not candidates:
        return None
    try:
        with candidates[0].open() as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Failed to read frozen cohort %s: %s", cohort_name, e)
        return None


# ── S3 helpers ───────────────────────────────────────────────────────────


def _s3_list_dirs(prefix: str) -> List[str]:
    """List immediate 'subdirectories' under an S3 prefix."""
    bucket = _get_s3_bucket()
    s3 = _s3_client()
    paginator = s3.get_paginator("list_objects_v2")
    dirs: List[str] = []
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter="/"):
        for cp in page.get("CommonPrefixes", []):
            name = cp["Prefix"].rstrip("/").rsplit("/", 1)[-1]
            if not name.startswith("."):
                dirs.append(name)
    return sorted(dirs)


def _s3_read_text(run_id: str, *parts: str) -> Optional[str]:
    """Read a text file from S3.  Returns None if not found."""
    prefix = _get_s3_prefix()
    segments = [prefix, run_id] + list(parts) if prefix else [run_id] + list(parts)
    key = "/".join(segments)
    bucket = _get_s3_bucket()
    logger.info("_s3_read_text: bucket=%r key=%r (prefix=%r)", bucket, key, prefix)
    s3 = _s3_client()
    try:
        resp = s3.get_object(Bucket=bucket, Key=key)
        body = resp["Body"].read().decode("utf-8")
        logger.info("_s3_read_text: success, %d bytes", len(body))
        return body
    except Exception as e:
        error_code = (
            getattr(
                getattr(e, "response", {}).get("Error", {}),
                "__getitem__",
                lambda k: None,
            )("Code")
            if hasattr(e, "response")
            else None
        )
        if hasattr(e, "response") and isinstance(e.response, dict):
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
        else:
            error_code = type(e).__name__
        logger.warning(
            "_s3_read_text FAILED: bucket=%r key=%r error_code=%s error=%s",
            bucket,
            key,
            error_code,
            e,
        )
        return None


def _assert_prefix_exists(run_id: str) -> None:
    """Raise 404 if a run prefix has no objects."""
    prefix = _s3_prefix(run_id)
    bucket = _get_s3_bucket()
    s3 = _s3_client()
    resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, MaxKeys=1)
    if resp.get("KeyCount", 0) == 0:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")


# ── Local helpers ────────────────────────────────────────────────────────


def read_run_file(run_id: str, filename: str) -> Optional[Dict[str, Any]]:
    """Read a JSON file directly from the run directory (not a cohort subdir).

    Returns None if the file doesn't exist.
    """
    safe_run = _sanitise(run_id)
    logger.info("read_run_file: run_id=%r filename=%r", run_id, filename)
    if _get_s3_bucket():
        text = _s3_read_text(safe_run, filename)
        if text is None:
            logger.warning(
                "read_run_file: %r not found in S3 for run %r", filename, run_id
            )
            return None
        return json.loads(text)

    json_file = _resolve_local_run(safe_run) / filename
    if not json_file.is_file():
        logger.warning("read_run_file: %s not found", json_file)
        return None
    logger.info(
        "read_run_file: reading %s (%.1f MB)", json_file, json_file.stat().st_size / 1e6
    )
    with json_file.open() as f:
        return json.load(f)


def list_run_files(run_id: str) -> List[str]:
    """List non-directory files at the run level (not inside cohort subdirs)."""
    safe = _sanitise(run_id)
    bucket = _get_s3_bucket()
    if bucket:
        prefix = _s3_prefix(safe)
        logger.info("list_run_files: listing S3 prefix=%r", prefix)
        s3 = _s3_client()
        resp = s3.list_objects_v2(Bucket=bucket, Prefix=prefix, Delimiter="/")
        files = []
        for obj in resp.get("Contents", []):
            key = obj["Key"]
            basename = key.rsplit("/", 1)[-1]
            if basename:
                files.append(basename)
        logger.info("list_run_files: found %d files in S3", len(files))
        return sorted(files)
    run_dir = _resolve_local_run(safe)
    return sorted(f.name for f in run_dir.iterdir() if f.is_file())


def _resolve_local_run(safe_run_id: str) -> Path:
    """Return a validated local run directory path."""
    run_dir = LOCAL_DATA_DIR / safe_run_id
    logger.info("_resolve_local_run: checking %s", run_dir)
    if not run_dir.is_dir():
        logger.error(
            "_resolve_local_run: run not found at %s (LOCAL_DATA_DIR=%s)",
            run_dir,
            LOCAL_DATA_DIR,
        )
        raise HTTPException(status_code=404, detail=f"Run '{safe_run_id}' not found")
    return run_dir
