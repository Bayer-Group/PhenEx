from typing import Union
from datetime import date
from phenex.util.serialization.to_dict import to_dict


class Value:
    """
    The Value class is used to define threshold on values in databases. Importantly, Value's define not just numeric values but also the boundary (including or excluding the endpoint).

    Attributes:
       operator (str): The comparison operator, one of '>', '>=', '<', '<=', '='.
        value (Union[int, float, date]): The threshold value.

    Examples:
        greater_than_zero = Value(0, '>')
    """

    def __init__(self, operator: str, value: Union[int, float, date]):
        self.operator = operator
        self.value = value
        assert operator in [
            ">",
            ">=",
            "<",
            "<=",
            "=",
        ], "Operator must be >, >=, <, <=, or ="

    def to_dict(self):
        return to_dict(self)


class GreaterThan(Value):
    def __init__(self, value: int, **kwargs):
        super(GreaterThan, self).__init__(">", value)


class GreaterThanOrEqualTo(Value):
    def __init__(self, value: int, **kwargs):
        super(GreaterThanOrEqualTo, self).__init__(">=", value)


class LessThan(Value):
    def __init__(self, value: int, **kwargs):
        super(LessThan, self).__init__("<", value)


class LessThanOrEqualTo(Value):
    def __init__(self, value: int, **kwargs):
        super(LessThanOrEqualTo, self).__init__("<=", value)


class EqualTo(Value):
    def __init__(self, value: int, **kwargs):
        super(EqualTo, self).__init__("=", value)
