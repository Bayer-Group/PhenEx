from typing import Dict, Optional
from ibis.expr.types.relations import Table
import ibis
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.filters.codelist_filter import CodelistFilter
from phenex.node import Node
from phenex.util import create_logger
from phenex.codelists import Codelist

from .combine_overlapping_periods import CombineOverlappingPeriods

logger = create_logger(__name__)


class EventsToTimeRange(Node):
    """
    EventsToTimeRange converts individual code events into time ranges with start and end dates.

    This derived table takes a codelist (e.g. medication prescriptions) and creates a
    time range for each event. The start date is the event date, and the end date is calculated
    by adding a specified number of days to the start date. Adjacent or overlapping periods are
    combined into single continuous periods.

    This is particularly useful for identifying medication discontinuation when only prescription
    dates (not durations) are available. For example, discontinuation may be defined as a gap of
    ≥180 days between prescriptions.

    Parameters:
        domain: The source domain containing event data.
        codelist: The codelist used to filter events.
        max_days: Fixed integer number of days used to compute the end date for every row.
                  Mutually exclusive with ``days_columnname``.
        days_columnname: Name of a column in the source table whose integer value is used to
                         compute the end date, allowing a different duration per row.
                         Mutually exclusive with ``max_days``.
        operator: Comparison operator applied to the day count. Use ``'<='`` (default) to add
                  the day value directly, or ``'<'`` to subtract one day first (exclusive upper
                  bound). Applies to both ``max_days`` and ``days_columnname``.
        name: Optional name for the derived table.

    Attributes:
        domain: The domain of events to process.
        codelist: The codelist used for filtering events.
        max_days: Fixed day count (when used).
        days_columnname: Column name providing per-row day counts (when used).
        operator: The comparison operator (``'<='`` or ``'<'``).

    Examples:

    Example: Identifying medication discontinuation
        ```python
        from phenex.derived_tables import EventsToTimeRange
        from phenex.phenotypes import TimeRangePhenotype
        from phenex.codelists import Codelist
        from phenex.filters.value import LessThanOrEqualTo
        from phenex.filters import RelativeTimeRangeFilter

        # Create a derived table for medication coverage periods
        et_codelist = Codelist(["RX12345", "RX12346"])
        derived_table = EventsToTimeRange(
            name = 'ET_USAGE',
            domain = 'DRUG_EXPOSURE',
            codelist = et_codelist,
            max_days = 180,
        )

        # Return the persons that discontinue post index
        # EVENT_DATE column will be the date of discontinuation
        # VALUE will be the number of days from index to discontinuation date
        pt_et_discontinuation = TimeRangePhenotype(
            domain = 'ET_USAGE',
            relative_time_range = RelativeTimeRangeFilter(
                when = 'after',
            )
        )

        # Execute the derived table with your data
        et_periods = derived_table.execute(tables)
        ```
    """

    def __init__(
        self,
        domain: str,
        max_days: Optional[int] = None,
        codelist: Optional["Codelist"] = None,
        days_columnname: Optional[str] = None,
        operator: str = "<=",
        **kwargs,
    ):
        self.domain = domain
        if codelist is not None:
            if not isinstance(codelist, Codelist):
                raise ValueError("codelist must be an instance of Codelist or None")
            self.codelist_filter = CodelistFilter(codelist)
        self.codelist = codelist

        if max_days is None and days_columnname is None:
            raise ValueError("Either max_days or days_columnname must be provided")
        if max_days is not None and days_columnname is not None:
            raise ValueError("Only one of max_days or days_columnname may be provided")
        if operator not in ("<", "<="):
            raise ValueError(f"operator must be '<' or '<=', not {operator!r}")

        self.max_days = max_days
        self.days_columnname = days_columnname
        self.operator = operator
        super(EventsToTimeRange, self).__init__(**kwargs)

    def _execute(
        self,
        tables: Dict[str, Table],
    ) -> "Table":
        table = tables[self.domain]
        table = self._perform_codelist_filtering(table, tables)
        table = self._create_start_end_date_table(table)
        table = self._combine_overlapping_periods(table)
        return table

    def _perform_codelist_filtering(self, table, tables):
        """
        Filter source table to codelist events of interest i.e. drug x events only

        Returns:
            Source DataFrame with all original columns:
        """
        if self.codelist is None:
            return table
        assert is_phenex_code_table(table)
        table = self.codelist_filter.autojoin_filter(table, tables)
        return table

    def _create_start_end_date_table(self, table):
        """
        Create start and end date columns for the events. Start date is the event
        date; end date is computed either from the fixed ``max_days`` value or from
        the per-row integer column ``days_columnname``.

        Returns:
            Table with three columns:
            PERSON_ID
            START_DATE : the codelist EVENT_DATE
            END_DATE   : START_DATE + days (fixed or per-row)
        """
        if self.days_columnname is not None:
            table = table.select("PERSON_ID", "EVENT_DATE", self.days_columnname)
        else:
            table = table.select("PERSON_ID", "EVENT_DATE")
        table = table.mutate(EVENT_DATE=table.EVENT_DATE.cast("date"))
        table = table.distinct()
        table = table.mutate(START_DATE=table.EVENT_DATE)
        offset = -1 if self.operator == "<" else 0
        if self.days_columnname is not None:
            days_col = table[self.days_columnname].cast("int32") + offset
            table = table.mutate(
                END_DATE=table.START_DATE + ibis.interval(days=1) * days_col
            )
        else:
            table = table.mutate(
                END_DATE=table.START_DATE + ibis.interval(days=self.max_days + offset)
            )
        return table.select("PERSON_ID", "START_DATE", "END_DATE")

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
