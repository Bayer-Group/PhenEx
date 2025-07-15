class Reporter:
    """
    A reporter creates an analysis of a cohort. It should receive a cohort, execute and return the report.

    To subclass:
        1. implement execute method, returning a table
    """

    def __init__(self, decimal_places: int = 1):
        self.decimal_places = decimal_places
        pass

    def execute(self, cohort):
        raise NotImplementedError
