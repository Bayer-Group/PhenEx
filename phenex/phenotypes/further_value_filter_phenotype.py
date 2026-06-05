from typing import Union, List, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_filter import DateFilter
from phenex.aggregators import First, Last
from phenex.tables import PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from phenex.util import create_logger

logger = create_logger(__name__)


class FurtherValueFilterPhenotype(Phenotype):
    """
    FurtherValueFilterPhenotype takes the output of an existing phenotype and applies
    additional value filtering, value aggregation, and time-based filtering on top of it.

    This is useful when you want to chain filtering operations, e.g. first identify
    measurements matching a codelist and value range with a MeasurementPhenotype, then
    further filter those results by a different value range or time window.

    Parameters:
        phenotype: The source phenotype whose output table will be further filtered.
            This phenotype is added as a child dependency and must execute first.
        value_filter (ValueFilter): A ValueFilter to apply to the source phenotype's
            output values. Applied after value_aggregation.
        value_aggregation (ValueAggregator): A ValueAggregator to apply to the source
            phenotype's output values. Applied before value_filter.
        date_range (DateFilter): A date range filter to apply.
        relative_time_range (RelativeTimeRangeFilter): A relative time range filter
            or list of filters to apply.
        return_date (str): Specifies whether to return the 'first', 'last', or 'all'
            event date(s). Default is 'all'.
    """

    output_display_type = "value"

    def __init__(
        self,
        phenotype: "Phenotype",
        value_filter: Optional["ValueFilter"] = None,
        value_aggregation: Optional["ValueAggregator"] = None,
        date_range: Optional[DateFilter] = None,
        relative_time_range: Optional[
            Union[RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]]
        ] = None,
        return_date: str = "all",
        **kwargs,
    ):
        super(FurtherValueFilterPhenotype, self).__init__(**kwargs)

        self.source_phenotype = phenotype
        self.add_children(phenotype)

        self.value_filter = value_filter
        self.value_aggregation = value_aggregation
        self.date_range = date_range
        self.return_date = return_date

        assert self.return_date in [
            "first",
            "last",
            "nearest",
            "all",
        ], f"Unknown return_date: {return_date}"

        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]
        self.relative_time_range = relative_time_range

        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    if not any(c is rtr.anchor_phenotype for c in self.children):
                        self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        table = self.source_phenotype.table
        table = self._perform_time_filtering(table)
        table = self._perform_date_selection(table)
        table = self._perform_value_aggregation(table)
        table = self._perform_value_filtering(table)
        table = select_phenotype_columns(table)
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

        reduce = False

        if self.return_date == "first":
            aggregator = First(reduce=reduce)
        elif self.return_date == "last":
            aggregator = Last(reduce=reduce)
        elif self.return_date == "nearest":
            raise NotImplementedError("Nearest aggregation not yet implemented")
        else:
            raise ValueError(f"Unknown return_date: {self.return_date}")

        return aggregator.aggregate(table)

    def _perform_value_aggregation(self, table):
        if self.value_aggregation is not None:
            table = self.value_aggregation.aggregate(table)
        return table

    def _perform_value_filtering(self, table):
        if self.value_filter is not None:
            table = self.value_filter.filter(table)
        return table
