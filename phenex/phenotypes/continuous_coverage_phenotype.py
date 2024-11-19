from typing import Union, List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.value import Value
from phenex.filters.codelist_filter import CodelistFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.date_range_filter import DateRangeFilter
from phenex.filters.aggregator import First, Last
from phenex.codelists import Codelist
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from ibis import _
from ibis.expr.types.relations import Table
import ibis


class ContinuousCoveragePhenotype(Phenotype):
    """
    A phenotype based on continuous coverage within an observation period.

    This class helps generate SQL queries to filter a population based on
    continuous coverage criteria within the observation period.

    :param domain: The domain of the phenotype, default is 'observation_period'. The domain
        key is used at runtime to determine which table to run on.
    :param coverage_period_min: The minimum coverage period for the phenotype with a default
        of 0 days. The operator must be '>=' or '>'.
    :param return_date: An optional return date for the phenotype result. Possible values are
        "first" and "last", where "first" is the beginning of the coverage period containing
        the index date and "last" in the end of the coverage period containing the index date.

    Example usage: Find all patients with at least 90 days of continuous coverage
    --------------
    >>> coverage_min_filter = ValueFilter(">=", 90)
    >>> phenotype = ContinuousCoveragePhenotype(coverage_period_min=coverage_min_filter)
    """

    def __init__(self,
        name:Optional[str] = 'continuous_coverage',
        domain:Optional[str] = 'OBSERVATION_PERIOD',
        relative_time_range:Optional[RelativeTimeRangeFilter] = None,
        min_days : Optional[Value] = None,
        anchor_phenotype:Optional[Phenotype] = None,
    ):
        super().__init__()
        self.name = name
        self.domain = domain
        self.relative_time_range = relative_time_range
        self.min_days = min_days

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        coverage_table = tables[self.domain]
        # first perform time range filter on observation period start date
        coverage_table = coverage_table.mutate(EVENT_DATE = coverage_table.OBSERVATION_PERIOD_START_DATE)
        coverage_table = self._perform_time_filtering(coverage_table)
        # ensure that coverage end extends past the anchor date
        coverage_table = self._filter_observation_period_end(coverage_table)
        coverage_table = self._filter_coverage_period(coverage_table)

        coverage_table = coverage_table.mutate(EVENT_DATE = ibis.null())
        return coverage_table

    def _perform_time_filtering(self, coverage_table):
        '''
        Filter the observation period start
        '''
        if self.relative_time_range is not None:
            coverage_table = self.relative_time_range.filter(coverage_table)
        return coverage_table

    def _filter_observation_period_end(self, coverage_table):
        '''
        Get only rows where the observation period end date is after the anchor date
        '''
        if self.relative_time_range is not None:
            if self.relative_time_range.anchor_phenotype is not None:
                reference_column = self.relative_time_range.anchor_phenotype.table.EVENT_DATE
            else:
                reference_column = coverage_table.INDEX_DATE

            coverage_table = coverage_table.filter(
                coverage_table.OBSERVATION_PERIOD_END_DATE >= reference_column
            )
        return coverage_table


    def _filter_coverage_period(self, coverage_table: Table) -> Table:
        if self.min_days.operator == '>':
            coverage_table = coverage_table.filter(
                (coverage_table['DAYS_FROM_ANCHOR'] > self.min_days.value)
            )
        elif self.min_days.operator == '>=':
            coverage_table = coverage_table.filter(
                (coverage_table['DAYS_FROM_ANCHOR'] >= self.min_days.value)
            )
        elif self.min_days.operator == '<':
            coverage_table = coverage_table.filter(
                (coverage_table['DAYS_FROM_ANCHOR'] < self.min_days.value)
            )
        elif self.min_days.operator == '<=':
            coverage_table = coverage_table.filter(
                (coverage_table['DAYS_FROM_ANCHOR'] <= self.min_days.value)
            )
        return coverage_table


    def get_codelists(self):
        return []
