"""
Codelist store: load and serve codelists from a directory of CSV/Excel files.

Expects one or more CSV/Excel files in the configured directory.  Each file
must contain columns for code, codelist name, and code type (column names
are configurable via environment variables).

The store is loaded lazily on first access and cached for the process lifetime.
"""

import os
from pathlib import Path
from typing import Dict, List, Any, Optional

from phenex.codelists.factory import LocalFileCodelistFactory
from phenex.codelists import Codelist


# ---------------------------------------------------------------------------
# Module-level cache
# ---------------------------------------------------------------------------
_factories: Optional[List[LocalFileCodelistFactory]] = None


def _get_codelist_dir() -> Path:
    """Return the configured codelist directory, raising if not set or missing."""
    codelist_dir = os.getenv("PHENEX_CODELIST_DIR")
    if not codelist_dir:
        raise ValueError(
            "PHENEX_CODELIST_DIR environment variable is not set. "
            "Set it to a directory containing codelist CSV/Excel files."
        )
    p = Path(codelist_dir)
    if not p.is_dir():
        raise ValueError(
            f"PHENEX_CODELIST_DIR '{codelist_dir}' is not a directory or does not exist."
        )
    return p


def _get_column_config() -> dict:
    """Return column name overrides from env vars (with sensible defaults)."""
    return {
        "name_code_column": os.getenv("PHENEX_CODELIST_CODE_COLUMN", "code"),
        "name_codelist_column": os.getenv("PHENEX_CODELIST_NAME_COLUMN", "codelist"),
        "name_code_type_column": os.getenv(
            "PHENEX_CODELIST_CODE_TYPE_COLUMN", "code_type"
        ),
    }


def _load_factories() -> List[LocalFileCodelistFactory]:
    """Scan the codelist directory and create a factory per file."""
    global _factories
    if _factories is not None:
        return _factories

    codelist_dir = _get_codelist_dir()
    col_cfg = _get_column_config()

    extensions = {".csv", ".xlsx"}
    files = sorted(
        f
        for f in codelist_dir.iterdir()
        if f.suffix.lower() in extensions and not f.name.startswith(".")
    )

    if not files:
        raise ValueError(f"No CSV or Excel files found in '{codelist_dir}'.")

    factories = []
    for f in files:
        factories.append(
            LocalFileCodelistFactory(
                path=str(f),
                **col_cfg,
            )
        )

    _factories = factories
    return _factories


def _build_index() -> Dict[str, LocalFileCodelistFactory]:
    """Build a {codelist_name: factory} index across all files."""
    factories = _load_factories()
    index: Dict[str, LocalFileCodelistFactory] = {}
    for factory in factories:
        for name in factory.get_codelists():
            index[name] = factory  # last-one-wins if duplicates across files
    return index


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

MAX_SAMPLE_CODES = 10
MAX_RESULTS = 25


def _summarize_codelist(name: str, factory: LocalFileCodelistFactory) -> Dict[str, Any]:
    """Build a summary dict for a single codelist."""
    codelist: Codelist = factory.get_codelist(name)
    cl_dict = codelist.codelist

    code_types = [ct for ct in cl_dict.keys() if ct is not None] or [None]
    total_codes = sum(len(codes) for codes in cl_dict.values())

    sample = []
    for ct, codes in cl_dict.items():
        for code in codes:
            if len(sample) >= MAX_SAMPLE_CODES:
                break
            sample.append({"code": str(code), "code_type": ct})
        if len(sample) >= MAX_SAMPLE_CODES:
            break

    return {
        "name": name,
        "code_types": code_types,
        "total_codes": total_codes,
        "sample_codes": sample,
    }


def find_codelists(
    name_pattern: Optional[str] = None,
    code_type_pattern: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Search codelists by name and/or code type using regex patterns.

    Returns dict with 'codelists' (list of summaries), 'count', and 'truncated'.
    """
    import re

    index = _build_index()

    # Compile patterns (case-insensitive)
    name_re = re.compile(name_pattern, re.IGNORECASE) if name_pattern else None
    code_type_re = re.compile(code_type_pattern, re.IGNORECASE) if code_type_pattern else None

    matched = []
    for name in sorted(index.keys()):
        # Filter by name
        if name_re and not name_re.search(name):
            continue

        # Filter by code type (need to load the codelist to check)
        if code_type_re:
            factory = index[name]
            codelist: Codelist = factory.get_codelist(name)
            code_types = [ct for ct in codelist.codelist.keys() if ct is not None]
            if not any(code_type_re.search(ct) for ct in code_types):
                continue

        matched.append(name)

    total_matched = len(matched)
    truncated = total_matched > MAX_RESULTS
    matched = matched[:MAX_RESULTS]

    summaries = [_summarize_codelist(n, index[n]) for n in matched]

    return {
        "codelists": summaries,
        "count": total_matched,
        "returned": len(summaries),
        "truncated": truncated,
    }


def list_available_codelists() -> Dict[str, Any]:
    """
    List all codelists found in the configured directory.

    Returns dict with 'codelists' (list of summaries) and 'count'.
    Each summary includes name, code_types, total_codes, and a sample of codes.
    """
    index = _build_index()
    summaries = [_summarize_codelist(name, factory) for name, factory in sorted(index.items())]
    return {"codelists": summaries, "count": len(summaries)}


def get_codelist(name: str) -> Dict[str, Any]:
    """
    Return the full contents of a single codelist by name.

    Returns dict with name, code_types, total_codes, and the full codelist dict.
    """
    index = _build_index()

    if name not in index:
        available = sorted(index.keys())
        import difflib
        close = difflib.get_close_matches(name, available, n=3, cutoff=0.4)
        hint = f" Did you mean: {', '.join(close)}?" if close else ""
        return {
            "error": (
                f"Codelist '{name}' not found.{hint} "
                f"Call phenex_find_codelists() to search available codelist names."
            ),
            "available_codelists": available,
        }

    factory = index[name]
    codelist: Codelist = factory.get_codelist(name)
    cl_dict = codelist.codelist

    code_types = [ct for ct in cl_dict.keys() if ct is not None] or [None]
    total_codes = sum(len(codes) for codes in cl_dict.values())

    # Convert keys to strings for JSON safety (None -> "null")
    serialized = {}
    for ct, codes in cl_dict.items():
        key = ct if ct is not None else "null"
        serialized[key] = [str(c) for c in codes]

    return {
        "name": name,
        "code_types": code_types,
        "total_codes": total_codes,
        "codelist": serialized,
    }
