from typing import Dict, Optional
from ibis.expr.types.relations import Table
import ibis

from phenex.node import Node
from phenex.util import create_logger

logger = create_logger(__name__)


class CombineOverlappingPeriods(Node):
    """
    CombineOverlappingPeriods takes overlapping and consecutive time periods the source table and combines them into a single time period with a single start and end date on a per patient level. For example, if a patient has two visits with the same start and end date, they will be combined into one visit. If a patient has two visits with overlapping dates, they will be combined into one visit with the earliest start date and the latest end date. If a patient has two visits with consecutive dates, they will be combined into one visit with the earliest start date and the latest end date.
    This is useful for creating a single time period for a patient, e.g. admission discharge periods, vaccination periods, etc. It is also useful for creating a single time period for a patient when there are multiple visits with the same start and end date, or overlapping dates.
    """

    def __init__(
        self,
        domain: str,
        categorical_filter: Optional["CategoricalFilter"] = None,
        **kwargs
    ):
        self.domain = domain
        self.categorical_filter = categorical_filter
        super(CombineOverlappingPeriods, self).__init__(**kwargs)

    def _execute(
        self,
        tables: Dict[str, Table],
    ) -> "Table":
        # get the appropriate table
        table = tables[self.domain]
        if self.categorical_filter is not None:
            # apply the categorical filter to the table
            table = self.categorical_filter.autojoin_filter(table, tables)

        # subset to only the relevant columns and sort
        table = table.select("PERSON_ID", "START_DATE", "END_DATE")

        # Step 1: Sort by PERSON_ID, START_DATE, END_DATE
        table = table.order_by(["PERSON_ID", "START_DATE", "END_DATE"])

        # Step 1.5: Remove intervals that are wholly contained within other intervals
        # For each interval, check if there's another interval that completely contains it

        # Self-join to find containing intervals
        table_alias = table.view()  # Create an alias for self-join

        # Find intervals that are wholly contained within another interval
        contained_intervals = (
            table.inner_join(
                table_alias,
                [
                    table.PERSON_ID == table_alias.PERSON_ID,
                    table.START_DATE >= table_alias.START_DATE,
                    table.END_DATE <= table_alias.END_DATE,
                    # Not the same interval (at least one bound is strictly contained)
                    (table.START_DATE > table_alias.START_DATE)
                    | (table.END_DATE < table_alias.END_DATE),
                ],
            )
            .select(table.PERSON_ID, table.START_DATE, table.END_DATE)
            .distinct()
        )

        # Remove wholly contained intervals
        table = table.anti_join(
            contained_intervals, ["PERSON_ID", "START_DATE", "END_DATE"]
        )

        # Re-sort after filtering
        table = table.order_by(["PERSON_ID", "START_DATE", "END_DATE"])

        # Step 2: Create lag window to get previous end date for each person
        prev_end = table.END_DATE.lag(1).over(
            ibis.window(
                group_by=table.PERSON_ID, order_by=[table.START_DATE, table.END_DATE]
            )
        )

        # Step 3: Determine if current period starts a new group
        # New group starts if there's no previous period or if there's a gap > 1 day
        # This matches the original pandas logic: start > merged[-1][1] + pd.Timedelta(days=1)
        table = table.mutate(
            prev_end_date=prev_end,
            new_group=ibis.case()
            .when(prev_end.isnull(), 1)  # First record for person
            .when(
                table.START_DATE > (prev_end + ibis.interval(days=1)), 1
            )  # Gap > 1 day
            .else_(0)  # Overlapping, consecutive, or same day periods
            .end(),
        )

        # Step 4: Create group IDs using cumulative sum within each person
        # Create a row number first, then use it to calculate running sum properly
        table = table.mutate(
            row_num=ibis.row_number().over(
                ibis.window(
                    group_by=table.PERSON_ID,
                    order_by=[table.START_DATE, table.END_DATE],
                )
            )
        )

        # Now calculate cumulative sum of new_group within each person
        table = table.mutate(
            group_num=table.new_group.sum().over(
                ibis.window(
                    group_by=table.PERSON_ID,
                    order_by=table.row_num,
                    rows=(None, 0),  # Unbounded preceding to current row
                )
            )
        )

        # Create a composite group ID to ensure uniqueness across persons
        table = table.mutate(
            group_id=table.PERSON_ID.cast("string")
            + "_"
            + table.group_num.cast("string")
        )

        # Step 5: Aggregate by person and group to get merged periods
        result = table.group_by(["PERSON_ID", "group_id"]).aggregate(
            START_DATE=table.START_DATE.min(), END_DATE=table.END_DATE.max()
        )

        # Step 6: Select final columns and sort
        result = result.select("PERSON_ID", "START_DATE", "END_DATE").order_by(
            ["PERSON_ID", "START_DATE"]
        )

        return result
