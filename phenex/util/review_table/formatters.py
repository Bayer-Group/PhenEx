"""Text descriptions for phenotype parameters.

Each function turns a raw parameter value (as stored in the app's cohort JSON)
into the same short text the CohortCardViewer renders in its cells. An empty
string means "nothing to show" (the parameter applies but has no value).
"""

from typing import Any, List, Optional

# Keys inside a manual codelist dict that are metadata, not code lists.
_CODELIST_META_KEYS = {
    "file_name",
    "codelist_name",
    "file_id",
    "code_column",
    "code_type_column",
    "codelist_column",
}

_MAX_CODES_SHOWN = 3


def _is_empty(value: Any) -> bool:
    """True for values that represent an unset/required field."""
    return value is None or value == "" or value == "missing"


def format_plain(value: Any) -> str:
    """Scalar fields (class name, return date, value aggregation)."""
    if _is_empty(value):
        return ""
    return str(value)


def format_domain(value: Any) -> str:
    if _is_empty(value):
        return ""
    return str(value).replace("_", " ")


def format_relative_time_range(value: Any) -> str:
    filters = value if isinstance(value, list) else []
    return "\n".join(_format_time_range(f) for f in filters if isinstance(f, dict))


def _format_time_range(f: dict) -> str:
    if f.get("useConstant") and f.get("constant"):
        return str(f["constant"])

    if f.get("useIndexDate"):
        reference = "index date"
    else:
        anchor = f.get("anchor_phenotype")
        if isinstance(anchor, dict):
            reference = anchor.get("name") or "unknown phenotype"
        else:
            reference = anchor or "unknown phenotype"

    min_days = f.get("min_days") or {}
    max_days = f.get("max_days") or {}
    min_value = min_days.get("value", 0)
    min_value = 0 if min_value is None else min_value
    min_open = "(" if min_days.get("operator") == ">" else "["
    max_value = max_days.get("value")
    max_value = "\u221e" if max_value is None else max_value
    max_close = "]" if max_days.get("operator") == "<=" else ")"

    when = f.get("when", "")
    return f"{min_open}{min_value}, {max_value}{max_close} {when} {reference}".strip()


def format_value_filter(value: Any) -> str:
    filt = _to_single_filter(value)
    if not filt:
        return ""
    parts: List[str] = []
    if filt.get("column_name"):
        parts.append(str(filt["column_name"]))
    for key in ("min_value", "max_value"):
        bound = filt.get(key)
        if bound:
            parts.append(f"{bound.get('operator', '')} {bound.get('value')}".strip())
    return " ".join(parts).strip()


def _to_single_filter(value: Any) -> Optional[dict]:
    """Coerce a value filter (single, array, or AndFilter) to one ValueFilter."""
    if not value:
        return None
    if isinstance(value, list):
        return value[0] if value else None
    if isinstance(value, dict) and value.get("class_name") == "AndFilter":
        return value.get("filter1")
    return value if isinstance(value, dict) else None


def format_date_range(value: Any) -> str:
    if not isinstance(value, dict) or value.get("class_name") != "ValueFilter":
        return ""
    parts: List[str] = []
    for key in ("min_value", "max_value"):
        bound = value.get(key)
        if bound:
            date = (bound.get("value") or {}).get("__datetime__", "")
            parts.append(f"{bound.get('operator', '')} {date}".strip())
    return " ".join(parts).strip()


def format_categorical_filter(value: Any) -> str:
    return " ".join(_flatten_logical(value, _render_categorical, depth=0))


def format_expression(value: Any) -> str:
    return " ".join(_flatten_logical(value, _render_expression, depth=0))


def _render_categorical(node: dict) -> Optional[str]:
    if node.get("class_name") != "CategoricalFilter":
        return None
    values = ", ".join(node.get("allowed_values", []) or [])
    return f"{values} {node.get('column_name', '')}".strip()


def _render_expression(node: dict) -> Optional[str]:
    if node.get("class_name") != "LogicalExpression":
        return None
    return node.get("phenotype_name") or "(empty)"


def _flatten_logical(node: Any, render_leaf, depth: int) -> List[str]:
    """Flatten an And/Or filter tree into infix tokens (leaves + AND/OR/parens)."""
    if not isinstance(node, dict):
        return []

    leaf = render_leaf(node)
    if leaf is not None:
        return [leaf]

    class_name = node.get("class_name")
    if class_name not in ("AndFilter", "OrFilter"):
        return []

    operator = "AND" if class_name == "AndFilter" else "OR"
    tokens: List[str] = []
    if depth > 0:
        tokens.append("(")
    if node.get("filter1"):
        tokens += _flatten_logical(node["filter1"], render_leaf, depth + 1)
    tokens.append(operator)
    if node.get("filter2"):
        tokens += _flatten_logical(node["filter2"], render_leaf, depth + 1)
    if depth > 0:
        tokens.append(")")
    return tokens


def format_codelist(value: Any) -> str:
    if _is_empty(value):
        return ""
    items = value if isinstance(value, list) else [value]
    rendered = [_format_single_codelist(item) for item in items if isinstance(item, dict)]
    return "\n".join(part for part in rendered if part)


def _format_single_codelist(codelist_value: dict) -> str:
    if codelist_value.get("codelist_type") == "from file":
        name = codelist_value.get("codelist_name") or (
            codelist_value.get("codelist") or {}
        ).get("codelist_name")
        return (name or "Unknown codelist").replace("_", " ")

    codelist = codelist_value.get("codelist")
    if not isinstance(codelist, dict):
        return ""
    # A Codelist object may be nested one level deeper.
    actual = codelist.get("codelist") if isinstance(codelist.get("codelist"), dict) else codelist

    blocks: List[str] = []
    for code_type, codes in actual.items():
        if code_type in _CODELIST_META_KEYS or not isinstance(codes, list):
            continue
        shown = codes[:_MAX_CODES_SHOWN]
        codes_text = ", ".join(str(c) for c in shown)
        if len(codes) > _MAX_CODES_SHOWN:
            codes_text += ", ..."
        blocks.append(f"{codes_text} ({code_type.replace('_', ' ')})")
    return "\n".join(blocks)
