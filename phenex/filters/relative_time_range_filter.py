from typing import Optional

# from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.filter import Filter
from phenex.filters.value_filter import ValueFilter
from phenex.tables import EventTable, is_phenex_phenotype_table
from phenex.filters.value import *
from phenex.phenotypes.functions import attach_anchor_and_get_reference_date


class RelativeTimeRangeFilter(Filter):
    """
    This class filters events in an EventTable based on a specified time range relative to an anchor date.  The anchor date can either be provided by an anchor phenotype or by an 'INDEX_DATE' column in the EventTable.

    Parameters:
        min_days: Minimum number of days from the anchor date to filter events.
        max_days: Maximum number of days from the anchor date to filter events.
        anchor_phenotype: A phenotype providing the anchor date for filtering.
        when: when can be "before" or "after"; if "before", days prior to anchor event_date are positive, and days after are negative; using after, days before the anchor event_date are negative and days after the anchor event_date are positive.

    Methods:
        filter: Filters the given EventTable based on the specified time range relative to the anchor date.

    Examples:
        ```
        # filter events to one year before index date, excluding index date
        from phenex.filters.value import LessThan, GreaterThan
        one_year_preindex = RelativeTimeRangeFilter(
            max_days = LessThan(365),
            min_days = GreaterThan(0),
            when = 'before'
            )
        ```

        ```
        # filter events to one year after index date, including index date
        anytime_after_index = RelativeTimeRangeFilter(
            min_days = GreaterThan(0),
            when = 'after'
            )
        ```
    """

    def __init__(
        self,
        min_days: Optional[Value] = GreaterThanOrEqualTo(0),
        max_days: Optional[Value] = None,
        when: Optional[str] = "before",
        anchor_phenotype: Optional["Phenotype"] = None,
    ):
        verify_relative_time_range_filter_input(min_days, max_days, when)

        self.min_days = min_days
        self.max_days = max_days
        self.when = when
        self.anchor_phenotype = anchor_phenotype
        super(RelativeTimeRangeFilter, self).__init__()

    def _filter(self, table: EventTable):
        table, reference_column = attach_anchor_and_get_reference_date(
            table, self.anchor_phenotype
        )

        DAYS_FROM_ANCHOR = reference_column.delta(table.EVENT_DATE, "day")
        if self.when == "after":
            DAYS_FROM_ANCHOR = -DAYS_FROM_ANCHOR

        table = table.mutate(DAYS_FROM_ANCHOR=DAYS_FROM_ANCHOR)

        conditions = []

        value_filter = ValueFilter(
            min_value=self.min_days,
            max_value=self.max_days,
            column_name="DAYS_FROM_ANCHOR",
        )

        return value_filter.filter(table)


def verify_relative_time_range_filter_input(min_days, max_days, when):
    if min_days is not None:
        assert min_days.operator in [
            ">",
            ">=",
        ], f"min_days operator must be > or >=, not {min_days.operator}"
    if max_days is not None:
        assert max_days.operator in [
            "<",
            "<=",
        ], f"max_days operator must be > or >=, not {max_days.operator}"
    if max_days is not None and min_days is not None:
        assert (
            min_days.value <= max_days.value
        ), f"min_days must be less than or equal to max_days"
    assert when in [
        "before",
        "after",
    ], f"when must be 'before' or 'after', not {when}"
