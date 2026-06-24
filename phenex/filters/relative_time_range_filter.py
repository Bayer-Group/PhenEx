from typing import Optional

# from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.filter import Filter
from phenex.filters.value_filter import ValueFilter
from phenex.tables import EventTable, is_phenex_phenotype_table
from phenex.filters.value import *


class RelativeTimeRangeFilter(Filter):
    """
    Use RelativeTimeRangeFilter to restrict events to a time window relative to an anchor date (e.g. "within 365 days before index date", "any time after index"). The anchor is either a specified phenotype's event date or the INDEX_DATE column if no anchor phenotype is provided (the latter is only possible in the context of a cohort which has defined an entry phenotype; when in doubt, specify the anchor phenotype explicitly).

    Every time-relative operation in PhenEx requires an **anchor date** — the reference point from which "before" and "after" are measured. The anchor date is resolved as follows:

    1. **If `anchor_phenotype` is provided**, the EVENT_DATE of that phenotype is used as the anchor. The anchor phenotype must be executed before this filter runs (PhenEx handles this automatically when phenotypes are composed via the Cohort).
    2. **If `anchor_phenotype` is None** (the default), the `INDEX_DATE` column already present on the table is used. INDEX_DATE is set by the entry criterion of the cohort.

    The `when` parameter controls the direction:

    - `when='before'`: days *prior to* the anchor are positive, days *after* are negative.
    - `when='after'`: days *after* the anchor are positive, days *before* are negative.

    This convention means that `min_days` and `max_days` are always expressed as positive numbers regardless of direction.

    Parameters:
        min_days: Minimum number of days from the anchor date to include. Must use `GreaterThan` or `GreaterThanOrEqualTo`.
        max_days: Maximum number of days from the anchor date to include. Must use `LessThan` or `LessThanOrEqualTo`.
        anchor_phenotype: A phenotype whose EVENT_DATE is used as the anchor date. If None, the INDEX_DATE column on the input table is used.
        when: Direction relative to the anchor. Either 'before' or 'after'.

    Examples:

    Example: Baseline period — one year before index date
        ```python
        from phenex.filters import RelativeTimeRangeFilter
        from phenex.filters.value import LessThan, GreaterThan

        one_year_preindex = RelativeTimeRangeFilter(
            max_days=LessThan(365),
            min_days=GreaterThan(0),
            when='before',
        )
        ```

    Example: Follow-up period — anytime after index date
        ```python
        from phenex.filters import RelativeTimeRangeFilter
        from phenex.filters.value import GreaterThanOrEqualTo

        post_index = RelativeTimeRangeFilter(
            min_days=GreaterThanOrEqualTo(0),
            when='after',
        )
        ```

    Example: Anchored to another phenotype — events within 90 days after AF diagnosis
        ```python
        from phenex.phenotypes import CodelistPhenotype
        from phenex.codelists import Codelist
        from phenex.filters import RelativeTimeRangeFilter
        from phenex.filters.value import GreaterThanOrEqualTo, LessThanOrEqualTo

        af = CodelistPhenotype(
            name='af',
            domain='CONDITION_OCCURRENCE',
            codelist=Codelist([313217]),
            return_date='first',
        )

        within_90d_of_af = RelativeTimeRangeFilter(
            anchor_phenotype=af,
            min_days=GreaterThanOrEqualTo(0),
            max_days=LessThanOrEqualTo(90),
            when='after',
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
        if self.anchor_phenotype is not None:
            if self.anchor_phenotype.table is None:
                raise ValueError(
                    f"Dependent Phenotype {self.anchor_phenotype.name} must be executed before this node can run!"
                )
            else:
                anchor_table = self.anchor_phenotype.table
                reference_column = anchor_table.EVENT_DATE
                # Note that joins can change column names if the tables have name collisions!
                table = table.join(anchor_table, "PERSON_ID")
        else:
            assert (
                "INDEX_DATE" in table.columns
            ), f"INDEX_DATE column not found in table {table}"
            reference_column = table.INDEX_DATE

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
