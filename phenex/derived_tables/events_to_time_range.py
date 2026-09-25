from typing import Dict, Optional
from ibis.expr.types.relations import Table
import ibis
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.filters.codelist_filter import CodelistFilter
from phenex.node import DerivedTable
from phenex.util import create_logger
from phenex.codelists import Codelist

from .combine_overlapping_periods import CombineOverlappingPeriods

logger = create_logger(__name__)


class EventsToTimeRange(DerivedTable):
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
        max_days: Fixed integer number of days used to compute the end date. Used for every row
                  when ``days_columnname`` is not provided, or as a fallback when the
                  ``days_columnname`` value is null for a given row.
        days_columnname: Name of a column in the source table whose integer value is used to
                         compute the end date for that row, allowing a different duration per row.
                         When the column value is null, ``max_days`` is used instead.
        operator: Comparison operator applied to the day count. Use ``'<='`` (default) to add
                  the day value directly, or ``'<'`` to subtract one day first (exclusive upper
                  bound). Applies to both ``max_days`` and ``days_columnname``.
        gap_period: Additional days appended to the computed day count before deriving the end
                    date. For example, with ``max_days=30`` and ``gap_period=5`` the end date is
                    calculated as if ``max_days=35``. The ``operator`` offset is applied to the
                    combined total. Defaults to ``0`` (no gap).
        exit_domain: Name of a domain table containing events that should terminate a period
                     early, e.g. an observation that contradicts the state represented by
                     ``domain`` (a normal-range lab value while tracking an abnormal-range
                     state). When provided, the tentative end date (``START_DATE`` + days) is
                     truncated to the day before the earliest such event that falls within the
                     period. If the contradictory event falls on the same day as ``START_DATE``
                     (a same-day discordant observation), the period ends immediately, i.e.
                     ``END_DATE`` is set to ``START_DATE``.
        exit_codelist: Optional codelist used to filter ``exit_domain`` down to the events that
                       count as contradictory/exit events. Requires ``exit_domain`` to be a code
                       table. If omitted, every row of ``exit_domain`` is treated as a
                       contradictory event.
        name: Optional name for the derived table.

    Attributes:
        domain: The domain of events to process.
        codelist: The codelist used for filtering events.
        max_days: Fixed day count fallback.
        days_columnname: Column name providing per-row day counts (when used).
        operator: The comparison operator (``'<='`` or ``'<'``).
        gap_period: Additional days added to each day count before computing the end date.
        exit_domain: Domain of events that end a period early.
        exit_codelist: Codelist used to filter ``exit_domain`` to contradictory events.

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

    Example: Ending a state early on a contradictory observation
        ```python
        from phenex.derived_tables import EventsToTimeRange, LoadTable

        # domain of abnormal LVEF observations (VALUE <= 35)
        lvef_low = LoadTable(
            name="LVEF_LOW",
            table_name="LVEF_ALL_PATIENTS",
            database=SNOWFLAKE_DEST_DATABASE,
            function=aggregate_lvef_low,
        )

        # domain of normal LVEF observations (VALUE > 35), used only to end periods early
        lvef_normal = LoadTable(
            name="LVEF_NORMAL",
            table_name="LVEF_ALL_PATIENTS",
            database=SNOWFLAKE_DEST_DATABASE,
            function=aggregate_lvef_normal,
        )

        lvef_as_time_ranges = EventsToTimeRange(
            name="LVEF_TIME_RANGE",
            domain="LVEF_LOW",
            max_days=90,
            exit_domain="LVEF_NORMAL",
        )
        ```
    """

    def __init__(
        self,
        domain: str,
        max_days: Optional[int] = None,
        codelist: Optional["Codelist"] = None,
        days_columnname: Optional[str] = None,
        operator: str = "<=",
        gap_period: int = 0,
        exit_domain: Optional[str] = None,
        exit_codelist: Optional["Codelist"] = None,
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
        if operator not in ("<", "<="):
            raise ValueError(f"operator must be '<' or '<=', not {operator!r}")

        if exit_codelist is not None and exit_domain is None:
            raise ValueError("exit_domain must be provided when exit_codelist is used")
        if exit_codelist is not None:
            if not isinstance(exit_codelist, Codelist):
                raise ValueError(
                    "exit_codelist must be an instance of Codelist or None"
                )
            self.exit_codelist_filter = CodelistFilter(exit_codelist)
        self.exit_domain = exit_domain
        self.exit_codelist = exit_codelist

        self.max_days = max_days
        self.days_columnname = days_columnname
        self.operator = operator
        self.gap_period = gap_period
        super(EventsToTimeRange, self).__init__(**kwargs)

    def _execute(
        self,
        tables: Dict[str, Table],
    ) -> "Table":
        table = tables[self.domain]
        table = self._perform_codelist_filtering(table, tables)
        table = self._create_start_end_date_table(table)
        if self.exit_domain is not None:
            table = self._apply_exit_criteria(table, tables)
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

    def _apply_exit_criteria(self, table, tables):
        """
        Truncate each tentative period's END_DATE to end sooner when a contradictory
        exit event falls within the period. An exit event on the same day as
        START_DATE (same-day discordant observation) ends the period immediately, i.e.
        END_DATE is set equal to START_DATE. An exit event on a later day truncates
        END_DATE to the day before the exit event.

        Returns:
            Table with three columns:
            PERSON_ID
            START_DATE
            END_DATE : truncated to end before/at the earliest exit event, if any
        """
        exit_table = tables[self.exit_domain]
        if self.exit_codelist is not None:
            assert is_phenex_code_table(exit_table)
            exit_table = self.exit_codelist_filter.autojoin_filter(exit_table, tables)
        exit_table = exit_table.select("PERSON_ID", "EVENT_DATE").mutate(
            EVENT_DATE=exit_table.EVENT_DATE.cast("date")
        )
        exit_table = exit_table.rename(EXIT_DATE="EVENT_DATE").distinct()

        # Find the earliest exit event within each tentative period
        joined = table.inner_join(
            exit_table,
            [
                table.PERSON_ID == exit_table.PERSON_ID,
                exit_table.EXIT_DATE >= table.START_DATE,
                exit_table.EXIT_DATE <= table.END_DATE,
            ],
        ).select(
            table.PERSON_ID,
            table.START_DATE,
            table.END_DATE,
            exit_table.EXIT_DATE,
        )
        first_exit = joined.group_by(["PERSON_ID", "START_DATE"]).agg(
            FIRST_EXIT_DATE=joined.EXIT_DATE.min()
        )

        table = table.left_join(
            first_exit,
            [
                table.PERSON_ID == first_exit.PERSON_ID,
                table.START_DATE == first_exit.START_DATE,
            ],
        ).select(
            table.PERSON_ID,
            table.START_DATE,
            table.END_DATE,
            first_exit.FIRST_EXIT_DATE,
        )
        table = table.mutate(
            END_DATE=ibis.case()
            .when(table.FIRST_EXIT_DATE.isnull(), table.END_DATE)
            .when(table.FIRST_EXIT_DATE == table.START_DATE, table.START_DATE)
            .else_(
                ibis.least(
                    table.END_DATE, table.FIRST_EXIT_DATE - ibis.interval(days=1)
                )
            )
            .end()
        )
        return table.select("PERSON_ID", "START_DATE", "END_DATE")

    def _create_start_end_date_table(self, table):
        """
        Create start and end date columns for the events. Start date is the event
        date; end date is computed from the per-row ``days_columnname`` value when
        non-null, falling back to the fixed ``max_days`` value otherwise.

        Returns:
            Table with three columns:
            PERSON_ID
            START_DATE : the codelist EVENT_DATE
            END_DATE   : START_DATE + days (per-row or fixed)
        """
        if self.days_columnname is not None:
            table = table.select("PERSON_ID", "EVENT_DATE", self.days_columnname)
        else:
            table = table.select("PERSON_ID", "EVENT_DATE")
        table = table.mutate(EVENT_DATE=table.EVENT_DATE.cast("date"))
        table = table.distinct()
        table = table.mutate(START_DATE=table.EVENT_DATE)
        offset = -1 if self.operator == "<" else 0
        gap = self.gap_period
        if self.days_columnname is not None:
            days_col = table[self.days_columnname].cast("int32")
            if self.max_days is not None:
                days_col = (
                    ibis.case()
                    .when(days_col.isnull(), self.max_days)
                    .else_(days_col)
                    .end()
                )
            days_col = days_col + gap + offset
            table = table.mutate(
                END_DATE=table.START_DATE + days_col.as_interval(unit="D")
            )
        else:
            table = table.mutate(
                END_DATE=table.START_DATE
                + ibis.interval(days=self.max_days + gap + offset)
            )
        table = table.group_by(["PERSON_ID", "START_DATE"]).agg(
            END_DATE=table.END_DATE.max()
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
