from typing import Optional
from phenex.filters.filter import Filter
from phenex.tables import PhenexTable
from phenex.filters.value import Value


class ValueFilter(Filter):
    """
    This class filters events in an EventTable based on a specified value range.

    Attributes:
        min (Optional[int]): Minimum number of days from the anchor date to filter events. This
            option is mutually exclusive with min_years.
        max (Optional[int]): Maximum number of days from the anchor date to filter events. This
            option is mutually exclusive with max_years.
        column_name (Optional[str]): The column name to which the value range should be applied. Default to VALUE, which is the default name of the value column in PhenotypeTable's.

    Methods:
        filter(table: PhenexTable) -> PhenexTable:
            Filters the given PhenexTable based on the range of values specified by the min and max attributes.
            Parameters:
                table (Measurement): The table containing events to be filtered.
            Returns:
                MeasurementTable: The filtered MeasurementTable with events within the range.
    """

    def __init__(
        self,
        min: Optional[Value] = None,
        max: Optional[Value] = None,
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
        # TODO assert that value column is in table
        # assert (
        #    "INDEX_DATE" in table.columns
        # ), f"INDEX_DATE column not found in table {table}"

        conditions = []
        # Fix this, this logic needs to be abstracted to a ValueFilter
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
