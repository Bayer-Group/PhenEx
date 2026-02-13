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

    def to_short_string(self) -> str:
        """Generate a short string representation like 'g18' or 'le65'."""
        operator_map = {">": "g", ">=": "ge", "<": "l", "<=": "le", "=": "eq"}
        op = operator_map.get(self.operator, self.operator)
        
        # Format as int if it's a whole number, otherwise keep decimals
        value = self.value
        if isinstance(value, (int, float)) and value == int(value):
            return f"{op}{int(value)}"
        else:
            return f"{op}{value}"
    
    def __str__(self) -> str:
        """Generate a human-readable string like 'greater than 18'."""
        operator_text_map = {
            ">": "greater than",
            ">=": "greater than or equal to",
            "<": "less than",
            "<=": "less than or equal to",
            "=": "equal to"
        }
        op_text = operator_text_map.get(self.operator, self.operator)
        return f"{op_text} {self.value}"

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
