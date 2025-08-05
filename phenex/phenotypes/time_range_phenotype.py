from typing import Union, List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.date_filter import ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import attach_anchor_and_get_reference_date
from ibis import _
from ibis.expr.types.relations import Table
import ibis


class TimeRangePhenotype(Phenotype):
    """
    As the name implies, TimeRangePhenotype is designed for working with time ranges. If the input data has a start and an end date, use TimeRangePhenotype to identify other events (or patients) that occur within this time range. The most common use case of this is working with 'health insurance coverage' data i.e. on 'OBSERVATION_PERIOD' table. These tables have one or many rows per patient with the start of coverage and end of coverage i.e. domains compatible with TimeRangePhenotype require a START_DATE and an END_DATE column. At it's simplest, TimeRangePhenotype identifies patients who have their INDEX_DATE (or other anchor date of interest) within this time range. Additionally, a minimum or maximum number of days from the anchor date to the beginning/end of the time range can be defined. The returned Phenotype has the following interpretation:

    DATE: If relative_time_range.when='before', then DATE is the beginning of the coverage period containing the anchor phenotype. If relative_time_range.when='after', then DATE is the end of the coverage period containing the anchor date.
    VALUE: Coverage (in days) relative to the anchor date. By convention, always non-negative.

    There are two primary use cases for TimeRangePhenotype:
        1. Identify patients with some minimum duration of coverage prior to anchor_phenotype date e.g. "identify patients with 1 year of continuous coverage prior to index date"
        2. Determine the date of loss to followup (right censoring) i.e. the duration of coverage after the anchor_phenotype event

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

    def __init__(
        self,
        name: Optional[str] = "TIME_RANGE",
        domain: Optional[str] = "OBSERVATION_PERIOD",
        relative_time_range: Optional["RelativeTimeRangeFilter"] = None,
        allow_null_end_date: bool = True,
        **kwargs
    ):
        super(TimeRangePhenotype, self).__init__(name=name, **kwargs)
        self.domain = domain
        self.relative_time_range = relative_time_range
        self.allow_null_end_date = allow_null_end_date
        if self.relative_time_range is not None:
            if self.relative_time_range.anchor_phenotype is not None:
                self.add_children(self.relative_time_range.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]
        table, reference_column = attach_anchor_and_get_reference_date(
            table, self.relative_time_range.anchor_phenotype
        )

        # Ensure that the observation period includes anchor date
        # Allow END_DATE to be null (ongoing periods) if allow_null_end_date is True
        if self.allow_null_end_date:
            table = table.filter(
                (table.START_DATE <= reference_column)
                & ((reference_column <= table.END_DATE) | (table.END_DATE.isnull()))
            )
        else:
            table = table.filter(
                (table.START_DATE <= reference_column)
                & (reference_column <= table.END_DATE)
            )

        if (
            self.relative_time_range is None
            or self.relative_time_range.when == "before"
        ):
            VALUE = reference_column.delta(table.START_DATE, "day")
            EVENT_DATE = table.START_DATE
        else:
            VALUE = table.END_DATE.delta(reference_column, "day")
            EVENT_DATE = table.END_DATE

        table = table.mutate(VALUE=VALUE, EVENT_DATE=EVENT_DATE)

        if self.relative_time_range is not None:
            value_filter = ValueFilter(
                min_value=self.relative_time_range.min_days,
                max_value=self.relative_time_range.max_days,
                column_name="VALUE",
            )
            ibis.options.interactive = True
            table = value_filter.filter(table)

        return self._perform_final_processing(table)
