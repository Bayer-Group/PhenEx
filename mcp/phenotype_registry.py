"""
Registry of available PhenEx phenotypes with their specifications.

All information is derived from actual class docstrings and signatures —
nothing is hardcoded.
"""

import inspect
from typing import Dict, List, Any, Optional

# Import phenotype classes from PhenEx
try:
    from phenex.phenotypes import (
        CodelistPhenotype,
        AgePhenotype,
        BinPhenotype,
        SexPhenotype,
        EventCountPhenotype,
        MeasurementPhenotype,
        MeasurementChangePhenotype,
        DeathPhenotype,
        CategoricalPhenotype,
        TimeRangeCountPhenotype,
        TimeRangeDayCountPhenotype,
        TimeRangeDaysToNextRange,
        TimeRangePhenotype,
        UserDefinedPhenotype,
        ScorePhenotype,
        ArithmeticPhenotype,
        LogicPhenotype,
        WithinSameEncounterPhenotype,
    )

    PHENEX_AVAILABLE = True
except ImportError:
    PHENEX_AVAILABLE = False


# Ordered list of phenotype classes to expose
PHENOTYPE_CLASSES: List = [
    CodelistPhenotype,
    AgePhenotype,
    SexPhenotype,
    MeasurementPhenotype,
    MeasurementChangePhenotype,
    EventCountPhenotype,
    TimeRangePhenotype,
    TimeRangeCountPhenotype,
    TimeRangeDayCountPhenotype,
    TimeRangeDaysToNextRange,
    DeathPhenotype,
    CategoricalPhenotype,
    BinPhenotype,
    ScorePhenotype,
    ArithmeticPhenotype,
    LogicPhenotype,
    WithinSameEncounterPhenotype,
    UserDefinedPhenotype,
] if PHENEX_AVAILABLE else []


def _clean_type_str(annotation) -> str:
    """Turn a type annotation into a readable string."""
    if annotation == inspect.Parameter.empty:
        return "Any"
    s = str(annotation)
    # Clean up verbose module paths
    for prefix in [
        "typing.",
        "phenex.phenotypes.phenotype.",
        "phenex.codelists.codelists.",
        "phenex.filters.relative_time_range_filter.",
        "phenex.filters.categorical_filter.",
        "phenex.filters.value_filter.",
        "phenex.filters.date_filter.",
        "phenex.filters.",
    ]:
        s = s.replace(prefix, "")
    s = s.replace("<class '", "").replace("'>", "")
    s = s.replace("<function ", "").replace(">", "")
    # Remove memory addresses (e.g. "DateFilter at 0x1198fa020")
    import re
    s = re.sub(r"\s+at\s+0x[0-9a-fA-F]+", "", s)
    return s


def _extract_parameters(cls) -> Dict[str, Dict[str, Any]]:
    """Extract constructor parameters with types and defaults from a class."""
    try:
        sig = inspect.signature(cls.__init__)
    except (ValueError, TypeError):
        return {}

    params = {}
    for name, p in sig.parameters.items():
        if name in ("self", "kwargs", "args"):
            continue
        params[name] = {
            "type": _clean_type_str(p.annotation),
            "required": p.default == inspect.Parameter.empty,
            "default": None if p.default == inspect.Parameter.empty else str(p.default),
        }
    return params


def _extract_docstring_sections(cls) -> Dict[str, str]:
    """Parse a class docstring into sections: description, parameters, examples, etc."""
    raw = inspect.getdoc(cls) or ""
    if not raw:
        return {"description": "No documentation available.", "full": raw}

    lines = raw.split("\n")

    # First paragraph = description (everything up to first blank line or section header)
    desc_lines = []
    rest_start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == "":
            rest_start = i + 1
            break
        # Stop at known section headers
        if stripped.startswith("Parameters:") or stripped.startswith("Attributes:") or stripped.startswith("Example"):
            rest_start = i
            break
        desc_lines.append(stripped)
    else:
        rest_start = len(lines)

    description = " ".join(desc_lines)

    # Extract examples (everything from "Example" onwards that contains ```python blocks)
    example = ""
    example_start = None
    for i, line in enumerate(lines):
        if line.strip().startswith("Example"):
            example_start = i
            break
    if example_start is not None:
        example = "\n".join(lines[example_start:])

    return {
        "description": description,
        "full": raw,
        "example": example,
    }


def get_available_phenotypes() -> List[Dict[str, Any]]:
    """Get list of all available PhenEx phenotype types, derived from actual class docs."""
    if not PHENEX_AVAILABLE:
        return [{"error": "PhenEx library not available. Install with: pip install phenex", "phenotypes": []}]

    phenotypes = []
    for cls in PHENOTYPE_CLASSES:
        sections = _extract_docstring_sections(cls)
        params = _extract_parameters(cls)

        phenotypes.append({
            "name": cls.__name__,
            "description": sections["description"],
            "parameters": params,
            "example": sections.get("example", ""),
        })
    return phenotypes


def get_phenotype_spec(phenotype_class: str) -> Dict[str, Any]:
    """
    Get detailed specification for a specific phenotype class.

    Returns the full docstring, all constructor parameters, and examples —
    all derived from the actual class, nothing hardcoded.
    """
    if not PHENEX_AVAILABLE:
        return {"error": "PhenEx library not available. Install with: pip install phenex"}

    cls_map = {cls.__name__: cls for cls in PHENOTYPE_CLASSES}
    if phenotype_class not in cls_map:
        return {
            "error": f"Unknown phenotype class: {phenotype_class}",
            "available_classes": list(cls_map.keys()),
        }

    cls = cls_map[phenotype_class]
    sections = _extract_docstring_sections(cls)
    params = _extract_parameters(cls)

    return {
        "name": phenotype_class,
        "description": sections["description"],
        "parameters": params,
        "docstring": sections["full"],
        "example": sections.get("example", "See docstring for examples"),
    }


def get_codelist_spec() -> Dict[str, Any]:
    """Return Codelist documentation derived from the actual Codelist class."""
    try:
        from phenex.codelists import Codelist
    except ImportError:
        return {"error": "PhenEx library not available. Install with: pip install phenex"}

    sections = _extract_docstring_sections(Codelist)
    params = _extract_parameters(Codelist)

    return {
        "success": True,
        "name": "Codelist",
        "description": sections["description"],
        "parameters": params,
        "docstring": sections["full"],
        "example": sections.get("example", "See docstring for examples"),
    }
