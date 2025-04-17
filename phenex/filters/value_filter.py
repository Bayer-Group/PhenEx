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
        min: Minimum value required to pass through the filter.
        max: Maximum value required to pass through the filter.
        column_name: The column name to which the value range should be applied. Default to VALUE, which is the default name of the value column in PhenotypeTable's.

    Methods:
        filter: Filters the given PhenexTable based on the range of values specified by the min and max attributes. See Filter.
    """

    def __init__(
        self,
        min: Optional[Union[Value, GreaterThan, GreaterThanOrEqualTo]] = None,
        max: Optional[Union[Value, LessThan, LessThanOrEqualTo]] = None,
        column_name: Optional[str] = "VALUE",
    ):
        if min is not None:
            assert min.operator in [
                ">",
                ">=",
            ], f"min operator must be > or >=, not {min.operator}"
        if max is not None:
            assert max.operator in [
                "<",
                "<=",
            ], f"max operator must be > or >=, not {max.operator}"
        if max is not None and min is not None:
            assert min.value <= max.value, f"min must be less than or equal to max"
        self.min = min
        self.max = max
        self.column_name = column_name
        super(ValueFilter, self).__init__()

    def _filter(self, table: PhenexTable) -> PhenexTable:

        conditions = []
        value_column = getattr(table, self.column_name)
        if self.min is not None:
            if self.min.operator == ">":
                conditions.append(value_column > self.min.value)
            elif self.min.operator == ">=":
                conditions.append(value_column >= self.min.value)
            else:
                raise ValueError("Operator for min days be > or >=")
        if self.max is not None:
            if self.max.operator == "<":
                conditions.append(value_column < self.max.value)
            elif self.max.operator == "<=":
                conditions.append(value_column <= self.max.value)
            else:
                raise ValueError("Operator for max days be < or <=")
        if conditions:
            table = table.filter(conditions)
        return table
