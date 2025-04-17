from typing import Optional, Union
from .date import Date, After, AfterOrOn, Before, BeforeOrOn
from .value_filter import ValueFilter


class DateFilter(ValueFilter):
    """
    DateFilter is a specialized ValueFilter for handling date-based filtering.

    Parameters:
        min: The minimum date condition. Recommended to pass either After or AfterOrOn.
        max: The maximum date condition. Recommended to pass either Before or BeforeOrOn.
        column_name: The name of the column to apply the filter on. Defaults to "EVENT_DATE".
    """

    def __init__(
        self,
        min: Optional[Union[Date, After, AfterOrOn]] = None,
        max: Optional[Union[Date, Before, BeforeOrOn]] = None,
        column_name: str = "EVENT_DATE",
        **kwargs,
    ):
        super(DateFilter, self).__init__(
            min=min, max=max, column_name=column_name, **kwargs
        )
