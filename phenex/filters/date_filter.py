from typing import Optional
from .date import Date
from .value_filter import ValueFilter


class DateFilter(ValueFilter):
    """
    DateFilter is a specialized ValueFilter for handling date-based filtering.

    Attributes:
        min (Optional[Date]): The minimum date condition.
        max (Optional[Date]): The maximum date condition.
        column_name (str): The name of the column to apply the filter on. Defaults to "EVENT_DATE".
    """

    def __init__(
        self,
        min: Optional[Date] = None,
        max: Optional[Date] = None,
        column_name: str = "EVENT_DATE",
        **kwargs,
    ):
        super(DateFilter, self).__init__(
            min=min, max=max, column_name=column_name, **kwargs
        )
