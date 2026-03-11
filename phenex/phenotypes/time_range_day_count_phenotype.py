from typing import Union, List, Optional, Dict
from datetime import date
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import (
    ValueFilter,
    DateFilter,
    RelativeTimeRangeFilter,
    TimeRangeFilter,
)
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import (
    select_phenotype_columns,
)
from ibis.expr.types.relations import Table
from ibis import _
import ibis


class TimeRangeDayCountPhenotype(Phenotype):
    """
    TimeRangeDayCountPhenotype works with time range tables i.e. the input table must have a START_DATE and END_DATE column (in addition to PERSON_ID). It counts the **total number of days** within time ranges for each person, either total or within a specified date range (relative or absolute (TODO)). If no relative_time_range is defined, it returns the total number of days across all time periods per person. If relative_time_range is defined, it counts the number of days before or after (depending on when keyword argument of relative_time_range), INCLUDING the time period that contains the anchor date.

    This can be used :
    - given an admission discharge table, to count the total number of days hospitalized e.g. in the post index period
    - given a drug exposure table, to count the total number of days of drug exposure

    DATE: Date is always null
    VALUE: Total number of days across all time periods in the specified time range.

    Parameters:
        domain: The domain of the phenotype.
        name: The name of the phenotype. Optional. If not passed the name will be TimeRangeDayCountPhenotype.
        date_range: A DateFilter to apply. min_date clips START_DATE (periods starting before min_date are trimmed to min_date); max_date clips END_DATE (periods ending after max_date are trimmed to max_date). Periods entirely outside the range are excluded.
        relative_time_range: A relative time range filter or a list of filters to apply.
        value_filter: Filter persons by total number of days determined
        allow_null_end_date: If True, allows time ranges with null END_DATE (ongoing periods). If False, removes such rows. Default is False.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Examples:

    Example: Count total hospitalization days in post-index period (OMOP)
        ```python
        from phenex.phenotypes import CodelistPhenotype, TimeRangeDayCountPhenotype
        from phenex.filters import RelativeTimeRangeFilter
        from phenex.filters.value import GreaterThanOrEqualTo, LessThanOrEqualTo

        # Define entry phenotype (index date)
        entry_phenotype = CodelistPhenotype(
            domain='CONDITION_OCCURRENCE',
            codelist=atrial_fibrillation_codes,
            return_date='first',
        )

        # Count total hospitalization days in the 365 days after index
        post_index_hospitalization_days = TimeRangeDayCountPhenotype(
            domain='VISIT_OCCURRENCE',  # or admission-discharge table
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=entry_phenotype,
                when='after',
                min_days=GreaterThanOrEqualTo(1),
                max_days=LessThanOrEqualTo(365)
            ),
            value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(1))  # At least 1 day
        )

        result = post_index_hospitalization_days.execute(tables)
        ```
    """

    def __init__(
        self,
        domain: str,
        name: Optional[str] = None,
        date_range: DateFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        value_filter: Optional[ValueFilter] = None,
        allow_null_end_date: bool = False,  # TODO: need to figure out what to do with null end dates
        **kwargs,
    ):
        if name is None:
            name = "TimeRangeDayCountPhenotype"
        super(TimeRangeDayCountPhenotype, self).__init__(name=name, **kwargs)

        self.date_range = date_range
        self.value_filter = value_filter
        self.domain = domain
        self.allow_null_end_date = allow_null_end_date
        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]

        self.relative_time_range = relative_time_range
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]
        table = self._perform_null_filtering(table)
        table = self._perform_date_range_clipping(table)
        table = self._perform_time_filtering(table)
        table = self._perform_day_count_aggregation(table)
        table = self._perform_value_filtering(table)
        table = select_phenotype_columns(
            table.mutate(EVENT_DATE=ibis.null(date), BOOLEAN=True)
        )
        table = self._perform_zero_fill(table, tables)
        return self._perform_final_processing(table)

    def _perform_null_filtering(self, table):
        """Remove rows with null START_DATE. Remove rows with null END_DATE unless allow_null_end_date is True."""
        table = table.filter(table.START_DATE.notnull())
        if not self.allow_null_end_date:
            table = table.filter(table.END_DATE.notnull())
        return table

    def _perform_date_range_clipping(self, table):
        """Clip START_DATE to min_date and END_DATE to max_date, then exclude periods that fall entirely outside the range."""
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
        """Apply relative time range filtering with period clipping."""
        if self.relative_time_range is None:
            return table
        time_filter = TimeRangeFilter(
            relative_time_range=self.relative_time_range,
            include_clipped_periods=True,
            clip_periods=True,
        )
        return time_filter.filter(table)

    def _perform_day_count_aggregation(self, table):
        """Count the total number of days across all distinct time periods per person."""
        table = table.select(["PERSON_ID", "START_DATE", "END_DATE"]).distinct()
        table = table.mutate(
            DAYS_IN_RANGE=table.END_DATE.delta(table.START_DATE, "day") + 1
        )
        return table.group_by("PERSON_ID").aggregate(VALUE=_.DAYS_IN_RANGE.sum())

    def _perform_value_filtering(self, table):
        """Filter persons by total day count using value_filter."""
        if self.value_filter is not None:
            table = self.value_filter.filter(table)
        return table

    def _perform_zero_fill(self, table, tables):
        """Left-join against the PERSON table to include persons with 0 days (only when no value_filter is set)."""
        if self.value_filter is not None or "PERSON" not in tables:
            return table
        persons = tables["PERSON"].select("PERSON_ID").distinct()
        table = persons.join(
            table, persons.PERSON_ID == table.PERSON_ID, how="left"
        ).drop("PERSON_ID_right")
        return table.mutate(VALUE=table.VALUE.fillna(0))
