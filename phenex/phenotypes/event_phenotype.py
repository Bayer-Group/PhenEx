from typing import Union, List, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_filter import DateFilter
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.aggregators import First, Last
from phenex.tables import is_phenex_code_table, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns


class EventPhenotype(Phenotype):
    """
    EventPhenotype extracts patients that experience any event based on event_date from a domain table based on optional filters such as date range, relative time range, and categorical filters. The CodelistPhenotype is a subclass of EventPhenotype that filters based on a codelist.

    Parameters:
        domain: The domain of the phenotype.
        name: The name of the phenotype.
        date_range: A date range filter to apply.
        relative_time_range: A relative time range filter or a list of filters to apply.
        return_date: Specifies whether to return the 'first', 'last', 'nearest', or 'all'
            event date(s). Default is 'first'.
        return_value: Specifies which values to return. None for no return value or 'all'
            for all return values on the selected date(s). Default is None.
        categorical_filter: Additional categorical filters to apply.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)
    """

    def __init__(
        self,
        domain: str,
        name: Optional[str] = None,
        date_range: DateFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        return_date="first",
        return_value=None,
        categorical_filter: Optional[CategoricalFilter] = None,
        **kwargs,
    ):
        super(EventPhenotype, self).__init__(name=name, **kwargs)

        self.domain = domain
        self.categorical_filter = categorical_filter
        self.date_range = date_range
        self.return_date = return_date
        self.return_value = return_value
        assert self.return_date in [
            "first",
            "last",
            "nearest",
            "all",
        ], f"Unknown return_date: {return_date}"
        assert self.return_value in [
            None,
            "all",
        ], f"Unknown return_value: {return_value}"

        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]
        self.relative_time_range = relative_time_range

        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        code_table = tables[self.domain]
        return self._execute_from_filtered_table(code_table, tables)

    def _execute_from_filtered_table(self, code_table, tables) -> PhenotypeTable:
        code_table = self._perform_categorical_filtering(code_table, tables)
        code_table = self._perform_time_filtering(code_table)
        code_table = self._perform_date_selection(code_table)
        code_table = self._perform_value_selection(code_table)
        code_table = select_phenotype_columns(code_table)
        code_table = self._perform_final_processing(code_table)
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

    def _perform_date_selection(self, code_table):
        if self.return_date is None or self.return_date == "all":
            return code_table

        reduce = self.return_value != "all"

        if self.return_date == "first":
            aggregator = First(reduce=reduce)
        elif self.return_date == "last":
            aggregator = Last(reduce=reduce)
        elif self.return_date == "nearest":
            raise NotImplementedError("Nearest aggregation not yet implemented")
        else:
            raise ValueError(f"Unknown return_date: {self.return_date}")

        return aggregator.aggregate(code_table)

    def _perform_value_selection(self, code_table):
        return code_table
