from datetime import date
from ibis.expr.types.relations import Table
import ibis
from phenex.util.serialization.to_dict import to_dict


class VerticalDateAggregator:
    """
    Base class for aggregating events by selecting rows with specific dates (first, last, nearest) within groups.

    This aggregator works by applying window functions to find the min/max date within each partition,
    then filtering to keep only rows that match that aggregated date. Useful for selecting the first or
    last event per patient, or the nearest event to a reference date.

    Attributes:
        aggregation_index (List[str]): Column names to group by. Default is ["PERSON_ID"].
        aggregation_function (str): The aggregation function to apply. Options are "min" (first) or "max" (last/nearest).
        event_date_column (str): The name of the date column to aggregate on. Default is "EVENT_DATE".
        reduce (bool): If True, returns distinct rows with only index and date columns, setting VALUE to NULL. Default is False.
        preserve_nulls (bool): If True, preserves rows where all dates in a partition are NULL. Default is False.

    Methods:
        aggregate(input_table: Table) -> Table:
            Applies the date aggregation to the input table.
            Parameters:
                input_table (Table): The table containing events to be aggregated.
            Returns:
                Table: The aggregated table with rows matching the selected date(s).

    Examples:
        ```python
        # Example 1: Get first event per patient
        first_aggregator = VerticalDateAggregator(
            aggregation_function="min",
            aggregation_index=["PERSON_ID"]
        )
        first_events = first_aggregator.aggregate(events_table)
        ```

        ```python
        # Example 2: Get last event per patient with reduction
        last_aggregator = VerticalDateAggregator(
            aggregation_function="max",
            aggregation_index=["PERSON_ID"],
            reduce=True
        )
        last_events = last_aggregator.aggregate(events_table)
        ```

        ```python
        # Example 3: Get first event per patient per day
        first_daily = VerticalDateAggregator(
            aggregation_function="min",
            aggregation_index=["PERSON_ID", "EVENT_DATE"]
        )
        first_daily_events = first_daily.aggregate(events_table)
        ```

        ```python
        # Example 4: Using convenience class First
        from phenex.aggregators import First
        first = First(reduce=True)
        first_events = first.aggregate(events_table)
        ```
    """

    def __init__(
        self,
        aggregation_index=["PERSON_ID"],
        aggregation_function="sum",
        event_date_column="EVENT_DATE",
        reduce=False,
        preserve_nulls=False,
    ):
        self.aggregation_index = aggregation_index
        self.aggregation_function = aggregation_function
        self.event_date_column = event_date_column
        self.reduce = reduce
        self.preserve_nulls = preserve_nulls

    def aggregate(self, input_table: Table):
        # Define the window specification
        partition_cols = [
            getattr(input_table, col) if isinstance(col, str) else col
            for col in self.aggregation_index
        ]
        window_spec = ibis.window(
            group_by=partition_cols, order_by=input_table[self.event_date_column]
        )

        # Apply the specified aggregation function to the event_date_column
        event_date_col = getattr(input_table, self.event_date_column)
        if self.aggregation_function == "max":
            aggregated_date = event_date_col.max().over(window_spec)
        elif self.aggregation_function == "min":
            aggregated_date = event_date_col.min().over(window_spec)
        else:
            raise ValueError(
                f"Unsupported aggregation function: {self.aggregation_function}"
            )

        # Handle case where all dates in a partition are null
        # In this case, max/min will return null, which is the correct behavior

        # Add the aggregated date as a new column
        input_table = input_table.mutate(aggregated_date=aggregated_date)

        # Filter rows where the original date matches the aggregated date
        date_match = input_table[self.event_date_column] == input_table.aggregated_date

        if self.preserve_nulls:
            # Handle null dates explicitly to avoid dropping them
            both_null = (
                input_table[self.event_date_column].isnull()
                & input_table.aggregated_date.isnull()
            )
            input_table = input_table.filter(date_match | both_null)
        else:
            # Original behavior - nulls will be dropped
            input_table = input_table.filter(date_match)

        # Drop the temporary aggregated_date column
        input_table = input_table.drop("aggregated_date")

        # Apply the distinct reduction if required
        if self.reduce:
            selected_columns = self.aggregation_index + [self.event_date_column]
            input_table = input_table.select(selected_columns).distinct()
            input_table = input_table.mutate(VALUE=ibis.null().cast("int32"))

        return input_table

    def to_dict(self):
        return to_dict(self)


class Nearest(VerticalDateAggregator):
    """
    Aggregator that selects the nearest (most recent) event date within each group.

    This is an alias for Last, using max aggregation function to find the latest date.
    Commonly used to find the most recent event before or at a reference date.
    """

    def __init__(self, **kwargs):
        super().__init__(aggregation_function="max", **kwargs)


class First(VerticalDateAggregator):
    """
    Aggregator that selects the first (earliest) event date within each group.

    Uses min aggregation function to find the earliest date. Commonly used to find
    the first occurrence of an event per patient.
    """

    def __init__(self, **kwargs):
        super().__init__(aggregation_function="min", **kwargs)


class Last(VerticalDateAggregator):
    """
    Aggregator that selects the last (most recent) event date within each group.

    Uses max aggregation function to find the latest date. Commonly used to find
    the most recent occurrence of an event per patient.
    """

    def __init__(self, **kwargs):
        super().__init__(aggregation_function="max", **kwargs)


class ValueAggregator:
    """
    Base class for aggregating numeric values within groups using statistical functions.

    This aggregator applies window or group-by aggregation functions (min, max, mean, median)
    to numeric values. Can be used to compute statistics per patient or per patient-date combinations.
    For min/max with reduce=True, returns all dates where the min/max value occurs.

    Attributes:
        aggregation_column (Optional[str]): The column name to aggregate. If None, uses "VALUE" column. Default is None.
        aggregation_function (str): The aggregation function to apply. Options are "min", "max", "mean", "median",
            "daily_min", "daily_max", "daily_mean", "daily_median". Default is "min".
        aggregation_index (List[str]): Column names to group by. Default is ["PERSON_ID"].
        reduce (bool): If True, returns distinct aggregated values. For mean/median, sets EVENT_DATE to NULL.
            For min/max, returns all dates where min/max occurs. Default is True.

    Methods:
        aggregate(input_table: Table) -> Table:
            Applies the value aggregation to the input table.
            Parameters:
                input_table (Table): The table containing values to be aggregated.
            Returns:
                Table: The aggregated table with computed statistics.

    Examples:
        ```python
        # Example 1: Get minimum value per patient
        min_aggregator = ValueAggregator(
            aggregation_function="min",
            aggregation_index=["PERSON_ID"]
        )
        min_values = min_aggregator.aggregate(measurements_table)
        ```

        ```python
        # Example 2: Get mean value per patient (date becomes NULL)
        mean_aggregator = ValueAggregator(
            aggregation_function="mean",
            aggregation_index=["PERSON_ID"]
        )
        mean_values = mean_aggregator.aggregate(measurements_table)
        ```

        ```python
        # Example 3: Get maximum value per patient with all dates where max occurs
        max_aggregator = ValueAggregator(
            aggregation_function="max",
            aggregation_index=["PERSON_ID"],
            reduce=True
        )
        max_values = max_aggregator.aggregate(measurements_table)
        ```

        ```python
        # Example 4: Using convenience class Mean
        from phenex.aggregators import Mean
        mean = Mean()
        mean_values = mean.aggregate(measurements_table)
        ```

        ```python
        # Example 5: Daily mean per patient
        from phenex.aggregators import DailyMean
        daily_mean = DailyMean()
        daily_means = daily_mean.aggregate(measurements_table)
        ```
    """

    def __init__(
        self,
        aggregation_column=None,
        aggregation_function="min",
        aggregation_index=["PERSON_ID"],
        reduce=True,
    ):
        # allowed values for aggregation_function are any valid aggregation
        # function in SQL (except some make no sense for date, e.g variance)
        self.aggregation_column = aggregation_column
        self.aggregation_function = aggregation_function
        self.aggregation_index = aggregation_index
        self.reduce = reduce
        # if true, max one row per unique combination of index columns
        # otherwise, row count is preserved

    def aggregate(self, input_table: Table):
        # Get the aggregation index columns
        _aggregation_index_cols = [
            getattr(input_table, col) for col in self.aggregation_index
        ]

        # Determine the aggregation column
        if self.aggregation_column is None:
            _aggregation_column = input_table.VALUE
        else:
            _aggregation_column = getattr(input_table, self.aggregation_column)

        ibis.options.interactive = True
        # Define the window specification
        window_spec = ibis.window(group_by=_aggregation_index_cols)

        # Function to apply based on aggregation_function
        if self.aggregation_function in ["median", "daily_median"]:
            aggregation = _aggregation_column.median().over(window_spec)
        elif self.aggregation_function in ["mean", "daily_mean"]:
            aggregation = _aggregation_column.mean().over(window_spec)
        elif self.aggregation_function in ["max", "daily_max"]:
            aggregation = _aggregation_column.max().over(window_spec)
        elif self.aggregation_function in ["min", "daily_min"]:
            aggregation = _aggregation_column.min().over(window_spec)
        else:
            raise ValueError(
                f"Unsupported aggregation function: {self.aggregation_function}"
            )
        # Select the necessary columns
        selected_columns = _aggregation_index_cols + [aggregation.name("VALUE")]

        # Handle min/max separately; we need to rejoin with original data to receive all dates the min/max occurs
        # notice; min/max may not return one row per patient
        if self.aggregation_function in ["max", "min"] and self.reduce:
            # Join back with original table to get the date
            aggregated_table = input_table.select(selected_columns).distinct()

            original_with_date = input_table.select(
                _aggregation_index_cols + [_aggregation_column, "EVENT_DATE"]
            )
            input_table = (
                aggregated_table.join(
                    original_with_date,
                    predicates=[
                        *[
                            agg_col == orig_col
                            for agg_col, orig_col in zip(
                                _aggregation_index_cols, _aggregation_index_cols
                            )
                        ],
                        aggregated_table.VALUE == _aggregation_column,
                    ],
                )
                .select(_aggregation_index_cols + ["VALUE", "EVENT_DATE"])
                .distinct()
            )
            return input_table

        # Apply the distinct reduction if required
        if self.reduce:
            input_table = input_table.select(selected_columns).distinct()

            # fill event date with nulls if not forcing return date, as dates are nonsensical
            if self.aggregation_function in ["mean", "median"]:
                from datetime import date

                input_table = input_table.mutate(EVENT_DATE=ibis.null(date))
            return input_table
        else:
            return input_table.select(selected_columns)

    def to_dict(self):
        return to_dict(self)


class Mean(ValueAggregator):
    """
    Aggregator that computes the mean (average) value within each group.

    Returns one row per group with the mean value. EVENT_DATE is set to NULL since
    the mean doesn't correspond to a specific date.
    """

    def __init__(self, **kwargs):
        super(Mean, self).__init__(aggregation_function="mean", **kwargs)


class Median(ValueAggregator):
    """
    Aggregator that computes the median value within each group.

    Returns one row per group with the median value. EVENT_DATE is set to NULL since
    the median doesn't correspond to a specific date.
    """

    def __init__(self, **kwargs):
        super(Median, self).__init__(aggregation_function="median", **kwargs)


class Max(ValueAggregator):
    """
    Aggregator that finds the maximum value within each group.

    When reduce=True, returns all dates where the maximum value occurs (may be multiple dates).
    When reduce=False, adds the max value to all rows in the group.
    """

    def __init__(self, **kwargs):
        super(Max, self).__init__(aggregation_function="max", **kwargs)


class Min(ValueAggregator):
    """
    Aggregator that finds the minimum value within each group.

    When reduce=True, returns all dates where the minimum value occurs (may be multiple dates).
    When reduce=False, adds the min value to all rows in the group.
    """

    def __init__(self, **kwargs):
        super(Min, self).__init__(aggregation_function="min", **kwargs)


class DailyValueAggregator(ValueAggregator):
    """
    Base class for aggregating values on a daily basis (per patient per date).

    Extends ValueAggregator with aggregation_index set to ["PERSON_ID", "EVENT_DATE"],
    allowing aggregation of multiple values within the same day for each patient.
    Useful for handling multiple measurements per day.
    """

    def __init__(self, aggregation_index=["PERSON_ID", "EVENT_DATE"], **kwargs):
        super(DailyValueAggregator, self).__init__(
            aggregation_index=aggregation_index, **kwargs
        )


class DailyMean(DailyValueAggregator):
    """
    Aggregator that computes the daily mean value per patient.

    Groups by PERSON_ID and EVENT_DATE to compute the average of all values on each day.
    Useful when a patient has multiple measurements on the same day and you want the daily average.
    """

    def __init__(self, **kwargs):
        super(DailyMean, self).__init__(aggregation_function="daily_mean", **kwargs)


class DailyMedian(DailyValueAggregator):
    """
    Aggregator that computes the daily median value per patient.

    Groups by PERSON_ID and EVENT_DATE to compute the median of all values on each day.
    Useful when a patient has multiple measurements on the same day and you want the daily median.
    """

    def __init__(self, **kwargs):
        super(DailyMedian, self).__init__(aggregation_function="daily_median", **kwargs)


class DailyMax(DailyValueAggregator):
    """
    Aggregator that finds the daily maximum value per patient.

    Groups by PERSON_ID and EVENT_DATE to find the highest value on each day.
    Useful when a patient has multiple measurements on the same day and you want the daily maximum.
    """

    def __init__(self, **kwargs):
        super(DailyMax, self).__init__(aggregation_function="daily_max", **kwargs)


class DailyMin(DailyValueAggregator):
    """
    Aggregator that finds the daily minimum value per patient.

    Groups by PERSON_ID and EVENT_DATE to find the lowest value on each day.
    Useful when a patient has multiple measurements on the same day and you want the daily minimum.
    """

    def __init__(self, **kwargs):
        super(DailyMin, self).__init__(aggregation_function="daily_min", **kwargs)
