from typing import Union, List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import ValueFilter, DateFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import attach_anchor_and_get_reference_date
from ibis import _
from ibis.expr.types.relations import Table
import ibis


class TimeRangePhenotype(Phenotype):
    """
    Use TimeRangePhenotype to work with data that has start and end dates — most commonly health insurance coverage (OBSERVATION_PERIOD). The two primary use cases are: (1) require minimum continuous enrollment/coverage before or after index date (e.g. "1 year of continuous coverage prior to index"), and (2) determine the date of loss to follow-up (right censoring). The input domain must have START_DATE and END_DATE columns.

    This phenotype returns:
        DATE: If when='before', the start of the coverage period containing the anchor. If 'after', the end of that period.
        VALUE: Coverage in days relative to the anchor date (always non-negative).

    ## Data for TimeRangePhenotype
    This phenotype requires a table with PersonID and a coverage start date and end date. Depending on the datasource used, this information is a separate ObservationPeriod table or found in the PersonTable. Use an PhenexObservationPeriodTable to map required coverage start and end date columns. For tables with overlapping time ranges, use the CombineOverlappingPeriods derived table to combine time ranges into a single time range.

    | PersonID    |   startDate          |   endDate          |
    |-------------|----------------------|--------------------|
    | 1           |   2009-01-01         |   2010-01-01       |
    | 2           |   2008-01-01         |   2010-01-02       |

    One assumption that is made by TimeRangePhenotype is that there are **NO overlapping coverage periods**.

    Parameters:
        name: The name of the phenotype.
        domain: The domain of the phenotype. Default is 'observation_period'.
        date_range: A DateFilter to apply. min_date clips START_DATE (periods starting before min_date are trimmed to min_date); max_date clips END_DATE (periods ending after max_date are trimmed to max_date). Periods entirely outside the range are excluded. VALUE is then computed on the clipped period.
        relative_time_range: Filter returned persons based on the duration of coverage in days. The relative_time_range.anchor_phenotype defines the reference date with respect to calculate coverage. In typical applications, the anchor phenotype will be the entry criterion. The relative_time_range.when 'before', 'after'. If before, the return date is the start of the coverage period containing the anchor_phenotype. If after, the return date is the end of the coverage period containing the anchor_phenotype.
        allow_null_end_date: TimeRangePhenotype checks that anchor date is within the time range of interest. This requires that the start date is not null, and the end date is either null or after the anchor date. If you want to require that the end date is not null, set allow_null_end_date to False.

    Example:
    ```python
    # make sure to create an entry phenotype, for example 'atrial fibrillation diagnosis'
    entry_phenotype = CodelistPhenotype(...)
    # one year continuous coverage prior to index
    one_year_coverage = TimeRangePhenotype(
        relative_time_range = RelativeTimeRangeFilter(
            min_days=GreaterThanOrEqualTo(365),
            anchor_phenotype = entry_phenotype,
            when = 'before',
        ),
    )
    # determine the date of loss to followup
    loss_to_followup = TimeRangePhenotype(
        relative_time_range = RelativeTimeRangeFilter(
            anchor_phenotype = entry_phenotype
            when = 'after',
        )
    )

    # determine the date when a drug was discontinued
    drug_discontinuation = TimeRangePhenotype(
        relative_time_range = RelativeTimeRangeFilter(
            anchor_phenotype = entry_phenotype
            when = 'after',
        )
    )
    ```
    """

    output_display_type = "value"

    def __init__(
        self,
        name: Optional[str] = "TIME_RANGE",
        domain: Optional[str] = "OBSERVATION_PERIOD",
        date_range: Optional[DateFilter] = None,
        relative_time_range: Optional["RelativeTimeRangeFilter"] = None,
        allow_null_end_date: bool = True,
        **kwargs
    ):
        super(TimeRangePhenotype, self).__init__(name=name, **kwargs)
        self.domain = domain
        self.date_range = date_range
        self.relative_time_range = relative_time_range
        self.allow_null_end_date = allow_null_end_date
        if self.relative_time_range is not None:
            if self.relative_time_range.anchor_phenotype is not None:
                self.add_children(self.relative_time_range.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]
        table = self._perform_anchor_join(table)
        table = self._perform_date_range_clipping(table)
        table = self._perform_anchor_containment_filtering(table)
        table = self._perform_value_date_assignment(table)
        table = self._perform_coverage_duration_filtering(table)
        return self._perform_final_processing(table)

    def _perform_anchor_join(self, table):
        """Join the domain table with the anchor phenotype to get the reference date column."""
        table, reference_column = attach_anchor_and_get_reference_date(
            table, self.relative_time_range.anchor_phenotype
        )
        self._reference_column = reference_column
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

    def _perform_anchor_containment_filtering(self, table):
        """Keep only periods that contain the anchor date. Null END_DATE is treated as ongoing if allow_null_end_date is True."""
        ref = self._reference_column
        if self.allow_null_end_date:
            return table.filter(
                (table.START_DATE <= ref)
                & ((ref <= table.END_DATE) | table.END_DATE.isnull())
            )
        return table.filter((table.START_DATE <= ref) & (ref <= table.END_DATE))

    def _perform_value_date_assignment(self, table):
        """Assign VALUE (coverage days) and EVENT_DATE based on the direction of the relative time range."""
        ref = self._reference_column
        if (
            self.relative_time_range is None
            or self.relative_time_range.when == "before"
        ):
            value = ref.cast("date").delta(table.START_DATE.cast("date"), "day")
            event_date = table.START_DATE
        else:
            value = table.END_DATE.cast("date").delta(ref.cast("date"), "day")
            event_date = table.END_DATE
        return table.mutate(VALUE=value, EVENT_DATE=event_date)

    def _perform_coverage_duration_filtering(self, table):
        """Filter by min_days / max_days from the relative time range."""
        if self.relative_time_range is None:
            return table
        value_filter = ValueFilter(
            min_value=self.relative_time_range.min_days,
            max_value=self.relative_time_range.max_days,
            column_name="VALUE",
        )
        return value_filter.filter(table)
