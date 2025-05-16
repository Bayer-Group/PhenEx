from typing import Optional, Union
from phenex.filters.filter import Filter
from phenex.tables import PhenexTable
from phenex.filters.value import (
    Value,
    GreaterThan,
    GreaterThanOrEqualTo,
    LessThan,
    LessThanOrEqualTo,
)


class ValueFilter(Filter):
    """
    ValueFilter filters events in an PhenexTable based on a specified value range.

    Parameters:
        min_value: Minimum value required to pass through the filter.
        max_value: Maximum value required to pass through the filter.
        column_name: The column name to which the value range should be applied. Default to VALUE, which is the default name of the value column in PhenotypeTable's.

    Methods:
        filter: Filters the given PhenexTable based on the range of values specified by the min_value and max_value attributes. See Filter.
    """

    def __init__(
        self,
        min_value: Optional[Union[Value, GreaterThan, GreaterThanOrEqualTo]] = None,
        max_value: Optional[Union[Value, LessThan, LessThanOrEqualTo]] = None,
        column_name: Optional[str] = "VALUE",
    ):
        if min_value is not None:
            assert min_value.operator in [
                ">",
                ">=",
            ], f"min_value operator must be > or >=, not {min_value.operator}"
        if max_value is not None:
            assert max_value.operator in [
                "<",
                "<=",
            ], f"max_value operator must be > or >=, not {max_value.operator}"
        if max_value is not None and min_value is not None:
            assert (
                min_value.value <= max_value.value
            ), f"min_value must be less than or equal to max_value"
        self.min_value = min_value
        self.max_value = max_value
        self.column_name = column_name
        super(ValueFilter, self).__init__()

    def _filter(self, table: PhenexTable) -> PhenexTable:
        conditions = []
        value_column = getattr(table, self.column_name)
        if self.min_value is not None:
            if self.min_value.operator == ">":
                conditions.append(value_column > self.min_value.value)
            elif self.min_value.operator == ">=":
                conditions.append(value_column >= self.min_value.value)
            else:
                raise ValueError("Operator for min_value days be > or >=")
        if self.max_value is not None:
            if self.max_value.operator == "<":
                conditions.append(value_column < self.max_value.value)
            elif self.max_value.operator == "<=":
                conditions.append(value_column <= self.max_value.value)
            else:
                raise ValueError("Operator for max_value days be < or <=")
        if conditions:
            table = table.filter(conditions)
        return table
