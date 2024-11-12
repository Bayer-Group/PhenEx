from typing import Optional
from phenex.filters.filter import Filter
from phenex.tables import MeasurementTable, is_phenex_phenotype_table
from phenex.filters.value import *


class ValueFilter(Filter):
    """
    This class filters events in an EventTable based on a specified value range

    Attributes:
        min (Optional[int]): Minimum number of days from the anchor date to filter events. This
            option is mutually exclusive with min_years.
        max (Optional[int]): Maximum number of days from the anchor date to filter events. This
            option is mutually exclusive with max_years.

    Methods:
        _filter(table: MeasurementTable) -> MeasurementTable:
            Filters the given MeasurementTable based on the range of values specified by the min and max attributes.
            Parameters:
                table (Measurement): The table containing events to be filtered.
            Returns:
                MeasurementTable: The filtered MeasurementTable with events within the range.
    """

    def __init__(
        self,
        min: Optional[Value] = None,
        max: Optional[Value] = None,
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
        super(ValueFilter, self).__init__()

    def _filter(self, table: MeasurementTable):
        # TODO assert that value column is in table
        # assert (
        #    "INDEX_DATE" in table.columns
        # ), f"INDEX_DATE column not found in table {table}"

        conditions = []
        # Fix this, this logic needs to be abstracted to a ValueFilter
        if self.min is not None:
            if self.min.operator == ">":
                conditions.append(table.VALUE > self.min.value)
            elif self.min.operator == ">=":
                conditions.append(table.VALUE >= self.min.value)
            else:
                raise ValueError("Operator for min days be > or >=")
        if self.max is not None:
            if self.max.operator == "<":
                conditions.append(table.VALUE < self.max.value)
            elif self.max.operator == "<=":
                conditions.append(table.VALUE <= self.max.value)
            else:
                raise ValueError("Operator for max days be < or <=")
        if conditions:
            table = table.filter(conditions)
        return table
