from typing import Dict
import ibis
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.filters import DateFilter


class DataPeriodFilterNode(Node):
    """
    A compute node that filters tables by the data period (date range).

    This node ensures that phenotypes only have access to data within the specified date range. The output data should look as if the future (after date_filter.max_date) never happened and the past (before date_filter.min_date) was never observed.

    Filtering Rules:

        1. **EVENT_DATE Column**:
           If an EVENT_DATE column exists, filters the entire table to only include rows where EVENT_DATE falls within the date filter range.

        2. **START_DATE Column** (exact match):
           If a START_DATE column exists, adjusts values to max(original_value, date_filter.min_date) to ensure start dates are not before the study period.

           **Row Exclusion**: If START_DATE is strictly after date_filter.max_date, the entire row is dropped as the period doesn't overlap with the study period.

        3. **END_DATE Column** (exact match):
           If an END_DATE column exists, sets value to NULL if original_value > date_filter.max_date to indicate that the end event occurred outside the observation period.

           **Row Exclusion**: If END_DATE is strictly before date_filter.min_date, the entire row is dropped as the period doesn't overlap with the study period.

        4. **DATE_OF_DEATH Column** (exact match):
           If a DATE_OF_DEATH column exists, sets value to NULL if original_value > date_filter.max_date to indicate that death occurred outside the observation period.

    Parameters:
        name: Unique identifier for this node in the computation graph.
        domain: The name of the table domain to filter (e.g., 'CONDITION_OCCURRENCE', 'DRUG_EXPOSURE').
        date_filter: The date filter containing min_date and max_date constraints.

    Attributes:
        domain: The table domain being filtered.
        date_filter: The date filter with min/max value constraints.

    Examples:
        Example: Basic Date Period Filtering
        ```python
        from phenex.filters import DateFilter
        from phenex.filters.date_filter import AfterOrOn, BeforeOrOn

        # Create date filter for study period 2020
        date_filter = DateFilter(
            min_date=AfterOrOn("2020-01-01"),
            max_date=BeforeOrOn("2020-12-31")
        )

        # Filter condition occurrences table
        filter_node = DataPeriodFilterNode(
            name="CONDITIONS_FILTER",
            domain="CONDITION_OCCURRENCE",
            date_filter=date_filter
        )
        ```

        Example: Condition Occurrence Table (EVENT_DATE based)

        Input CONDITION_OCCURRENCE Table:
        ```
        PERSON_ID | EVENT_DATE | CONDITION_CONCEPT_ID
        ----------|------------|--------------------
        1         | 2019-11-15 | 201826            # Excluded: before study period
        2         | 2020-06-01 | 201826            # Kept: within study period
        3         | 2020-12-31 | 443767            # Kept: within study period
        4         | 2021-02-15 | 443767            # Excluded: after study period
        ```

        After applying DateFilter(2020-01-01 to 2020-12-31):
        ```
        PERSON_ID | EVENT_DATE | CONDITION_CONCEPT_ID
        ----------|------------|--------------------
        2         | 2020-06-01 | 201826
        3         | 2020-12-31 | 443767
        ```

        Example: Drug Exposure Table (START_DATE/END_DATE based)

        Input DRUG_EXPOSURE Table:
        ```
        PERSON_ID | START_DATE | END_DATE   | DRUG_CONCEPT_ID
        ----------|------------|------------|----------------
        1         | 2019-10-01| 2019-11-01| 1124300         # Excluded: ends before study period
        2         | 2019-11-01| 2020-03-01| 1124300         # Kept: overlaps study period (START_DATE adjusted)
        3         | 2020-06-01| 2020-08-01| 1124300         # Kept: entirely within study period
        4         | 2020-10-01| 2021-03-01| 1124300         # Kept: starts in study period (END_DATE nulled)
        5         | 2021-01-01| 2021-06-01| 1124300         # Excluded: starts after study period
        ```

        After applying DateFilter(2020-01-01 to 2020-12-31):
        ```
        PERSON_ID | START_DATE | END_DATE   | DRUG_CONCEPT_ID
        ----------|------------|------------|----------------
        2         | 2020-01-01| 2020-03-01| 1124300         # START_DATE adjusted to study start
        3         | 2020-06-01| 2020-08-01| 1124300         # No changes needed
        4         | 2020-10-01| NULL      | 1124300         # END_DATE nulled (beyond study end)
        ```

        Example: Person Table (DATE_OF_DEATH)

        Input PERSON Table:
        ```
        PERSON_ID | BIRTH_DATE | DATE_OF_DEATH
        ----------|------------|---------------
        1         | 1985-03-15 | 2019-05-10   # Death before study: DATE_OF_DEATH nulled
        2         | 1970-08-22 | 2020-07-15   # Death during study: kept as-is
        3         | 1992-11-30 | 2021-04-20   # Death after study: DATE_OF_DEATH nulled
        4         | 1988-01-05 | NULL         # No death recorded: no change
        ```

        After applying DateFilter(2020-01-01 to 2020-12-31):
        ```
        PERSON_ID | BIRTH_DATE | DATE_OF_DEATH
        ----------|------------|---------------
        1         | 1985-03-15 | NULL
        2         | 1970-08-22 | 2020-07-15
        3         | 1992-11-30 | NULL
        4         | 1988-01-05 | NULL
        ```
    """

    def __init__(self, name: str, domain: str, date_filter: DateFilter):
        super(DataPeriodFilterNode, self).__init__(name=name)
        self.domain = domain
        self.date_filter = date_filter

        # Validate that column_name is EVENT_DATE if specified
        if (
            self.date_filter.column_name is not None
            and self.date_filter.column_name != "EVENT_DATE"
        ):
            raise ValueError(
                f"DataPeriodFilterNode only supports filtering by EVENT_DATE column, but date_filter.column_name is '{self.date_filter.column_name}'. Use EVENT_DATE as the column_name in your DateFilter."
            )

    def _execute(self, tables: Dict[str, Table]) -> Table:
        table = tables[self.domain]
        columns = table.columns

        # 1. Filter rows that fall entirely outside data period
        # These need to be evaluated on the original table BEFORE mutations

        # 1a. Filter self.date_filter.column_name if it exists
        if self.date_filter.column_name in columns:
            table = self.date_filter.filter(table)

        # 1b. Check for exact column name matches (no substring matching)
        start_date_columns = [col for col in ["START_DATE"] if col in columns]
        end_date_columns = [col for col in ["END_DATE"] if col in columns]
        death_date_columns = [col for col in ["DATE_OF_DEATH"] if col in columns]

        # 1b. Filter ranges that fall entirely outside the data period:
        #   START_DATE fields that are strictly after max_date
        #   END_DATE fields that are strictly before min_date
        date_filters = [
            DateFilter(max_date=self.date_filter.max_value, column_name=col)
            for col in start_date_columns
        ]
        date_filters += [
            DateFilter(min_date=self.date_filter.min_value, column_name=col)
            for col in end_date_columns
        ]
        for date_filter in date_filters:
            table = date_filter.filter(table)

        # 2. Build mutations dictionary for column updates
        mutations = {}

        # 2a. Handle START_DATE fields - set to max(column_value, min_date)
        if start_date_columns and self.date_filter.min_value is not None:
            for col in start_date_columns:
                # Respect the operator from min_value
                if self.date_filter.min_value.operator == ">=":
                    # AfterOrOn: use min_value as-is
                    min_date_literal = ibis.literal(self.date_filter.min_value.value)
                elif self.date_filter.min_value.operator == ">":
                    # After: add one day to min_value to ensure start date is after, not on
                    min_date_literal = ibis.literal(
                        self.date_filter.min_value.value
                    ) + ibis.interval(days=1)
                else:
                    raise ValueError(
                        f"Unsupported min_value operator: {self.date_filter.min_value.operator}"
                    )

                mutations[col] = ibis.greatest(table[col], min_date_literal)

        # 2b. Handle END_DATE fields - set to NULL if outside max_date boundary
        if end_date_columns and self.date_filter.max_value is not None:
            for col in end_date_columns:
                # Respect the operator from max_value
                if self.date_filter.max_value.operator == "<=":
                    # BeforeOrOn: set to NULL if date > max_value
                    condition = table[col] > ibis.literal(
                        self.date_filter.max_value.value
                    )
                elif self.date_filter.max_value.operator == "<":
                    # Before: set to NULL if date >= max_value
                    condition = table[col] >= ibis.literal(
                        self.date_filter.max_value.value
                    )
                else:
                    raise ValueError(
                        f"Unsupported max_value operator: {self.date_filter.max_value.operator}"
                    )

                mutations[col] = (
                    ibis.case().when(condition, ibis.null()).else_(table[col]).end()
                )

        # 2c. Handle DATE_OF_DEATH fields - set to NULL if outside max_date boundary
        if death_date_columns and self.date_filter.max_value is not None:
            for col in death_date_columns:
                # Respect the operator from max_value
                if self.date_filter.max_value.operator == "<=":
                    # BeforeOrOn: set to NULL if date > max_value
                    condition = table[col] > ibis.literal(
                        self.date_filter.max_value.value
                    )
                elif self.date_filter.max_value.operator == "<":
                    # Before: set to NULL if date >= max_value
                    condition = table[col] >= ibis.literal(
                        self.date_filter.max_value.value
                    )
                else:
                    raise ValueError(
                        f"Unsupported max_value operator: {self.date_filter.max_value.operator}"
                    )

                mutations[col] = (
                    ibis.case().when(condition, ibis.null()).else_(table[col]).end()
                )

        # Apply all mutations if any exist
        if mutations:
            table = table.mutate(**mutations)

        return table
