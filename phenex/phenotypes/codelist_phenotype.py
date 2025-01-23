from typing import Union, List
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.codelist_filter import CodelistFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_range_filter import DateRangeFilter
from phenex.filters.aggregator import First, Last
from phenex.codelists import Codelist
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from ibis import _


class CodelistPhenotype(Phenotype):
    """
    CodelistPhenotype filters a CodeTable based on a specified codelist and other optional filters such as date range and relative time range.

    Parameters:
        name: The name of the phenotype.
        domain: The domain of the phenotype.
        codelist: The codelist used for filtering.
        use_code_type: Whether to use the code type in filtering. Default is True.
        date_range: A date range filter to apply.
        relative_time_range: A relative time range filter or a list of filters to apply.
        return_date: Specifies whether to return the 'first', 'last', or 'nearest' event date. Default is 'first'.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Methods:
        execute(tables: Dict[str, Table]) -> PhenotypeTable:
            Executes the phenotype calculation and returns a table with the computed age.

    Example:
        ```python
        from phenex.codelists import Codelist

        codelist = Codelist(
            name="example_codelist",
            codelist=[...])

        date_range = DateRangeFilter(
            start_date="2020-01-01",
            end_date="2020-12-31")

        phenotype = CodelistPhenotype(
            name="example_phenotype",
            domain="example_domain",
            codelist=codelist,
            date_range=date_range,
            return_date='first'
        )

        tables = {"example_domain": example_code_table}

        result_table = phenotype.execute(tables)

        display(result_table)
        ```
    """

    def __init__(
        self,
        domain,
        codelist: Codelist,
        name=None,
        use_code_type=True,
        date_range: DateRangeFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        return_date="first",
        categorical_filter: "CategoricalFilter" = None,
    ):
        super(CodelistPhenotype, self).__init__()

        self.codelist_filter = CodelistFilter(codelist, use_code_type=use_code_type)
        self.codelist = codelist
        self.categorical_filter = categorical_filter
        self.name = name or self.codelist.name
        self.date_range = date_range
        self.return_date = return_date
        assert self.return_date in [
            "first",
            "last",
            "nearest",
            "all",
        ], f"Unknown return_date: {return_date}"
        self.table = None
        self.domain = domain
        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]

        self.relative_time_range = relative_time_range
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    self.children.append(rtr.anchor_phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        code_table = tables[self.domain]
        code_table = self._perform_codelist_filtering(code_table)
        code_table = self._perform_categorical_filtering(code_table, tables)
        code_table = self._perform_time_filtering(code_table)
        code_table = self._perform_date_selection(code_table)
        return select_phenotype_columns(code_table)

    def _perform_codelist_filtering(self, code_table):
        assert is_phenex_code_table(code_table)
        code_table = self.codelist_filter.filter(code_table)
        return code_table

    def _perform_categorical_filtering(self, code_table, tables):
        if self.categorical_filter is not None:
            assert is_phenex_code_table(code_table)
            code_table = self.categorical_filter.autojoin_filter(code_table, tables)
        return code_table

    def _perform_time_filtering(self, code_table):
        if self.date_range is not None:
            code_table = self.date_range.filter(code_table)
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                code_table = rtr.filter(code_table)
        return code_table

    def _perform_date_selection(self, code_table, reduce=True):
        if self.return_date is None or self.return_date == "all":
            return code_table
        if self.return_date == "first":
            aggregator = First(reduce=reduce)
        elif self.return_date == "last":
            aggregator = Last(reduce=reduce)
        else:
            raise ValueError(f"Unknown return_date: {self.return_date}")
        return aggregator.aggregate(code_table)

    def get_codelists(self):
        """
        Get all codelists used in the cohort definition.

        Returns:
            List[str]: A list of codelists used in the cohort definition.
        """
        codelists = [self.codelist]
        for p in self.children:
            codelists.extend(p.get_codelists())
        return codelists
