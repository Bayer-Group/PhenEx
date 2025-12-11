"""
Atomic phenotype update functions for PhenEx AI system.

These functions provide granular control over phenotype modifications
with proper type validation and error handling.
"""

from typing import Dict, List, Any, Optional, Union
import logging
from pydantic import BaseModel
from pydantic_ai import RunContext

logger = logging.getLogger(__name__)


class PhenotypeValidationError(Exception):
    """Raised when a phenotype operation is not valid for the given phenotype type."""

    pass


class AtomicUpdateResult(BaseModel):
    """Result of an atomic update operation."""

    success: bool
    message: str
    phenotype_id: str
    updated_field: str
    old_value: Any = None
    new_value: Any = None


# Phenotype type capabilities mapping
# NOTE: Domain restrictions use uppercase OMOP standard names
PHENOTYPE_CAPABILITIES = {
    "AgePhenotype": {
        "supported_fields": ["value_filter", "name", "description", "domain", "type"],
        "requires": ["value_filter"],
        "domain_restrictions": ["PERSON"],
    },
    "CodelistPhenotype": {
        "supported_fields": [
            "codelist",
            "relative_time_range",
            "name",
            "description",
            "domain",
            "type",
            "return_date",
        ],
        "requires": ["codelist"],
        "domain_restrictions": [
            "CONDITION_OCCURRENCE",
            "PROCEDURE_OCCURRENCE",
            "DRUG_EXPOSURE",
            "VISIT_OCCURRENCE",
        ],
    },
    "MeasurementPhenotype": {
        "supported_fields": [
            "codelist",
            "value_filter",
            "relative_time_range",
            "name",
            "description",
            "domain",
            "type",
            "return_date",
        ],
        "requires": ["codelist"],
        "domain_restrictions": ["MEASUREMENT"],
    },
    "CategoricalPhenotype": {
        "supported_fields": [
            "categorical_filter",
            "name",
            "description",
            "domain",
            "type",
        ],
        "requires": ["categorical_filter"],
        "domain_restrictions": ["PERSON"],
    },
    "SexPhenotype": {
        "supported_fields": [
            "categorical_filter",
            "name",
            "description",
            "domain",
            "type",
        ],
        "requires": ["categorical_filter"],
        "domain_restrictions": ["PERSON"],
    },
    "DeathPhenotype": {
        "supported_fields": [
            "relative_time_range",
            "name",
            "description",
            "domain",
            "type",
            "return_date",
        ],
        "requires": [],
        "domain_restrictions": ["DEATH", "PERSON"],
    },
    "TimeRangePhenotype": {
        "supported_fields": [
            "relative_time_range",
            "name",
            "description",
            "domain",
            "type",
        ],
        "requires": ["relative_time_range"],
        "domain_restrictions": ["OBSERVATION_PERIOD", "PERSON", "VISIT_OCCURRENCE"],
    },
    "EventCountPhenotype": {
        "supported_fields": [
            "phenotype",
            "value_filter",
            "relative_time_range",
            "name",
            "description",
            "type",
            "return_date",
            "component_date_select",
        ],
        "requires": ["phenotype"],
        "domain_restrictions": [],  # Uses domain from component phenotype
    },
}


def validate_phenotype_operation(
    phenotype: Dict[str, Any], field: str, operation_name: str
) -> None:
    """
    Validate if an operation is allowed for the given phenotype type.

    Args:
        phenotype: The phenotype dictionary
        field: The field being updated
        operation_name: Name of the operation for error messages

    Raises:
        PhenotypeValidationError: If operation is not supported
    """
    phenotype_class = phenotype.get("class_name", "Unknown")

    if phenotype_class not in PHENOTYPE_CAPABILITIES:
        raise PhenotypeValidationError(
            f"Unknown phenotype type: {phenotype_class}. Cannot perform {operation_name}."
        )

    capabilities = PHENOTYPE_CAPABILITIES[phenotype_class]

    if field not in capabilities["supported_fields"]:
        supported = ", ".join(capabilities["supported_fields"])
        raise PhenotypeValidationError(
            f"{phenotype_class} does not support {field} updates. "
            f"Supported fields: {supported}. Operation: {operation_name}"
        )


def find_phenotype_by_id(
    cohort: Dict[str, Any], phenotype_id: str
) -> Optional[Dict[str, Any]]:
    """Find a phenotype in the cohort by ID."""
    for phenotype in cohort.get("phenotypes", []):
        if phenotype.get("id") == phenotype_id:
            return phenotype
    return None


def update_phenotype_field(
    cohort: Dict[str, Any],
    phenotype_id: str,
    field: str,
    value: Any,
    operation_name: str,
) -> AtomicUpdateResult:
    """
    Generic function to update a phenotype field with validation.

    Args:
        cohort: The cohort dictionary
        phenotype_id: ID of phenotype to update
        field: Field name to update
        value: New value for the field
        operation_name: Name of operation for logging/errors

    Returns:
        AtomicUpdateResult with success status and details
    """
    try:
        # Find phenotype
        phenotype = find_phenotype_by_id(cohort, phenotype_id)
        if not phenotype:
            return AtomicUpdateResult(
                success=False,
                message=f"Phenotype with ID '{phenotype_id}' not found",
                phenotype_id=phenotype_id,
                updated_field=field,
            )

        # Validate operation
        validate_phenotype_operation(phenotype, field, operation_name)

        # Store old value
        old_value = phenotype.get(field)

        # Update field
        phenotype[field] = value

        return AtomicUpdateResult(
            success=True,
            message=f"Successfully updated {field} for {phenotype.get('name', phenotype_id)}",
            phenotype_id=phenotype_id,
            updated_field=field,
            old_value=old_value,
            new_value=value,
        )

    except PhenotypeValidationError as e:
        return AtomicUpdateResult(
            success=False,
            message=str(e),
            phenotype_id=phenotype_id,
            updated_field=field,
        )
    except Exception as e:
        return AtomicUpdateResult(
            success=False,
            message=f"Unexpected error in {operation_name}: {str(e)}",
            phenotype_id=phenotype_id,
            updated_field=field,
        )


# ===================== ATOMIC UPDATE FUNCTIONS =====================


async def update_value_filter(
    ctx: RunContext, phenotype_id: str, value_filter: Dict[str, Any]
) -> str:
    """
    Update the value filter for a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        value_filter: New value filter parameters

    Returns:
        Success/failure message
    """
    # Add operator field for UI compatibility while keeping class_name
    if value_filter and isinstance(value_filter, dict):
        # Mapping from PhenEx class names to UI operators
        class_to_operator = {
            "GreaterThan": ">",
            "GreaterThanOrEqual": ">=",
            "GreaterThanOrEqualTo": ">=",  # Alternative name
            "LessThan": "<",
            "LessThanOrEqual": "<=",
            "LessThanOrEqualTo": "<=",  # Alternative name
        }

        # Add operator to min_value if present
        if "min_value" in value_filter and value_filter["min_value"]:
            min_val = value_filter["min_value"]
            if isinstance(min_val, dict) and "class_name" in min_val:
                operator_class = min_val["class_name"]
                if operator_class in class_to_operator:
                    min_val["operator"] = class_to_operator[operator_class]

        # Add operator to max_value if present
        if "max_value" in value_filter and value_filter["max_value"]:
            max_val = value_filter["max_value"]
            if isinstance(max_val, dict) and "class_name" in max_val:
                operator_class = max_val["class_name"]
                if operator_class in class_to_operator:
                    max_val["operator"] = class_to_operator[operator_class]

    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort, phenotype_id, "value_filter", value_filter, "update_value_filter"
    )

    if result.success:
        logger.info(f"Updated value filter for phenotype {phenotype_id}")
    else:
        logger.error(f"Failed to update value filter: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_relative_time_range(
    ctx: RunContext, phenotype_id: str, relative_time_range: Dict[str, Any]
) -> str:
    """
    Update the time range filters for a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        relative_time_range: New time range filter parameters

    Returns:
        Success/failure message
    """
    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort,
        phenotype_id,
        "relative_time_range",
        relative_time_range,
        "update_relative_time_range",
    )

    if result.success:
        logger.info(f"Updated time range filters for phenotype {phenotype_id}")
    else:
        logger.error(f"Failed to update time range filters: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_codelist(
    ctx: RunContext, phenotype_id: str, codelist: Dict[str, Any]
) -> str:
    """
    Update the codelist for a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        codelist: New codelist parameters

    Returns:
        Success/failure message
    """
    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort, phenotype_id, "codelist", codelist, "update_codelist"
    )

    if result.success:
        logger.info(f"Updated codelist for phenotype {phenotype_id}")
    else:
        logger.error(f"Failed to update codelist: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_name(ctx: RunContext, phenotype_id: str, name: str) -> str:
    """
    Update the name of a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        name: New name for the phenotype

    Returns:
        Success/failure message
    """
    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(cohort, phenotype_id, "name", name, "update_name")

    if result.success:
        logger.info(f"Updated name for phenotype {phenotype_id} to '{name}'")
    else:
        logger.error(f"Failed to update name: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_description(
    ctx: RunContext, phenotype_id: str, description: str
) -> str:
    """
    Update the description of a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        description: New description for the phenotype

    Returns:
        Success/failure message
    """
    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort, phenotype_id, "description", description, "update_description"
    )

    if result.success:
        logger.info(f"Updated description for phenotype {phenotype_id}")
    else:
        logger.error(f"Failed to update description: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_domain(ctx: RunContext, phenotype_id: str, domain: str) -> str:
    """
    Update the domain of a phenotype with validation.

    Args:
        phenotype_id: ID of the phenotype to update
        domain: New domain for the phenotype

    Returns:
        Success/failure message
    """
    cohort = ctx.deps.current_cohort

    # Additional validation for domain restrictions
    phenotype = find_phenotype_by_id(cohort, phenotype_id)
    if phenotype:
        phenotype_class = phenotype.get("class_name", "Unknown")
        if phenotype_class in PHENOTYPE_CAPABILITIES:
            allowed_domains = PHENOTYPE_CAPABILITIES[phenotype_class][
                "domain_restrictions"
            ]
            if allowed_domains and domain not in allowed_domains:
                allowed_str = ", ".join(allowed_domains)
                return f"❌ {phenotype_class} only supports domains: {allowed_str}. Cannot set to '{domain}'"

    result = update_phenotype_field(
        cohort, phenotype_id, "domain", domain, "update_domain"
    )

    if result.success:
        logger.info(f"Updated domain for phenotype {phenotype_id} to '{domain}'")
    else:
        logger.error(f"Failed to update domain: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_type(ctx: RunContext, phenotype_id: str, phenotype_type: str) -> str:
    """
    Update the type (inclusion/exclusion/characteristics/outcome) of a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        phenotype_type: New type for the phenotype

    Returns:
        Success/failure message
    """
    valid_types = ["entry", "inclusion", "exclusion", "characteristics", "outcome"]
    if phenotype_type not in valid_types:
        valid_str = ", ".join(valid_types)
        return f"❌ Invalid phenotype type '{phenotype_type}'. Valid types: {valid_str}"

    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort, phenotype_id, "type", phenotype_type, "update_type"
    )

    if result.success:
        logger.info(f"Updated type for phenotype {phenotype_id} to '{phenotype_type}'")
    else:
        logger.error(f"Failed to update type: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_return_date(
    ctx: RunContext, phenotype_id: str, return_date: bool
) -> str:
    """
    Update the return_date flag for a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        return_date: Whether to return dates for this phenotype

    Returns:
        Success/failure message
    """
    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort, phenotype_id, "return_date", return_date, "update_return_date"
    )

    if result.success:
        logger.info(
            f"Updated return_date for phenotype {phenotype_id} to {return_date}"
        )
    else:
        logger.error(f"Failed to update return_date: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_categorical_filter(
    ctx: RunContext, phenotype_id: str, categorical_filter: Dict[str, Any]
) -> str:
    """
    Update the categorical filter for a phenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        categorical_filter: New categorical filter parameters

    Returns:
        Success/failure message
    """
    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort,
        phenotype_id,
        "categorical_filter",
        categorical_filter,
        "update_categorical_filter",
    )

    if result.success:
        logger.info(f"Updated categorical filter for phenotype {phenotype_id}")
    else:
        logger.error(f"Failed to update categorical filter: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_nested_phenotype(
    ctx: RunContext, phenotype_id: str, nested_phenotype: Dict[str, Any]
) -> str:
    """
    Update the nested phenotype field for composite phenotypes like EventCountPhenotype.

    Args:
        phenotype_id: ID of the phenotype to update
        nested_phenotype: Complete nested phenotype object (typically a CodelistPhenotype)

    Returns:
        Success/failure message
    """
    # 🔧 AUTOMATIC TYPE ASSIGNMENT: Nested phenotypes in EventCountPhenotype are always "component" type
    # They are internal building blocks, not direct research criteria
    if "type" not in nested_phenotype:
        nested_phenotype["type"] = "component"
        logger.info(
            f"🔧 Auto-added type='component' to nested phenotype (nested phenotypes are internal building blocks)"
        )
    elif nested_phenotype["type"] != "component":
        logger.warning(
            f"⚠️  Nested phenotype has type='{nested_phenotype['type']}', but should be 'component'. Auto-correcting..."
        )
        nested_phenotype["type"] = "component"

    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort, phenotype_id, "phenotype", nested_phenotype, "update_nested_phenotype"
    )

    if result.success:
        logger.info(f"Updated nested phenotype for phenotype {phenotype_id}")
    else:
        logger.error(f"Failed to update nested phenotype: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


async def update_component_date_select(
    ctx: RunContext, phenotype_id: str, component_date_select: str
) -> str:
    """
    Update the component_date_select field for EventCountPhenotype.

    Args:
        phenotype_id: ID of the EventCountPhenotype to update
        component_date_select: Which event date to use as index ("first", "second", or "last")

    Returns:
        Success/failure message
    """
    if component_date_select not in ["first", "second", "last"]:
        return f"❌ Invalid component_date_select value '{component_date_select}'. Must be 'first', 'second', or 'last'."

    cohort = ctx.deps.current_cohort
    result = update_phenotype_field(
        cohort,
        phenotype_id,
        "component_date_select",
        component_date_select,
        "update_component_date_select",
    )

    if result.success:
        logger.info(
            f"Updated component_date_select to '{component_date_select}' for phenotype {phenotype_id}"
        )
    else:
        logger.error(f"Failed to update component_date_select: {result.message}")

    return "✅ " + result.message if result.success else "❌ " + result.message


def get_phenotype_capabilities(phenotype_class: str) -> Dict[str, Any]:
    """Get the capabilities and restrictions for a phenotype class."""
    return PHENOTYPE_CAPABILITIES.get(
        phenotype_class,
        {"supported_fields": [], "requires": [], "domain_restrictions": []},
    )
