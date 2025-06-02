from typing import Union, List, Dict, Optional
from phenex.tables import PhenexObservationPeriodTable
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.value import GreaterThanOrEqualTo, Value
from phenex.filters.codelist_filter import CodelistFilter
from phenex.filters.relative_time_range_filter import (
    verify_relative_time_range_filter_input,
    RelativeTimeRangeFilter,
)
from phenex.filters import DateFilter, ValueFilter
from phenex.aggregators import First, Last
from phenex.codelists import Codelist
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import attach_anchor_and_get_reference_date
from ibis import _
from ibis.expr.types.relations import Table
import ibis


class ContinuousCoveragePhenotype(Phenotype):
    """
    ContinuousCoveragePhenotype identifies patients based on duration of observation data. ContinuousCoveragePhenotype requires an anchor phenotype, typically the entry criterion. It then identifies an observation time period that contains the anchor phenotype. The phenotype can then be used to identify patients with a user specified continuous coverage before or after the anchor phenotype. The returned Phenotype has the following interpretation:

    DATE: Date of anchor phenotype (date at which the continuous coverage is computed)
    VALUE: Coverage (in days) relative to the given reference date. By convention, always non-negative.

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
    Example :
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
        value_filter: Optional[ValueFilter] = None,
        anchor_phenotype: Optional[Phenotype] = None,
        when: Optional[str] = "before",
        domain: Optional[str] = "OBSERVATION_PERIOD",
        **kwargs
    ):
        super(ContinuousCoveragePhenotype, self).__init__(
            value_filter=value_filter, **kwargs
        )
        self.name = name
        self.domain = domain
        if self.value_filter:
            verify_relative_time_range_filter_input(
                self.value_filter.min_value, self.value_filter.max_value, when
            )
        self.when = when

        # Set children to the dependent PHENOTYPES
        self.anchor_phenotype = anchor_phenotype
        if anchor_phenotype is not None:
            self.children = [anchor_phenotype]
        else:
            self.children = []

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:

        table = tables[self.domain]
        table, reference_column = attach_anchor_and_get_reference_date(
            table, self.anchor_phenotype
        )

        # Ensure that the observation period includes anchor date
        table = table.filter(
            (table.OBSERVATION_PERIOD_START_DATE <= reference_column)
            & (reference_column <= table.OBSERVATION_PERIOD_END_DATE)
        )

        if self.when == "before":
            DAYS_FROM_ANCHOR = reference_column.delta(
                table.OBSERVATION_PERIOD_START_DATE, "day"
            )
        else:
            DAYS_FROM_ANCHOR = table.OBSERVATION_PERIOD_END_DATE.delta(
                reference_column, "day"
            )

        # Define VALUE and EVENT_DATE; Parent class handles final filtering
        # and processing
        table = table.mutate(VALUE=DAYS_FROM_ANCHOR)
        table = table.mutate(EVENT_DATE=reference_column)

        return table
