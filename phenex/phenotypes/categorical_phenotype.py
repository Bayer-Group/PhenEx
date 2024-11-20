from typing import Union, List
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_range_filter import DateRangeFilter
from phenex.filters.aggregator import First, Last
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from ibis import _


class HospitalizationPhenotype(Phenotype):
    """
    HospitalizationPhenotype filters an EncounterTable to identify inpatient events based on the encounter_type column.
    It uses a CategoricalFilter to filter for inpatient events and can apply additional date and time range filters.

    Attributes:
        name: The name of the phenotype.
        domain: The domain of the phenotype, default is 'ENCOUNTER'.
        column_name: The name of the column to filter on, default is 'ENCOUNTER_TYPE'.
        allowed_values: List of allowed values for the encounter_type column, default is ['inpatient'].
        date_range: A date range filter to apply.
        relative_time_range: A relative time range filter or a list of filters to apply.
        return_date: Specifies whether to return the 'first', 'last', 'nearest', or 'all' event dates. Default is 'first'.
        table: The resulting phenotype table after filtering.
        children: List of child phenotypes.

    Methods:
        _execute(tables: Dict[str, Table]) -> PhenotypeTable:
            Executes the filtering process on the provided tables and returns the filtered phenotype table.
    """

    def __init__(
        self,
        domain,
        column_name: str,
        allowed_values: List[str],
        name=None,
        date_range: DateRangeFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        return_date="first",
    ):
        super(HospitalizationPhenotype, self).__init__()

        self.categorical_filter = CategoricalFilter(
            column_name=column_name, allowed_values=allowed_values
        )
        self.name = name
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
        code_table = self._perform_categorical_filtering(code_table)
        code_table = self._perform_time_filtering(code_table)
        code_table = self._perform_date_selection(code_table)
        return select_phenotype_columns(code_table)

    def _perform_categorical_filtering(self, code_table):
        assert is_phenex_code_table(code_table)
        code_table = self.categorical_filter.filter(code_table)
        return code_table

    def _perform_time_filtering(self, code_table):
        if self.date_range is not None:
            code_table = self.date_range.filter(code_table)
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                code_table = rtr.filter(code_table)
        return code_table

    def _perform_date_selection(self, code_table):
        if self.return_date is None or self.return_date == "all":
            return code_table
        if self.return_date == "first":
            aggregator = First()
        elif self.return_date == "last":
            aggregator = Last()
        else:
            raise ValueError(f"Unknown return_date: {self.return_date}")
        return aggregator.aggregate(code_table)
