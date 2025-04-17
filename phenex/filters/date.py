from typing import Union
from datetime import date, datetime
from .value import Value


class Date(Value):
    """
    The Date class is a specialized Value class for handling date comparisons.

    Attributes:
        operator (str): The comparison operator, one of '>', '>=', '<', '<=', '='.
        value (Union[date, str]): The date value, which can be a `date` object or a string in 'YYYY-MM-DD' format.
        date_format (str): The format to use for parsing date strings (default is 'YYYY-MM-DD').
    """

    def __init__(
        self, operator: str, value: Union[date, str], date_format="YYYY-MM-DD"
    ):
        if isinstance(value, str):
            value = datetime.strptime(value, date_format).date()
        super(Date, self).__init__(operator, value)


class Before(Date):
    def __init__(self, value: Union[date, str], **kwargs):
        super(Before, self).__init__("<", value)


class BeforeOrOn(Date):
    def __init__(self, value: Union[date, str], **kwargs):
        super(BeforeOrOn, self).__init__("<=", value)


class After(Date):
    def __init__(self, value: Union[date, str], **kwargs):
        super(After, self).__init__(">", value)


class AfterOrOn(Date):
    def __init__(self, value: Union[date, str], **kwargs):
        super(AfterOrOn, self).__init__(">=", value)
