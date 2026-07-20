"""
Pydantic models for constants validation.

This module defines the schema for different constant types used in PhenEx studies.
Each constant type has a specific structure that must be validated before storage.
"""

from typing import Optional, Literal, Union, List, Annotated
from pydantic import BaseModel, Field, field_validator, model_validator, Tag
from datetime import date


# ============================================================================
# Base Value Comparators
# ============================================================================


class NumericComparator(BaseModel):
    """Base model for numeric comparators (GreaterThan, LessThan, etc.)"""

    class_name: Literal[
        "GreaterThan", "GreaterThanOrEqualTo", "LessThan", "LessThanOrEqualTo", "EqualTo"
    ]
    value: float


class DateValue(BaseModel):
    """Special datetime serialization format used by PhenEx"""

    __datetime__: str  # ISO format datetime string


class DateComparator(BaseModel):
    """Base model for date comparators (Before, After, etc.)"""

    class_name: Literal["Before", "BeforeOrOn", "After", "AfterOrOn"]
    operator: Literal[">", ">=", "<", "<="]
    value: DateValue
    date_format: Optional[str] = None


# ============================================================================
# Constant Value Models
# ============================================================================


class RelativeTimeRangeFilterValue(BaseModel):
    """
    RelativeTimeRangeFilter defines a time window relative to an anchor date.

    Used for filtering events based on their temporal relationship to:
    - Index date (useIndexDate=true)
    - Another phenotype's date (anchor_phenotype_id)

    Examples:
    - "Last year before index": when="before", min_days=GreaterThanOrEqualTo(1), max_days=LessThanOrEqualTo(365)
    - "First 30 days after index": when="after", min_days=GreaterThanOrEqualTo(1), max_days=LessThanOrEqualTo(30)
    """

    class_name: Literal["RelativeTimeRangeFilter"]
    when: Literal["before", "after", "range"]
    min_days: Optional[NumericComparator] = None
    max_days: Optional[NumericComparator] = None
    anchor_phenotype_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_days_range(self):
        """Ensure at least one of min_days or max_days is specified"""
        if self.min_days is None and self.max_days is None:
            raise ValueError("At least one of min_days or max_days must be specified")

        # Validate comparator class names match the field
        if self.min_days and self.min_days.class_name not in [
            "GreaterThan",
            "GreaterThanOrEqualTo",
        ]:
            raise ValueError(
                f"min_days must use GreaterThan or GreaterThanOrEqualTo, got {self.min_days.class_name}"
            )

        if self.max_days and self.max_days.class_name not in [
            "LessThan",
            "LessThanOrEqualTo",
        ]:
            raise ValueError(
                f"max_days must use LessThan or LessThanOrEqualTo, got {self.max_days.class_name}"
            )

        return self


class CategoricalFilterValue(BaseModel):
    """
    CategoricalFilter filters records based on categorical column values.

    Used for filtering based on categorical data like gender, status codes, etc.

    Examples:
    - Gender filter: column_name="GENDER_SOURCE_VALUE", operator="isin", allowed_values=["M", "F"]
    - Non-null check: column_name="STATUS", operator="notnull", allowed_values=[]
    """

    class_name: Literal["CategoricalFilter"]
    column_name: str = Field(default="")  # Allow empty initially, will be filled in editor
    operator: Literal["isin", "notin", "isnull", "notnull"] = "isin"
    allowed_values: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_allowed_values(self):
        """Validate that allowed_values is provided when needed"""
        # Only validate if column_name is set (not a new empty constant)
        if self.column_name and self.operator in ["isin", "notin"] and len(self.allowed_values) == 0:
            raise ValueError(
                f"allowed_values must be non-empty for operator '{self.operator}'"
            )

        if self.operator in ["isnull", "notnull"] and len(self.allowed_values) > 0:
            # Just warn, don't fail - clean it up
            self.allowed_values = []

        return self


class DateFilterValue(BaseModel):
    """
    DateFilter filters records based on absolute date ranges.

    Internally represented as a ValueFilter with Date comparators.
    Used for study periods or absolute date constraints.

    Examples:
    - Study period: min_value=AfterOrOn("2020-01-01"), max_value=BeforeOrOn("2023-12-31")
    - Before cutoff: max_value=Before("2022-01-01")
    """

    class_name: Literal["ValueFilter"]
    column_name: Literal["EVENT_DATE"] = "EVENT_DATE"
    min_value: Optional[DateComparator] = None
    max_value: Optional[DateComparator] = None

    @model_validator(mode="after")
    def validate_date_range(self):
        """Ensure at least one date bound is specified"""
        if self.min_value is None and self.max_value is None:
            raise ValueError("At least one of min_value or max_value must be specified")

        # Validate comparator class names match the field
        if self.min_value and self.min_value.class_name not in ["After", "AfterOrOn"]:
            raise ValueError(
                f"min_value must use After or AfterOrOn, got {self.min_value.class_name}"
            )

        if self.max_value and self.max_value.class_name not in ["Before", "BeforeOrOn"]:
            raise ValueError(
                f"max_value must use Before or BeforeOrOn, got {self.max_value.class_name}"
            )

        return self


class ArrayValue(BaseModel):
    """
    Generic array constant for storing lists of values.

    Used for simple list constants like code lists, string arrays, etc.
    """

    class_name: Literal["array"]
    values: List[Union[str, int, float]]


# ============================================================================
# Union Type for All Constant Values
# ============================================================================

ConstantValue = Annotated[
    Union[
        Annotated[RelativeTimeRangeFilterValue, Tag("RelativeTimeRangeFilter")],
        Annotated[CategoricalFilterValue, Tag("CategoricalFilter")],
        Annotated[DateFilterValue, Tag("ValueFilter")],
        Annotated[ArrayValue, Tag("array")],
    ],
    Field(discriminator="class_name"),
]


# ============================================================================
# API Request/Response Models
# ============================================================================


class ConstantCreate(BaseModel):
    """Request model for creating a new constant"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    type: Literal["RelativeTimeRangeFilter", "CategoricalFilter", "DateFilter", "array"]
    value: ConstantValue
    display_order: int = 0

    @model_validator(mode="after")
    def validate_type_matches_value(self):
        """Ensure the type field matches the value's class_name"""
        type_to_class_name = {
            "RelativeTimeRangeFilter": "RelativeTimeRangeFilter",
            "CategoricalFilter": "CategoricalFilter",
            "DateFilter": "ValueFilter",  # DateFilter is stored as ValueFilter
            "array": "array",
        }

        expected_class_name = type_to_class_name[self.type]
        actual_class_name = self.value.class_name

        if actual_class_name != expected_class_name:
            raise ValueError(
                f"Type '{self.type}' expects class_name '{expected_class_name}', "
                f"but got '{actual_class_name}'"
            )

        return self


class ConstantUpdate(BaseModel):
    """Request model for updating an existing constant"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    value: Optional[ConstantValue] = None
    display_order: Optional[int] = None

    @model_validator(mode="after")
    def validate_at_least_one_field(self):
        """Ensure at least one field is being updated"""
        if all(
            v is None for v in [self.name, self.description, self.value, self.display_order]
        ):
            raise ValueError("At least one field must be provided for update")
        return self
