"""
Generate idiomatic Python code from any PhenEx definition dict.

The JSON dict is first compiled via from_dict() to validate it, then
to_dict() is called on the compiled object to get the canonical form.
That canonical dict is walked recursively to emit Python constructor calls.

Works for any PhenEx class: Cohort, individual phenotypes, filters,
codelists, etc.
"""

from typing import Dict, Any, List, Set

# Maps class_name → module path for imports.
_IMPORT_MAP = {
    # Phenotypes
    "CodelistPhenotype": "phenex.phenotypes",
    "AgePhenotype": "phenex.phenotypes",
    "SexPhenotype": "phenex.phenotypes",
    "MeasurementPhenotype": "phenex.phenotypes",
    "MeasurementChangePhenotype": "phenex.phenotypes",
    "EventCountPhenotype": "phenex.phenotypes",
    "TimeRangePhenotype": "phenex.phenotypes",
    "TimeRangeCountPhenotype": "phenex.phenotypes",
    "TimeRangeDayCountPhenotype": "phenex.phenotypes",
    "TimeRangeDaysToNextRange": "phenex.phenotypes",
    "DeathPhenotype": "phenex.phenotypes",
    "CategoricalPhenotype": "phenex.phenotypes",
    "BinPhenotype": "phenex.phenotypes",
    "ScorePhenotype": "phenex.phenotypes",
    "ArithmeticPhenotype": "phenex.phenotypes",
    "LogicPhenotype": "phenex.phenotypes",
    "WithinSameEncounterPhenotype": "phenex.phenotypes",
    # Filters
    "RelativeTimeRangeFilter": "phenex.filters",
    "ValueFilter": "phenex.filters",
    "DateFilter": "phenex.filters",
    "CategoricalFilter": "phenex.filters",
    "CodelistFilter": "phenex.filters",
    "TimeRangeFilter": "phenex.filters",
    "Before": "phenex.filters",
    "BeforeOrOn": "phenex.filters",
    "After": "phenex.filters",
    "AfterOrOn": "phenex.filters",
    "Date": "phenex.filters",
    "GreaterThan": "phenex.filters",
    "GreaterThanOrEqualTo": "phenex.filters",
    "LessThan": "phenex.filters",
    "LessThanOrEqualTo": "phenex.filters",
    "EqualTo": "phenex.filters",
    "Value": "phenex.filters",
    # Codelists
    "Codelist": "phenex.codelists",
    # Core
    "Cohort": "phenex.core",
    "Subcohort": "phenex.core",
    "Study": "phenex.core",
}

# Classes whose child phenotypes should be extracted as named variables
# for readability (rather than inlined in the constructor).
_COHORT_LIKE = {"Cohort", "Subcohort", "Study"}

# Slots on Cohort/Subcohort that hold phenotype objects or lists of them.
_PHENOTYPE_SLOTS = ("entry_criterion", "inclusions", "exclusions", "characteristics", "outcomes")


# ---------------------------------------------------------------------------
# Low-level emitters
# ---------------------------------------------------------------------------

def _is_phenex_object(value: Any) -> bool:
    """True if value is a dict with a class_name key (i.e. a serialized PhenEx object)."""
    return isinstance(value, dict) and "class_name" in value


def _emit_value(value: Any, imports: Set[str], indent: int) -> str:
    """Convert a value to its Python source representation."""
    pad = "    " * indent

    if _is_phenex_object(value):
        return _emit_constructor(value, imports, indent)

    if isinstance(value, dict) and "__datetime__" in value:
        imports.add("from datetime import date")
        return f"date.fromisoformat({value['__datetime__']!r})"

    if isinstance(value, dict):
        if not value:
            return "{}"
        items = []
        for k, v in value.items():
            key_repr = repr(k)
            val_repr = _emit_value(v, imports, indent + 1)
            items.append(f"{key_repr}: {val_repr}")
        one_line = "{" + ", ".join(items) + "}"
        if len(one_line) < 80:
            return one_line
        inner_pad = "    " * (indent + 1)
        lines = [f"{inner_pad}{item}," for item in items]
        return "{\n" + "\n".join(lines) + "\n" + pad + "}"

    if isinstance(value, list):
        if not value:
            return "[]"
        rendered = [_emit_value(v, imports, indent + 1) for v in value]
        if all(isinstance(v, (str, int, float, bool, type(None))) for v in value):
            one_line = "[" + ", ".join(rendered) + "]"
            if len(one_line) < 80:
                return one_line
        inner_pad = "    " * (indent + 1)
        lines = [f"{inner_pad}{r}," for r in rendered]
        return "[\n" + "\n".join(lines) + "\n" + pad + "]"

    return repr(value)


def _emit_constructor(obj_dict: Dict[str, Any], imports: Set[str], indent: int) -> str:
    """Emit ClassName(param=value, ...), skipping None and empty-list params."""
    class_name = obj_dict["class_name"]
    pad = "    " * indent
    inner_pad = "    " * (indent + 1)

    module = _IMPORT_MAP.get(class_name)
    if module:
        imports.add(f"from {module} import {class_name}")

    params = []
    for key, value in obj_dict.items():
        if key == "class_name":
            continue
        if value is None:
            continue
        if isinstance(value, list) and len(value) == 0:
            continue
        val_str = _emit_value(value, imports, indent + 1)
        params.append((key, val_str))

    if not params:
        return f"{class_name}()"

    if len(params) == 1:
        k, v = params[0]
        one_line = f"{class_name}({k}={v})"
        if len(one_line) < 80:
            return one_line

    lines = [f"{inner_pad}{k}={v}," for k, v in params]
    return f"{class_name}(\n" + "\n".join(lines) + "\n" + pad + ")"


def _build_variable_name(obj_dict: Dict[str, Any]) -> str:
    """Derive a Python variable name from a PhenEx object dict."""
    name = obj_dict.get("name")
    if name:
        clean = name.lower().replace(" ", "_").replace("-", "_")
        clean = "".join(c for c in clean if c.isalnum() or c == "_")
        return clean
    class_name = obj_dict.get("class_name", "obj")
    return class_name[0].lower() + class_name[1:]


# ---------------------------------------------------------------------------
# High-level generators
# ---------------------------------------------------------------------------

def _generate_cohort_python(canonical: Dict[str, Any]) -> str:
    """
    Generate Python for a Cohort-like object, extracting child phenotypes as
    named variables for readability.
    """
    imports: Set[str] = set()
    lines: List[str] = []
    used_vars: Set[str] = set()

    class_name = canonical.get("class_name", "Cohort")

    def _unique_var(base: str) -> str:
        """Ensure no duplicate variable names."""
        candidate = base
        counter = 2
        while candidate in used_vars:
            candidate = f"{base}_{counter}"
            counter += 1
        used_vars.add(candidate)
        return candidate

    # Extract phenotype slots as named variables
    slot_var_names: Dict[str, Any] = {}  # slot -> var_name or [var_names]

    for slot in _PHENOTYPE_SLOTS:
        value = canonical.get(slot)
        if value is None:
            continue

        if _is_phenex_object(value):
            var = _unique_var(_build_variable_name(value))
            lines.append(f"{var} = {_emit_constructor(value, imports, 0)}")
            lines.append("")
            slot_var_names[slot] = var

        elif isinstance(value, list) and value:
            var_names = []
            for item in value:
                if _is_phenex_object(item):
                    var = _unique_var(_build_variable_name(item))
                    lines.append(f"{var} = {_emit_constructor(item, imports, 0)}")
                    lines.append("")
                    var_names.append(var)
            if var_names:
                slot_var_names[slot] = var_names

    # Build Cohort constructor
    module = _IMPORT_MAP.get(class_name)
    if module:
        imports.add(f"from {module} import {class_name}")

    cohort_params: List[str] = []
    cohort_name = canonical.get("name")
    if cohort_name:
        cohort_params.append(f"    name={cohort_name!r},")

    for slot in _PHENOTYPE_SLOTS:
        if slot not in slot_var_names:
            continue
        ref = slot_var_names[slot]
        if isinstance(ref, str):
            cohort_params.append(f"    {slot}={ref},")
        elif isinstance(ref, list):
            list_str = "[" + ", ".join(ref) + "]"
            cohort_params.append(f"    {slot}={list_str},")

    desc = canonical.get("description")
    if desc:
        cohort_params.append(f"    description={desc!r},")

    cohort_var = _unique_var(_build_variable_name(canonical))
    lines.append(f"{cohort_var} = {class_name}(")
    lines.extend(cohort_params)
    lines.append(")")

    import_block = "\n".join(sorted(imports))
    return import_block + "\n\n\n" + "\n".join(lines) + "\n"


def _generate_simple_python(canonical: Dict[str, Any]) -> str:
    """Generate Python for any non-Cohort PhenEx object (single assignment)."""
    imports: Set[str] = set()
    var = _build_variable_name(canonical)
    constructor = _emit_constructor(canonical, imports, 0)
    body = f"{var} = {constructor}\n"
    import_block = "\n".join(sorted(imports))
    return import_block + "\n\n\n" + body


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_python(definition: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate idiomatic Python from any PhenEx definition dict.

    Accepts any PhenEx expression: Cohort, phenotype, filter, codelist, etc.
    The dict is first compiled with from_dict() to validate correctness, then
    to_dict() is called on the compiled object to get the canonical form which
    is walked to emit Python.

    Returns a dict with 'success', 'code' (the Python string), and 'error'.
    """
    # --- Input validation ---
    if not isinstance(definition, dict):
        return {
            "success": False,
            "error": f"Expected a dictionary, got {type(definition).__name__}.",
        }

    class_name = definition.get("class_name") or definition.get("type")
    if not class_name:
        return {
            "success": False,
            "error": (
                "Definition must have a 'class_name' (or 'type') field. "
                "Call phenex_list_classes() to see valid class names."
            ),
        }

    if class_name not in _IMPORT_MAP:
        return {
            "success": False,
            "error": (
                f"Unknown class '{class_name}'. "
                f"Call phenex_list_classes() to see valid class names."
            ),
        }

    try:
        from phenex.util.serialization.from_dict import from_dict
        from phenex.util.serialization.to_dict import to_dict
    except ImportError:
        return {
            "success": False,
            "error": "PhenEx library not available. Install with: pip install phenex",
        }

    from cohort_tools import _prepare_cohort_for_compilation, translate_phenotype_to_native

    # --- Prepare (type->class_name, codelist resolution, filter wrapping) ---
    try:
        if class_name in _COHORT_LIKE:
            prepared = _prepare_cohort_for_compilation(definition)
        elif class_name in _IMPORT_MAP and _IMPORT_MAP[class_name] in (
            "phenex.phenotypes",
        ):
            # Only phenotypes need the full translation (codelist wrapping, etc.)
            prepared = translate_phenotype_to_native(definition)
        else:
            # Filters, codelists, etc. — just normalize type->class_name
            prepared = definition.copy()
            if "type" in prepared and "class_name" not in prepared:
                prepared["class_name"] = prepared.pop("type")
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to prepare definition: {type(e).__name__}: {e}",
        }

    # --- Compile to validate ---
    try:
        compiled = from_dict(prepared)
    except Exception as e:
        return {
            "success": False,
            "error": (
                f"Definition failed to compile: {type(e).__name__}: {e}. "
                f"Fix errors first (use phenex_validate_phenotype or "
                f"phenex_validate_cohort), then try again."
            ),
        }

    # --- Serialize to canonical dict ---
    canonical = to_dict(compiled)

    # --- Generate Python ---
    if canonical.get("class_name") in _COHORT_LIKE:
        code = _generate_cohort_python(canonical)
    else:
        code = _generate_simple_python(canonical)

    return {
        "success": True,
        "code": code,
    }
