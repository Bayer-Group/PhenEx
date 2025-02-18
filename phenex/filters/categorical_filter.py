from phenex.filters.filter import Filter
from typing import List, Optional, Union
from ibis.expr.types.relations import Table


class CategoricalFilter(Filter):
    """
    This class filters events in an EventTable based on specified categorical values

    Attributes:
        category (Optional[str]): The category to filter events by.

    Methods:
        _filter(table: MeasurementTable) -> MeasurementTable:
            Filters the given MeasurementTable based on the specified category.
            Parameters:
                table (Measurement): The table containing events to be filtered.
            Returns:
                MeasurementTable: The filtered MeasurementTable with events matching the category.
    """

    def __init__(
        self,
        column_name: str,
        allowed_values: List[Union[str, int]],
        domain: Optional[str] = None,
    ):
        self.column_name = column_name
        self.allowed_values = allowed_values
        self.domain = domain
        super(CategoricalFilter, self).__init__()

    def _filter(self, table: "PhenexTable"):
        return table.filter(table[self.column_name].isin(self.allowed_values))

    def autojoin_filter(self, table: "PhenexTable", tables: dict = None):
        if self.column_name not in table.columns:
            if self.domain not in tables.keys():
                raise ValueError(
                    f"Table required for categorical filter ({self.domain}) does not exist within domains dicitonary"
                )
            table = table.join(tables[self.domain], domains=tables)
            # TODO downselect to original columns
        return table.filter(table[self.column_name].isin(self.allowed_values))
