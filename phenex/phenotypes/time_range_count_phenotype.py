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


class TimeRangeCountPhenotype(Phenotype):
    """
    TimeRangeCountPhenotype works with time range tables i.e. the input table must have a START_DATE and END_DATE column (in addition to PERSON_ID). It counts the number of distinct time ranges for each person, either total or within a specified date range (relative or absolute). If no relative_time_range defined, it returns the number of time periods per person. If relative_time_range is defined, it counts the number of time periods before or after (depending on when keyword argument of relative_time_range), NOT including the time period defined by the relative_time_range anchor.

    If min_days or max_days of the relative_time_range are defined, the entire time period must be included in the relative time range i.e. if before, the start date of all time periods must be contained within the time range.

    This can be used :
    - given an admission discharge table, to count the number of hospitalizations that occurred e.g. in the post index period
    - given a drug exposure table, to count the number of times a person has taken a medication

    DATE: Date is always null
    VALUE: Number of distinct time periods in the specified time range.

    Parameters:
        domain: The domain of the phenotype.
        name: The name of the phenotype. Optional. If not passed the name will be TimeRangeCountPhenotype.
        date_range: A DateFilter to apply. Periods must fall entirely within the date range (min_date <= START_DATE and END_DATE <= max_date); periods crossing a boundary are excluded.
        relative_time_range: A relative time range filter or a list of filters to apply.
        value_filter: Filter persons by number of time ranges determined
        allow_null_end_date: If True, allows time ranges with null END_DATE (ongoing periods). If False, removes such rows. Default is True.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Examples:

    Example: Count hospitalizations in post-index period (OMOP)
        ```python
        from phenex.phenotypes import CodelistPhenotype, TimeRangeCountPhenotype
        from phenex.filters import RelativeTimeRangeFilter
        from phenex.filters.value import GreaterThanOrEqualTo, LessThanOrEqualTo

        # Define entry phenotype (index date)
        entry_phenotype = CodelistPhenotype(
            domain='CONDITION_OCCURRENCE',
            codelist=atrial_fibrillation_codes,
            return_date='first',
        )

        # Count hospitalizations in the 365 days after index
        post_index_hospitalizations = TimeRangeCountPhenotype(
            domain='VISIT_OCCURRENCE',  # or admission-discharge table
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=entry_phenotype,
                when='after',
                min_days=GreaterThanOrEqualTo(1),
                max_days=LessThanOrEqualTo(365)
            ),
            value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(1))  # At least 1 hospitalization
        )

        result = post_index_hospitalizations.execute(tables)
        ```
    """

    output_display_type = "value"

    def __init__(
        self,
        domain: str,
        name: Optional[str] = None,
        date_range: DateFilter = None,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        value_filter: Optional[ValueFilter] = None,
        allow_null_end_date: bool = True,
        **kwargs,
    ):
        if name is None:
            name = "TimeRangeCountPhenotype"
        super(TimeRangeCountPhenotype, self).__init__(name=name, **kwargs)

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
                    if not any(c is rtr.anchor_phenotype for c in self.children):
                        self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]
        table = self._perform_null_filtering(table)
        table = self._perform_date_range_filtering(table)
        table = self._perform_time_filtering(table)
        table = self._perform_count_aggregation(table)
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

    def _perform_date_range_filtering(self, table):
        """Keep only periods that fall entirely within the date range (no clipping; partial periods are excluded)."""
        if self.date_range is None:
            return table
        if self.date_range.min_value is not None:
            min_date = self.date_range.min_value.value
            table = table.filter(table.START_DATE >= ibis.literal(min_date))
        if self.date_range.max_value is not None:
            max_date = self.date_range.max_value.value
            table = table.filter(table.END_DATE <= ibis.literal(max_date))
        return table

    def _perform_time_filtering(self, table):
        """Apply relative time range filtering, excluding periods that cross boundaries."""
        if self.relative_time_range is None:
            return table
        time_filter = TimeRangeFilter(
            relative_time_range=self.relative_time_range,
            include_clipped_periods=False,
            clip_periods=False,
        )
        return time_filter.filter(table)

    def _perform_count_aggregation(self, table):
        """Count the number of distinct time periods per person."""
        table = table.select(["PERSON_ID", "START_DATE", "END_DATE"]).distinct()
        return table.group_by("PERSON_ID").aggregate(VALUE=_.count())

    def _perform_value_filtering(self, table):
        """Filter persons by period count using value_filter."""
        if self.value_filter is not None:
            table = self.value_filter.filter(table)
        return table

    def _perform_zero_fill(self, table, tables):
        """Left-join against the PERSON table to include persons with 0 periods (only when no value_filter is set)."""
        if self.value_filter is not None or "PERSON" not in tables:
            return table
        persons = tables["PERSON"].select("PERSON_ID").distinct()
        table = persons.join(
            table, persons.PERSON_ID == table.PERSON_ID, how="left"
        ).drop("PERSON_ID_right")
        return table.mutate(VALUE=table.VALUE.fillna(0))
