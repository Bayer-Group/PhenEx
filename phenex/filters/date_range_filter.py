from typing import Optional, Union
from datetime import date, datetime

from phenex.filters.value import Value
from phenex.filters.value_filter import ValueFilter


class DateRangeFilter(ValueFilter):
    """
    DateRangeFilter is a ValueFilter applied to dates.

    Attributes:
        min_date (Optional[Union[date, str]]): The minimum date for the filter. If a string is provided, it will be converted to a date according to date_format.
        max_date (Optional[Union[date, str]]): The maximum date for the filter. If a string is provided, it will be converted to a date according to date_format.
        column_name (Optional[str]): The name of the column to apply the filter on. Defaults to EVENT_DATE, the default value for date columns in Phenex.
        date_format (str): The format to use for parsing date strings.
    """

    def __init__(
        self,
        min_date: Optional[Union[date, str]] = None,
        max_date: Optional[Union[date, str]] = None,
        column_name: Optional[str] = "EVENT_DATE",
        date_format="YYYY-MM-DD",
    ):
        if isinstance(min_date, str):
            min_date = datetime.strptime(min_date, date_format).date()
        if isinstance(max_date, str):
            max_date = datetime.strptime(max_date, date_format).date()
        super(DateRangeFilter, self).__init__(
            min=Value(">=", min_date),
            max=Value("<=", max_date),
            column_name=column_name,
        )
