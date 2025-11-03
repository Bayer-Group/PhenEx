class Reporter:
    """
    A reporter creates an analysis of a cohort. It should receive a cohort, execute and return the report.

    To subclass:
        1. implement execute method, returning a table


    Parameters:
        pretty_display: True by default. If true, dataframe is ready for display in a study report with values rounded to the decimal place and phenotype display names shown. Additionally, numeric values are cast to strings so that empty strings "" are displayed rather than NaNs.
        decimal_places: Number of decimal places to round to. By default set to 1.
    """

    def __init__(self, decimal_places: int = 1, pretty_display: bool = True, include_component_phenotypes=False):
        self.decimal_places = decimal_places
        self.pretty_display = pretty_display
        self.include_component_phenotypes = include_component_phenotypes

    def execute(self, cohort):
        raise NotImplementedError
