"""
Registry of available PhenEx phenotypes with their specifications.

All information is derived from actual class docstrings and signatures —
nothing is hardcoded.
"""

import inspect
import re
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
    from phenex.filters import (
        RelativeTimeRangeFilter,
        CategoricalFilter,
        ValueFilter,
    )
    from phenex.filters.date_filter import (
        DateFilter,
        Date,
        After,
        AfterOrOn,
        Before,
        BeforeOrOn,
    )
    from phenex.filters.value import (
        Value,
        GreaterThan,
        GreaterThanOrEqualTo,
        LessThan,
        LessThanOrEqualTo,
        EqualTo,
    )
    from phenex.codelists import Codelist
    from phenex.core.cohort import Cohort
    from phenex.core.subcohort import Subcohort
    from phenex.core.study import Study
    from phenex.reporting import (
        Table1,
        Table2,
        Waterfall,
        InExCounts,
        TimeToEvent,
        CohortExplorer,
        ReportDrafter,
        TreatmentPatternAnalysisSankeyReporter,
    )
    from phenex.reporting.protocol_drafter import ProtocolDrafter

    PHENEX_AVAILABLE = True
except ImportError:
    PHENEX_AVAILABLE = False


# Ordered list of phenotype classes to expose
PHENOTYPE_CLASSES: List = (
    [
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
    ]
    if PHENEX_AVAILABLE
    else []
)

# Filter and value classes to expose via phenex_list_classes
FILTER_CLASSES: List = (
    [
        RelativeTimeRangeFilter,
        ValueFilter,
        CategoricalFilter,
        DateFilter,
        Codelist,
        GreaterThan,
        GreaterThanOrEqualTo,
        LessThan,
        LessThanOrEqualTo,
        EqualTo,
        After,
        AfterOrOn,
        Before,
        BeforeOrOn,
    ]
    if PHENEX_AVAILABLE
    else []
)

# Top-level orchestration classes
OTHER_CLASSES: List = (
    [
        Cohort,
        Subcohort,
        Study,
    ]
    if PHENEX_AVAILABLE
    else []
)

# Reporter classes for cohort analysis and visualization
REPORTER_CLASSES: List = (
    [
        Table1,
        Table2,
        Waterfall,
        InExCounts,
        TimeToEvent,
        CohortExplorer,
        ReportDrafter,
        ProtocolDrafter,
        TreatmentPatternAnalysisSankeyReporter,
    ]
    if PHENEX_AVAILABLE
    else []
)

# Supporting classes whose dict schema should be included when
# they appear as a phenotype parameter type.
SUPPORTING_CLASSES: Dict[str, Any] = (
    {
        "RelativeTimeRangeFilter": RelativeTimeRangeFilter,
        "CategoricalFilter": CategoricalFilter,
        "ValueFilter": ValueFilter,
        "DateFilter": DateFilter,
        "Value": Value,
        "GreaterThan": GreaterThan,
        "GreaterThanOrEqualTo": GreaterThanOrEqualTo,
        "LessThan": LessThan,
        "LessThanOrEqualTo": LessThanOrEqualTo,
        "EqualTo": EqualTo,
        "After": After,
        "AfterOrOn": AfterOrOn,
        "Before": Before,
        "BeforeOrOn": BeforeOrOn,
        "Codelist": Codelist,
    }
    if PHENEX_AVAILABLE
    else {}
)


def _get_supporting_class_spec(cls, _seen: Optional[set] = None) -> Dict[str, Any]:
    """Build a dict-schema spec for a supporting class (filter, value, etc.).

    Recursively inlines nested specs on parameters that reference other
    supporting classes, so the full construction tree is self-contained.
    """
    if _seen is None:
        _seen = set()
    sections = _extract_docstring_sections(cls)
    params = _extract_parameters(cls)

    # For classes with to_dict, show an example of the serialized form
    example_dict = None
    try:
        if cls in (
            GreaterThan,
            LessThan,
            GreaterThanOrEqualTo,
            LessThanOrEqualTo,
            EqualTo,
        ):
            example_dict = cls(0).to_dict()
        elif cls in (After, AfterOrOn, Before, BeforeOrOn):
            example_dict = cls("2020-01-01").to_dict()
        elif cls is Value:
            example_dict = Value(">", 0).to_dict()
    except Exception:
        pass

    # Inline nested specs on each parameter that references another supporting class
    for param_info in params.values():
        type_str = param_info.get("type", "")
        param_nested = {}
        for class_name, supporting_cls in SUPPORTING_CLASSES.items():
            if class_name in type_str and class_name not in _seen:
                _seen.add(class_name)
                param_nested[class_name] = _get_supporting_class_spec(
                    supporting_cls, _seen
                )
        if param_nested:
            param_info["nested_specs"] = param_nested

    spec = {
        "class_name": cls.__name__,
        "description": sections["description"],
        "parameters": params,
    }
    if example_dict is not None:
        spec["dict_format"] = example_dict
    return spec


def _collect_referenced_classes(
    params: Dict[str, Dict[str, Any]], _seen: Optional[set] = None
) -> Dict[str, Dict[str, Any]]:
    """Find all supporting classes referenced in a parameter list and return their specs.

    Recurses into nested class parameters so transitive references
    (e.g. RelativeTimeRangeFilter → Value) are also included.
    """
    if _seen is None:
        _seen = set()
    referenced = {}
    for param_info in params.values():
        type_str = param_info.get("type", "")
        for class_name, cls in SUPPORTING_CLASSES.items():
            if class_name in type_str and class_name not in _seen:
                _seen.add(class_name)
                spec = _get_supporting_class_spec(cls)
                referenced[class_name] = spec
                # Recurse: if this supporting class has params referencing other supporting classes
                nested_params = spec.get("parameters", {})
                if nested_params:
                    referenced.update(_collect_referenced_classes(nested_params, _seen))
    return referenced


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
    """Extract constructor parameters with types, defaults, and descriptions from a class or function."""
    try:
        if inspect.isfunction(cls):
            sig = inspect.signature(cls)
        else:
            sig = inspect.signature(cls.__init__)
    except (ValueError, TypeError, AttributeError):
        try:
            sig = inspect.signature(cls)
        except (ValueError, TypeError):
            return {}

    # Parse parameter descriptions from the docstring
    param_descriptions = _parse_param_descriptions(cls)

    params = {}
    for name, p in sig.parameters.items():
        if name in ("self", "kwargs", "args"):
            continue
        info = {
            "type": _clean_type_str(p.annotation),
            "required": p.default == inspect.Parameter.empty,
            "default": None if p.default == inspect.Parameter.empty else str(p.default),
        }
        if name in param_descriptions:
            info["description"] = param_descriptions[name]
        params[name] = info
    return params


def _parse_param_descriptions(cls) -> Dict[str, str]:
    """Parse the 'Parameters:' section of a docstring into {param_name: description}."""
    raw = inspect.getdoc(cls) or ""
    if not raw:
        return {}

    lines = raw.split("\n")

    # Find the Parameters: section
    param_start = None
    for i, line in enumerate(lines):
        if line.strip() == "Parameters:":
            param_start = i + 1
            break

    if param_start is None:
        return {}

    descriptions = {}
    current_param = None
    current_desc_lines = []

    for line in lines[param_start:]:
        stripped = line.strip()

        # Stop at the next section header (e.g. Attributes:, Methods:, Examples:, Example)
        if (
            stripped
            and not stripped.startswith(" ")
            and stripped.endswith(":")
            and stripped != "Parameters:"
        ):
            break
        if stripped.startswith("Example"):
            break

        # Check if this is a new parameter line: "param_name: description"
        # or "param_name (type): description"
        if ":" in stripped and not stripped.startswith(" "):
            # Could be a continuation line if deeply indented, but at the
            # Parameters level it should be a param definition
            pass

        # Detect param lines: they are indented at the first level under Parameters:
        # and have the form "name: description" or "name (type): description"
        if line and not line.startswith("        ") and ":" in stripped:
            # Save previous param
            if current_param is not None:
                descriptions[current_param] = " ".join(current_desc_lines).strip()

            # Parse "param_name: description" or "param_name (type): description"
            colon_idx = stripped.index(":")
            param_part = stripped[:colon_idx].strip()
            desc_part = stripped[colon_idx + 1 :].strip()

            # Strip type annotation if present: "param_name (type)" -> "param_name"
            if "(" in param_part:
                param_part = param_part[: param_part.index("(")].strip()

            current_param = param_part
            current_desc_lines = [desc_part] if desc_part else []
        elif current_param is not None and stripped:
            # Continuation line for the current parameter
            current_desc_lines.append(stripped)
        elif current_param is not None and not stripped:
            # Blank line — end of this param's description if next line is a new section
            # But could also be a paragraph break within a param description.
            # We'll let the section-header check above handle termination.
            pass

    # Save the last param
    if current_param is not None:
        descriptions[current_param] = " ".join(current_desc_lines).strip()

    return descriptions


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
        if (
            stripped.startswith("Parameters:")
            or stripped.startswith("Attributes:")
            or stripped.startswith("Example")
        ):
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


def get_available_classes(category: str = "") -> Dict[str, List[Dict[str, Any]]]:
    """Get all available PhenEx classes grouped by category.

    Args:
        category: Optional category key to filter by ("phenotypes", "filters",
                  "reporters", "other"). If empty, returns all categories.
    """
    if not PHENEX_AVAILABLE:
        return {
            "error": "PhenEx library not available. Install with: pip install phenex",
        }

    VALID_CATEGORIES = ["phenotypes", "filters", "reporters", "other"]

    if category and category not in VALID_CATEGORIES:
        return {
            "error": f"Unknown category '{category}'. Valid categories: {', '.join(VALID_CATEGORIES)}",
        }

    def _summarize(classes):
        result = []
        for cls in classes:
            sections = _extract_docstring_sections(cls)
            result.append(
                {
                    "name": cls.__name__,
                    "description": sections["description"],
                }
            )
        return result

    all_categories = {
        "phenotypes": PHENOTYPE_CLASSES,
        "filters": FILTER_CLASSES,
        "reporters": REPORTER_CLASSES,
        "other": OTHER_CLASSES,
    }

    if category:
        return {category: _summarize(all_categories[category])}

    return {k: _summarize(v) for k, v in all_categories.items()}


def get_spec(class_name: str) -> Dict[str, Any]:
    """
    Get detailed specification for a phenotype class, filter class, or the Codelist class.

    Returns the full docstring, all constructor parameters, and examples —
    all derived from the actual class, nothing hardcoded.
    """
    if not PHENEX_AVAILABLE:
        return {
            "error": "PhenEx library not available. Install with: pip install phenex"
        }

    # Build a combined map of all exposed classes
    cls_map = {cls.__name__: cls for cls in PHENOTYPE_CLASSES}
    cls_map.update({cls.__name__: cls for cls in FILTER_CLASSES})
    cls_map.update({cls.__name__: cls for cls in OTHER_CLASSES})
    cls_map.update({cls.__name__: cls for cls in REPORTER_CLASSES})

    if class_name not in cls_map:
        import difflib

        available = sorted(cls_map.keys())
        close = difflib.get_close_matches(class_name, available, n=3, cutoff=0.4)
        hint = f" Did you mean: {', '.join(close)}?" if close else ""
        return {
            "error": (
                f"Unknown class: '{class_name}'.{hint} "
                f"Call phenex_list_classes() to see all valid class names."
            ),
            "available_classes": available,
        }

    cls = cls_map[class_name]
    sections = _extract_docstring_sections(cls)
    params = _extract_parameters(cls)

    # Inline nested specs directly into each parameter that references a supporting class
    seen = set()
    for param_info in params.values():
        type_str = param_info.get("type", "")
        param_nested = {}
        for sc_name, supporting_cls in SUPPORTING_CLASSES.items():
            if sc_name in type_str and sc_name not in seen:
                seen.add(sc_name)
                param_nested[sc_name] = _get_supporting_class_spec(supporting_cls, seen)
        if param_nested:
            param_info["nested_specs"] = param_nested

    return {
        "name": class_name,
        "description": sections["description"],
        "parameters": params,
        "example": sections.get("example", "No examples found."),
    }
