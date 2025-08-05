from typing import Union, List, Dict
from datetime import date
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_filter import DateFilter
from phenex.filters.filter import AndFilter, OrFilter
from phenex.aggregators import First, Last
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.tables import PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from ibis import _
import ibis


def check_categorical_filters_share_same_domain(filter, domain):
    # if any leaf node of the tree has a different domain, return false
    if isinstance(filter, AndFilter) or isinstance(filter, OrFilter):
        filter1_same_domain = check_categorical_filters_share_same_domain(
            filter.filter1, domain
        )
        filter2_same_domain = check_categorical_filters_share_same_domain(
            filter.filter2, domain
        )
        return filter1_same_domain and filter2_same_domain
    # else check if the current leaf node has the same domain
    else:
        if filter.domain is not None:
            if filter.domain != domain:
                return False
    return True


class CategoricalPhenotype(Phenotype):
    """
    CategoricalPhenotype calculates phenotype whose VALUE is discrete, such for sex, race, or ethnicity. Categorical Phenotype is especially helpful as a baseline characteristic from PERSON like tables.
    The returned Phenotype has the following interpretation:

    DATE: If when='before', then DATE is the beginning of the coverage period containing the anchor phenotype. If when='after', then DATE is the end of the coverage period containing the anchor date.
    VALUE: Coverage (in days) relative to the anchor date. By convention, always non-negative.


    Parameters:
        name: Name of the phenotype.
        domain: Domain of the phenotype.
        categorical_filter: Use CategoricalFilter to input allowed values for the categorical variable. If not passed, all values are returned.
    """

    def __init__(
        self,
        name: str,
        domain: str,
        categorical_filter: CategoricalFilter,
        date_range: DateFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        return_date=None,
        **kwargs,
    ):
        super(CategoricalPhenotype, self).__init__(name=name, **kwargs)
        self.domain = domain
        if not check_categorical_filters_share_same_domain(
            categorical_filter, self.domain
        ):
            raise ValueError("CategoricalPhenotype only works on a single domain.")
        self.categorical_filter = categorical_filter
        self.date_range = date_range
        self.return_date = return_date
        assert self.return_date in [
            "first",
            "last",
            "nearest",
            "all",
            None,
        ], f"Unknown return_date: {return_date}"

        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]

        self.relative_time_range = relative_time_range
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    self.children.append(rtr.anchor_phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        table = tables[self.domain]
        table = self._perform_categorical_filtering(table)
        table = self._perform_time_filtering(table)
        table = self._perform_date_selection(table)

        if isinstance(self.categorical_filter, CategoricalFilter):
            table = table.mutate(
                VALUE=table[self.categorical_filter.column_name],
                EVENT_DATE=ibis.null(date),
            )
        return select_phenotype_columns(table)

    def _perform_categorical_filtering(self, table):
        table = self.categorical_filter.filter(table)
        return table

    def _perform_time_filtering(self, table):
        if self.date_range is not None:
            table = self.date_range.filter(table)
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                table = rtr.filter(table)
        return table

    def _perform_date_selection(self, table):
        if self.return_date is None or self.return_date == "all":
            return table
        if self.return_date == "first":
            aggregator = First()
        elif self.return_date == "last":
            aggregator = Last()
        else:
            raise ValueError(f"Unknown return_date: {self.return_date}")
        return aggregator.aggregate(table)
