from phenex.filters.filter import Filter


class Value(Filter):
    def __init__(self, operator: str, value: int):
        self.operator = operator
        self.value = value
        assert operator in [
            ">",
            ">=",
            "<",
            "<=",
            "=",
        ], "Operator must be >, >=, <, <=, or ="
        super(Value, self).__init__()

    def _filter(self, table, column):

        if self.operator == ">":
            table = getattr(table, column) > self.value
        elif self.operator == ">=":
            table = getattr(table, column) >= self.value
        elif self.operator == "<":
            table = getattr(table, column) < self.value
        elif self.operator == "<=":
            table = getattr(table, column) <= self.value
        elif self.operator == "=":
            table = getattr(table, column) == self.value
        else:
            raise ValueError("Operator must be >, >=, <, <=, or =")

        return table


class GreaterThan(Value):
    def __init__(self, value: int):
        super(GreaterThan, self).__init__(">", value)


class GreaterThanOrEqualTo(Value):
    def __init__(self, value: int):
        super(GreaterThanOrEqualTo, self).__init__(">=", value)


class LessThan(Value):
    def __init__(self, value: int):
        super(LessThan, self).__init__("<", value)


class LessThanOrEqualTo(Value):
    def __init__(self, value: int):
        super(LessThanOrEqualTo, self).__init__("<=", value)


class EqualTo(Value):
    def __init__(self, value: int):
        super(EqualTo, self).__init__("=", value)
