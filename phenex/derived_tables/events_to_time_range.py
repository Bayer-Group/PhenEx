from typing import Dict, Optional
from ibis.expr.types.relations import Table
import ibis
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.filters.codelist_filter import CodelistFilter
from phenex.node import Node
from phenex.util import create_logger

from .combine_overlapping_periods import CombineOverlappingPeriods

logger = create_logger(__name__)


class EventsToTimeRange(Node):
    """
    EventsToTimeRange ...
    """

    def __init__(self, domain: str, codelist: "Codelist", max_days: "Value", **kwargs):
        self.domain = domain
        self.codelist_filter = CodelistFilter(codelist)
        self.codelist = codelist

        assert max_days.operator in [
            "<",
            "<=",
        ], f"max_days operator must be < or <=, not {max_days.operator}"
        self.max_days = max_days
        super(EventsToTimeRange, self).__init__(**kwargs)

    def _execute(
        self,
        tables: Dict[str, Table],
    ) -> "Table":
        table = tables[self.domain]
        table = self._perform_codelist_filtering(table)
        table = self._create_start_end_date_table(table)
        table = self._combine_overlapping_periods(table)
        return table

    def _perform_codelist_filtering(self, table):
        """
        Filter source table to codelist events of interest i.e. drug x events only

        Returns:
            Source DataFrame with all original columns:
        """
        assert is_phenex_code_table(table)
        table = self.codelist_filter.filter(table)
        return table

    def _create_start_end_date_table(self, table):
        """
        Create start and end date columns for the events. Start date is the codelist event, end date is the start date plus max_days.

        Returns:
            Table with three columns
            PERSON_ID
            START_DATE : the codelist EVENT_DATE
            END_DATE : START_DATE + max_days
        """
        table = table.select("PERSON_ID", "EVENT_DATE")
        table = table.mutate(START_DATE=table.EVENT_DATE)
        if self.max_days.operator == "<":
            days_to_add = self.max_days.value - 1
            table = table.mutate(
                END_DATE=table.START_DATE + ibis.interval(days=days_to_add)
            )
        else:
            days_to_add = self.max_days.value
            table = table.mutate(
                END_DATE=table.START_DATE + ibis.interval(days=days_to_add)
            )
        return table

    def _combine_overlapping_periods(self, table):
        """
        Combine all overlapping and consecutive periods

        Returns:
            Table with three columns with consecutive and overlapping periods combined into single time ranges
            PERSON_ID
            START_DATE : the codelist EVENT_DATE
            END_DATE : START_DATE + max_days
        """
        cop = CombineOverlappingPeriods(domain="_")
        table = cop.execute(tables={"_": table})
        return table
