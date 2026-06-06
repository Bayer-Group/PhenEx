from typing import Optional, Union
from datetime import date, datetime
from .value_filter import ValueFilter
from .value import Value


class Date(Value):
    """
    The Date class is a specialized Value class for handling date comparisons.

    Attributes:
        operator (str): The comparison operator, one of '>', '>=', '<', '<=', '='.
        value (Union[date, str]): The date value, which can be a `date` object or a string in 'YYYY-MM-DD' format.
        date_format (str): The format to use for parsing date strings (default is '%Y-%m-%d').
    """

    def __init__(self, operator: str, value: Union[date, str], date_format="%Y-%m-%d"):
        if isinstance(value, str):
            value = datetime.strptime(value, date_format).date()
        super(Date, self).__init__(operator, value)


class Before(Date):
    """Use Before to specify that a date must be strictly before a given date (e.g. Before("2023-01-01") means < 2023-01-01). Pass to DateFilter as max_date to exclude the boundary date."""

    def __init__(self, value: Union[date, str], **kwargs):
        super(Before, self).__init__("<", value)


class BeforeOrOn(Date):
    """Use BeforeOrOn to specify that a date must be on or before a given date (e.g. BeforeOrOn("2023-12-31") means <= 2023-12-31). Pass to DateFilter as max_date to include the boundary date."""

    def __init__(self, value: Union[date, str], **kwargs):
        super(BeforeOrOn, self).__init__("<=", value)


class After(Date):
    """Use After to specify that a date must be strictly after a given date (e.g. After("2020-01-01") means > 2020-01-01). Pass to DateFilter as min_date to exclude the boundary date."""

    def __init__(self, value: Union[date, str], **kwargs):
        super(After, self).__init__(">", value)


class AfterOrOn(Date):
    """Use AfterOrOn to specify that a date must be on or after a given date (e.g. AfterOrOn("2020-01-01") means >= 2020-01-01). Pass to DateFilter as min_date to include the boundary date."""

    def __init__(self, value: Union[date, str], **kwargs):
        super(AfterOrOn, self).__init__(">=", value)


def DateFilter(
    min_date: Optional[Union[Date, After, AfterOrOn]] = None,
    max_date: Optional[Union[Date, Before, BeforeOrOn]] = None,
    column_name: str = "EVENT_DATE",
):
    """
    Use DateFilter to restrict events to an absolute date range (e.g. "events after 2020-01-01", "events between 2019 and 2023"). Specify min_date and/or max_date using After, AfterOrOn, Before, or BeforeOrOn.

    Parameters:
        min_date: The minimum date condition. Recommended to pass either After or AfterOrOn.
        max_date: The maximum date condition. Recommended to pass either Before or BeforeOrOn.
        column_name: The name of the column to apply the filter on. Defaults to "EVENT_DATE".

    Examples:

    Example: Events occurring after January 1, 2020
        ```python
        from phenex.filters.date_filter import DateFilter, After

        date_filter = DateFilter(
            min_date=After("2020-01-01")
        )
        ```

    Example: Events between 2019 and 2023 (inclusive)
        ```python
        from phenex.filters.date_filter import DateFilter, AfterOrOn, BeforeOrOn

        date_filter = DateFilter(
            min_date=AfterOrOn("2019-01-01"),
            max_date=BeforeOrOn("2023-12-31")
        )
        ```

    Example: Events strictly before a cutoff date
        ```python
        from phenex.filters.date_filter import DateFilter, Before

        date_filter = DateFilter(
            max_date=Before("2022-06-01")
        )
        ```
    """
    # For some reason, implementing DateFilter as a subclass of ValueFilter messes up the serialization. So instead we implement DateFilter as a function that looks like a class and just returns a ValueFilter instance.
    return ValueFilter(min_value=min_date, max_value=max_date, column_name=column_name)
