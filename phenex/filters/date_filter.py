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
    """
    Represents a threshold where a date must be strictly before the specified value.
    """

    def __init__(self, value: Union[date, str], **kwargs):
        super(Before, self).__init__("<", value)


class BeforeOrOn(Date):
    """
    Represents a threshold where a date must be on or before the specified value.
    """

    def __init__(self, value: Union[date, str], **kwargs):
        super(BeforeOrOn, self).__init__("<=", value)


class After(Date):
    """
    Represents a threshold where a date must be strictly after the specified value.
    """

    def __init__(self, value: Union[date, str], **kwargs):
        super(After, self).__init__(">", value)


class AfterOrOn(Date):
    """
    Represents a threshold where a date must be on or after the specified value.
    """

    def __init__(self, value: Union[date, str], **kwargs):
        super(AfterOrOn, self).__init__(">=", value)


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
