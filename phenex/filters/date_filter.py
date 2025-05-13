from typing import Optional, Union
from .date import Date, After, AfterOrOn, Before, BeforeOrOn
from .value_filter import ValueFilter


def DateFilter(
    min_date: Optional[Union[Date, After, AfterOrOn]] = None,
    max_date: Optional[Union[Date, Before, BeforeOrOn]] = None,
    column_name: str = "EVENT_DATE",
):
    """
    DateFilter is a specialized ValueFilter for handling date-based filtering.

    Parameters:
        min_date: The minimum date condition. Recommended to pass either After or AfterOrOn.
        max_date: The maximum date condition. Recommended to pass either Before or BeforeOrOn.
        column_name: The name of the column to apply the filter on. Defaults to "EVENT_DATE".
    """
    # For some reason, implementing DateFilter as a subclass of ValueFilter messes up the serialization. So instead we implement DateFilter as a function that looks like a class and just returns a ValueFilter instance.
    return ValueFilter(min_value=min_date, max_value=max_date, column_name=column_name)
