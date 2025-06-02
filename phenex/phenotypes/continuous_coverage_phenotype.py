from typing import Union, List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.value import GreaterThanOrEqualTo
from phenex.filters.relative_time_range_filter import (
    verify_relative_time_range_filter_input,
    RelativeTimeRangeFilter,
)
from phenex.filters.date_filter import ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from ibis import _
from ibis.expr.types.relations import Table
import ibis


class ContinuousCoveragePhenotype(Phenotype):
    """
    ContinuousCoveragePhenotype identifies patients based on duration of observation data. ContinuousCoveragePhenotype requires an anchor phenotype, typically the entry criterion. It then identifies an observation time period that contains the anchor phenotype. The phenotype can then be used to identify patients with a user specified continuous coverage before or after the anchor phenotype.

    There are two primary use cases for ContinuousCoveragePhenotype:
        1. Identify patients with some minimum duration of coverage prior to anchor_phenotype date e.g. "identify patients with 1 year of continuous coverage prior to index date"
        2. Determine the date of loss to followup (right censoring) i.e. the duration of coverage after the anchor_phenotype event

    ## Data for ContinuousCoveragePhenotype
    This phenotype requires a table with PersonID and a coverage start date and end date. Depending on the datasource used, this information is a separate ObservationPeriod table or found in the PersonTable. Use an PhenexObservationPeriodTable to map required coverage start and end date columns.

    | PersonID    |   coverageStartDate  |   coverageEndDate  |
    |-------------|----------------------|--------------------|
    | 1           |   2009-01-01         |   2010-01-01       |
    | 2           |   2008-01-01         |   2010-01-02       |

    One assumption that is made by ContinuousCoveragePhenotype is that there are **NO overlapping coverage periods**.

    Parameters:
        name: The name of the phenotype.
        domain: The domain of the phenotype. Default is 'observation_period'.
        value_filter: Fitler returned persons based on the duration of coverage in days.
        anchor_phenotype: An anchor phenotype defines the reference date with respect to calculate coverage. In typical applications, the anchor phenotype will be the entry criterion.
        when: 'before', 'after'. If before, the return date is the start of the coverage period containing the anchor_phenotype. If after, the return date is the end of the coverage period containing the anchor_phenotype.

    Example:
    ```python
    # make sure to create an entry phenotype, for example 'atrial fibrillation diagnosis'
    entry_phenotype = CodelistPhenotype(...)
    # one year continuous coverage prior to index
    one_year_coverage = ContinuousCoveragePhenotype(
        when = 'before',
        value_filter = ValueFilter(
            min_value=GreaterThanOrEqualTo(365)
            ),
        anchor_phenotype = entry_phenotype
    )
    # determine the date of loss to followup
    loss_to_followup = ContinuousCoveragePhenotype(
        when = 'after',
        anchor_phenotype = entry_phenotype
    )
    ```
    """

    def __init__(
        self,
        name: Optional[str] = "continuous_coverage",
        domain: Optional[str] = "OBSERVATION_PERIOD",
        value_filter: Optional[ValueFilter] = None,
        when: Optional[str] = "before",
        anchor_phenotype: Optional[Phenotype] = None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.name = name
        self.domain = domain
        self.when = when
        self.min_days = self.max_days = None
        if value_filter:
            self.min_days = value_filter.min_value
            self.max_days = value_filter.max_value

        verify_relative_time_range_filter_input(self.min_days, self.max_days, self.when)
        self.anchor_phenotype = anchor_phenotype
        if self.anchor_phenotype is not None:
            self.children.append(self.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]

        # set time range filters depending on the when parameter
        if self.when == "before":
            min_days_for_trf_prior = self.min_days
            max_days_for_trf_prior = self.max_days

            min_days_for_trf_post = GreaterThanOrEqualTo(0)
            max_days_for_trf_post = None
        else:
            min_days_for_trf_prior = GreaterThanOrEqualTo(0)
            max_days_for_trf_prior = None

            min_days_for_trf_post = self.min_days
            max_days_for_trf_post = self.max_days

        # Ensure that the observation period start date is before the anchor date by defined time range
        table = table.mutate(EVENT_DATE=table.OBSERVATION_PERIOD_START_DATE)
        trf_prior = RelativeTimeRangeFilter(
            min_days=min_days_for_trf_prior,
            max_days=max_days_for_trf_prior,
            when="before",
            anchor_phenotype=self.anchor_phenotype,
        )
        table = trf_prior.filter(table)

        # Ensure that end date is after the anchor date
        table = table.mutate(EVENT_DATE=table.OBSERVATION_PERIOD_END_DATE)
        trf_post = RelativeTimeRangeFilter(
            min_days=min_days_for_trf_post,
            max_days=max_days_for_trf_post,
            when="after",
            anchor_phenotype=self.anchor_phenotype,
        )
        table = trf_post.filter(table)

        if self.when == "before":
            table = table.mutate(EVENT_DATE=table.OBSERVATION_PERIOD_START_DATE)
        else:
            table = table.mutate(EVENT_DATE=table.OBSERVATION_PERIOD_END_DATE)

        table = table.mutate(VALUE=ibis.null())
        return table
