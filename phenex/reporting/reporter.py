class Reporter:
    """
    A reporter creates an analysis of a cohort. It should receive a cohort, execute and return the report.

    To subclass:
        1. implement execute method, returning a table
    """

    def __init__(self):
        pass

    def execute(self, cohort):
        raise NotImplementedError
