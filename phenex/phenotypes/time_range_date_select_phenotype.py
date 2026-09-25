from typing import Dict, List, Optional, Union
from datetime import date
import ibis
from ibis.expr.types.relations import Table

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import DateFilter, RelativeTimeRangeFilter, TimeRangeFilter
from phenex.tables import PhenotypeTable
from phenex.aggregators import First, Last
from phenex.phenotypes.functions import select_phenotype_columns, _get_join_keys

RETURN_OPTIONS = ["first", "last", "all"]


class TimeRangeDateSelectPhenotype(Phenotype):
    """
    TimeRangeDateSelectPhenotype works with time range tables i.e. the input table must have
    a START_DATE and END_DATE column (in addition to PERSON_ID). For each patient, it selects
    one or more periods (return_period) and then, from each selected period, selects one or
    more dates to return as EVENT_DATE (return_date).

    return_period chooses which period(s) - a unique START_DATE/END_DATE row - to keep per patient:
        - 'first': the earliest period (by START_DATE)
        - 'last': the latest period (by START_DATE)
        - 'all': every period

    return_date then chooses which date(s) to emit from each selected period:
        - 'first': the START_DATE of the period
        - 'last': the END_DATE of the period
        - 'all': every day from START_DATE to END_DATE (inclusive), one row per day

    DATE: EVENT_DATE, as selected by return_date.
    VALUE: Always null.

    This can be used to, for example, identify the day a hospitalization begins/ends, or to
    enumerate every day a patient was hospitalized.

    Parameters:
        domain: The domain of the phenotype, containing START_DATE/END_DATE time ranges.
        name: The name of the phenotype. Optional. Defaults to TimeRangeDateSelectPhenotype.
        date_range: A DateFilter to apply. min_date clips START_DATE and max_date clips
            END_DATE; periods entirely outside the range are excluded.
        relative_time_range: A relative time range filter or a list of filters to apply.
            Periods are clipped to the boundaries of the relative time range.
        return_period: Which period(s) to keep per patient: 'first', 'last', or 'all'.
            Default is 'first'.
        return_date: Which date(s) to return from each selected period: 'first', 'last',
            or 'all'. Default is 'first'.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Examples:

    Example: Identify the day each hospitalization begins
        ```python
        from phenex.phenotypes import TimeRangeDateSelectPhenotype

        admission_dates = TimeRangeDateSelectPhenotype(
            domain='HOSPITALIZATION',
            return_period='all',
            return_date='first',
        )
        ```

    Example: Enumerate every day a patient was hospitalized in the post-index period
        ```python
        from phenex.phenotypes import TimeRangeDateSelectPhenotype
        from phenex.filters import RelativeTimeRangeFilter

        hospitalized_days = TimeRangeDateSelectPhenotype(
            domain='HOSPITALIZATION',
            relative_time_range=RelativeTimeRangeFilter(when='after'),
            return_period='all',
            return_date='all',
        )
        ```
    """

    def __init__(
        self,
        domain: str,
        name: Optional[str] = None,
        date_range: Optional[DateFilter] = None,
        relative_time_range: Optional[
            Union[RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]]
        ] = None,
        return_period: str = "first",
        return_date: str = "first",
        **kwargs,
    ):
        if name is None:
            name = "TimeRangeDateSelectPhenotype"
        super(TimeRangeDateSelectPhenotype, self).__init__(name=name, **kwargs)

        self.domain = domain
        self.date_range = date_range

        if return_period not in RETURN_OPTIONS:
            raise ValueError(f"Unknown return_period: {return_period}")
        if return_date not in RETURN_OPTIONS:
            raise ValueError(f"Unknown return_date: {return_date}")
        self.return_period = return_period
        self.return_date = return_date

        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]
        self.relative_time_range = relative_time_range
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    if not any(c is rtr.anchor_phenotype for c in self.children):
                        self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]
        table = self._perform_null_filtering(table)
        table = self._perform_date_range_clipping(table)
        table = self._perform_time_filtering(table)
        table = self._perform_period_selection(table)
        table = self._perform_date_selection(table)
        table = select_phenotype_columns(table)
        return self._perform_final_processing(table)

    def _perform_null_filtering(self, table):
        """Remove periods with a null START_DATE or END_DATE."""
        return table.filter(table.START_DATE.notnull() & table.END_DATE.notnull())

    def _perform_date_range_clipping(self, table):
        """Clip START_DATE to min_date and END_DATE to max_date, excluding periods that fall entirely outside the range."""
        if self.date_range is None:
            return table
        if self.date_range.min_value is not None:
            min_date = self.date_range.min_value.value
            table = table.mutate(
                START_DATE=ibis.greatest(table.START_DATE, ibis.literal(min_date))
            )
        if self.date_range.max_value is not None:
            max_date = self.date_range.max_value.value
            table = table.mutate(
                END_DATE=ibis.least(table.END_DATE, ibis.literal(max_date))
            )
        return table.filter(table.START_DATE <= table.END_DATE)

    def _perform_time_filtering(self, table):
        """Apply relative time range filtering, clipping periods to the range boundaries."""
        if self.relative_time_range is None:
            return table
        time_filter = TimeRangeFilter(
            relative_time_range=self.relative_time_range,
            include_clipped_periods=True,
            clip_periods=True,
        )
        return time_filter.filter(table)

    def _perform_period_selection(self, table):
        """Select the first, last, or all periods (unique START_DATE/END_DATE rows) per patient."""
        agg_index = _get_join_keys(table)
        table = table.select([*agg_index, "START_DATE", "END_DATE"]).distinct()
        if self.return_period == "all":
            return table
        aggregator_cls = First if self.return_period == "first" else Last
        aggregator = aggregator_cls(
            aggregation_index=agg_index, event_date_column="START_DATE"
        )
        return aggregator.aggregate(table)

    def _perform_date_selection(self, table):
        """Assign EVENT_DATE(s) from each selected period based on return_date."""
        if self.return_date == "first":
            return table.mutate(EVENT_DATE=table.START_DATE)
        if self.return_date == "last":
            return table.mutate(EVENT_DATE=table.END_DATE)
        return self._expand_to_daily_dates(table)

    @staticmethod
    def _expand_to_daily_dates(table):
        """Explode each period into one row per day from START_DATE to END_DATE (inclusive)."""
        table = table.mutate(
            START_DATE=table.START_DATE.cast("date"),
            END_DATE=table.END_DATE.cast("date"),
        )
        n_days = table.END_DATE.delta(table.START_DATE, "day").cast("int32")
        table = table.mutate(_day_offset=ibis.range(0, n_days + 1))
        table = table.mutate(_day_offset=table._day_offset.unnest())
        table = table.mutate(
            EVENT_DATE=table.START_DATE
            + table._day_offset.cast("int32").as_interval(unit="D")
        )
        return table.drop("_day_offset")
