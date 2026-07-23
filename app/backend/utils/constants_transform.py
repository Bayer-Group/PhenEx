"""
Transformation utilities for constants.

Handles conversion between:
- UI format (operator strings like ">=", "<=")
- Storage format (comparator classes like "GreaterThanOrEqualTo", "LessThanOrEqualTo")
"""

from typing import Dict, Any, Optional


# ============================================================================
# Operator <-> Comparator Class Mappings
# ============================================================================

OPERATOR_TO_COMPARATOR: Dict[str, Dict[str, str]] = {
    # For numeric comparisons (min_days, max_days)
    "numeric": {
        ">": "GreaterThan",
        ">=": "GreaterThanOrEqualTo",
        "<": "LessThan",
        "<=": "LessThanOrEqualTo",
        "=": "EqualTo",
    },
    # For date comparisons (min_value, max_value)
    "date": {
        ">": "After",
        ">=": "AfterOrOn",
        "<": "Before",
        "<=": "BeforeOrOn",
    },
}

COMPARATOR_TO_OPERATOR: Dict[str, str] = {
    # Numeric comparators
    "GreaterThan": ">",
    "GreaterThanOrEqualTo": ">=",
    "GreaterThanOrEqual": ">=",  # Alternative name
    "LessThan": "<",
    "LessThanOrEqualTo": "<=",
    "LessThanOrEqual": "<=",  # Alternative name
    "EqualTo": "=",
    # Date comparators
    "After": ">",
    "AfterOrOn": ">=",
    "Before": "<",
    "BeforeOrOn": "<=",
}


# ============================================================================
# UI Format -> Storage Format
# ============================================================================


def ui_to_storage_comparator(
    field: Dict[str, Any], comparator_type: str = "numeric"
) -> Optional[Dict[str, Any]]:
    """
    Convert UI format (operator + value) to storage format (class_name + value).

    UI format:
        {class_name: "Value", operator: ">=", value: 365}

    Storage format:
        {class_name: "GreaterThanOrEqualTo", value: 365}

    Args:
        field: The field to convert (e.g., min_days, max_days)
        comparator_type: Either "numeric" or "date"

    Returns:
        Converted field or None if input is None
    """
    if field is None:
        return None

    # If already in storage format, return as-is
    if field.get("class_name") != "Value":
        return field

    operator = field.get("operator")
    value = field.get("value")

    if operator == "not set" or operator is None:
        return None

    mapping = OPERATOR_TO_COMPARATOR.get(comparator_type, {})
    class_name = mapping.get(operator)

    if not class_name:
        raise ValueError(f"Unknown operator '{operator}' for {comparator_type} comparator")

    result = {"class_name": class_name, "value": value}

    # Preserve date-specific fields
    if comparator_type == "date":
        result["operator"] = operator
        if "date_format" in field:
            result["date_format"] = field["date_format"]

    return result


def ui_to_storage_relative_time_range(ui_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert RelativeTimeRangeFilter from UI format to storage format.

    Removes UI-specific fields and converts operator strings to comparator classes.
    """
    storage_value = {
        "class_name": "RelativeTimeRangeFilter",
        "when": ui_value.get("when", "before"),
    }

    # Convert min_days
    min_days = ui_value.get("min_days")
    if min_days:
        storage_value["min_days"] = ui_to_storage_comparator(min_days, "numeric")
    else:
        storage_value["min_days"] = None

    # Convert max_days
    max_days = ui_value.get("max_days")
    if max_days:
        storage_value["max_days"] = ui_to_storage_comparator(max_days, "numeric")
    else:
        storage_value["max_days"] = None

    # Validate at least one is provided
    if storage_value["min_days"] is None and storage_value["max_days"] is None:
        raise ValueError("RelativeTimeRangeFilter must have at least one of min_days or max_days")

    # Handle anchor phenotype
    if ui_value.get("anchor_phenotype"):
        storage_value["anchor_phenotype_id"] = ui_value["anchor_phenotype"]
    elif "anchor_phenotype_id" in ui_value:
        storage_value["anchor_phenotype_id"] = ui_value["anchor_phenotype_id"]
    else:
        storage_value["anchor_phenotype_id"] = None

    # Remove UI-specific fields (useConstant, useIndexDate are only for references)
    # These should never be in a stored constant value

    return storage_value


def ui_to_storage_categorical_filter(ui_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert CategoricalFilter from UI format to storage format.

    Removes UI-specific fields.
    """
    storage_value = {
        "class_name": "CategoricalFilter",
        "column_name": ui_value.get("column_name", ""),
        "operator": ui_value.get("operator", "isin"),
        "allowed_values": ui_value.get("allowed_values", []),
    }

    # Validate for non-empty constants (allow empty for new constants being created)
    if storage_value["column_name"] and storage_value["operator"] in ["isin", "notin"]:
        if len(storage_value["allowed_values"]) == 0:
            raise ValueError(
                f"CategoricalFilter with operator '{storage_value['operator']}' must have allowed_values"
            )

    return storage_value


def ui_to_storage_date_filter(ui_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert DateFilter from UI format to storage format.

    DateFilter is stored as a ValueFilter with Date comparators.
    """
    storage_value = {
        "class_name": "ValueFilter",
        "column_name": ui_value.get("column_name", "EVENT_DATE"),
    }

    # Convert min_value
    min_value = ui_value.get("min_value")
    storage_value["min_value"] = ui_to_storage_comparator(min_value, "date")

    # Convert max_value
    max_value = ui_value.get("max_value")
    storage_value["max_value"] = ui_to_storage_comparator(max_value, "date")

    return storage_value


def ui_to_storage_value(constant_type: str, ui_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert constant value from UI format to storage format.

    Args:
        constant_type: The type of constant (RelativeTimeRangeFilter, CategoricalFilter, etc.)
        ui_value: The value in UI format

    Returns:
        The value in storage format
    """
    # Handle array wrapper issue (UI sometimes wraps in array)
    if isinstance(ui_value, list) and len(ui_value) > 0:
        ui_value = ui_value[0]

    if constant_type == "RelativeTimeRangeFilter":
        return ui_to_storage_relative_time_range(ui_value)
    elif constant_type == "CategoricalFilter":
        return ui_to_storage_categorical_filter(ui_value)
    elif constant_type == "DateFilter":
        return ui_to_storage_date_filter(ui_value)
    elif constant_type == "array":
        # Array type is simple, no transformation needed
        return ui_value
    else:
        raise ValueError(f"Unknown constant type: {constant_type}")


# ============================================================================
# Storage Format -> UI Format
# ============================================================================


def storage_to_ui_comparator(field: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Convert storage format (class_name + value) to UI format (operator + value).

    Storage format:
        {class_name: "GreaterThanOrEqualTo", value: 365}

    UI format:
        {class_name: "Value", operator: ">=", value: 365}

    Args:
        field: The field to convert (e.g., min_days, max_days)

    Returns:
        Converted field or None if input is None
    """
    if field is None:
        return None

    # If already in UI format, return as-is
    if field.get("class_name") == "Value":
        return field

    class_name = field.get("class_name")
    value = field.get("value")

    operator = COMPARATOR_TO_OPERATOR.get(class_name)

    if not operator:
        raise ValueError(f"Unknown comparator class: {class_name}")

    result = {"class_name": "Value", "operator": operator, "value": value}

    # Preserve date format if present
    if "date_format" in field:
        result["date_format"] = field["date_format"]

    return result


def storage_to_ui_relative_time_range(storage_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert RelativeTimeRangeFilter from storage format to UI format.

    Adds UI-specific fields and converts comparator classes to operator strings.
    """
    ui_value = {
        "class_name": "RelativeTimeRangeFilter",
        "when": storage_value.get("when", "before"),
    }

    # Convert min_days
    min_days = storage_value.get("min_days")
    ui_value["min_days"] = storage_to_ui_comparator(min_days)

    # Convert max_days
    max_days = storage_value.get("max_days")
    ui_value["max_days"] = storage_to_ui_comparator(max_days)

    # Handle anchor phenotype
    if "anchor_phenotype_id" in storage_value:
        ui_value["anchor_phenotype"] = storage_value["anchor_phenotype_id"]
        ui_value["useIndexDate"] = False
    else:
        ui_value["anchor_phenotype"] = None
        ui_value["useIndexDate"] = True

    # These are for UI editing, not stored in constants
    ui_value["useConstant"] = False

    return ui_value


def storage_to_ui_categorical_filter(storage_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert CategoricalFilter from storage format to UI format.

    Adds UI-specific fields.
    """
    ui_value = {
        "class_name": "CategoricalFilter",
        "column_name": storage_value.get("column_name", ""),
        "operator": storage_value.get("operator", "isin"),
        "allowed_values": storage_value.get("allowed_values", []),
        "useConstant": False,
    }

    # Add domain if present (though it's not typically stored in the constant)
    if "domain" in storage_value:
        ui_value["domain"] = storage_value["domain"]

    return ui_value


def storage_to_ui_date_filter(storage_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert DateFilter from storage format to UI format.
    """
    ui_value = {
        "class_name": "ValueFilter",
        "column_name": storage_value.get("column_name", "EVENT_DATE"),
    }

    # Convert min_value
    min_value = storage_value.get("min_value")
    ui_value["min_value"] = storage_to_ui_comparator(min_value)

    # Convert max_value
    max_value = storage_value.get("max_value")
    ui_value["max_value"] = storage_to_ui_comparator(max_value)

    return ui_value


def storage_to_ui_value(constant_type: str, storage_value: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert constant value from storage format to UI format.

    Args:
        constant_type: The type of constant (RelativeTimeRangeFilter, CategoricalFilter, etc.)
        storage_value: The value in storage format

    Returns:
        The value in UI format
    """
    if constant_type == "RelativeTimeRangeFilter":
        return storage_to_ui_relative_time_range(storage_value)
    elif constant_type == "CategoricalFilter":
        return storage_to_ui_categorical_filter(storage_value)
    elif constant_type == "DateFilter":
        return storage_to_ui_date_filter(storage_value)
    elif constant_type == "array":
        # Array type is simple, no transformation needed
        return storage_value
    else:
        raise ValueError(f"Unknown constant type: {constant_type}")
