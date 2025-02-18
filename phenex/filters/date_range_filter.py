from typing import Optional
from datetime import date

from phenex.tables import EventTable, is_phenex_event_table


class DateRangeFilter:
    """
    DateRangeFilter is a class designed to filter an EventTable between two specified dates.

    Attributes:
    -----------
    min_date : Optional[date]
        The minimum date for the filter. Events occurring before this date will be excluded.
    max_date : Optional[date]
        The maximum date for the filter. Events occurring after this date will be excluded.
    """

    def __init__(
        self, min_date: Optional[date] = None, max_date: Optional[date] = None
    ):
        self.min_date = min_date
        self.max_date = max_date
        super(DateRangeFilter, self).__init__()

    def filter(self, table: EventTable):

        assert is_phenex_event_table(table)

        conditions = []
        if self.min_date is not None:
            conditions.append(table.EVENT_DATE >= self.min_date)
        if self.max_date is not None:
            conditions.append(table.EVENT_DATE <= self.max_date)

        if conditions:
            output_table = table.filter(conditions)
        else:
            output_table = table

        return output_table
