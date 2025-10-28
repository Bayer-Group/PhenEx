from datetime import date
from ibis.expr.types.relations import Table
import ibis
from phenex.util.serialization.to_dict import to_dict


class VerticalDateAggregator:
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

        # Select the necessary columns

        # Apply the distinct reduction if required
        if self.reduce:
            selected_columns = self.aggregation_index + [self.event_date_column]
            input_table = input_table.select(selected_columns).distinct()
            input_table = input_table.mutate(VALUE=ibis.null().cast("int32"))

        return input_table

    def to_dict(self):
        return to_dict(self)


class Nearest(VerticalDateAggregator):
    def __init__(self, **kwargs):
        super().__init__(aggregation_function="max", **kwargs)


class First(VerticalDateAggregator):
    def __init__(self, **kwargs):
        super().__init__(aggregation_function="min", **kwargs)


class Last(VerticalDateAggregator):
    def __init__(self, **kwargs):
        super().__init__(aggregation_function="max", **kwargs)


class ValueAggregator:
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
                input_table = input_table.mutate(EVENT_DATE=ibis.null().cast("int32"))
            return input_table
        else:
            return input_table.select(selected_columns)

    def to_dict(self):
        return to_dict(self)


class Mean(ValueAggregator):
    def __init__(self, **kwargs):
        super(Mean, self).__init__(aggregation_function="mean", **kwargs)


class Median(ValueAggregator):
    def __init__(self, **kwargs):
        super(Median, self).__init__(aggregation_function="median", **kwargs)


class Max(ValueAggregator):
    def __init__(self, **kwargs):
        super(Max, self).__init__(aggregation_function="max", **kwargs)


class Min(ValueAggregator):
    def __init__(self, **kwargs):
        super(Min, self).__init__(aggregation_function="min", **kwargs)


class DailyValueAggregator(ValueAggregator):
    def __init__(self, aggregation_index=["PERSON_ID", "EVENT_DATE"], **kwargs):
        super(DailyValueAggregator, self).__init__(
            aggregation_index=aggregation_index, **kwargs
        )


class DailyMean(DailyValueAggregator):
    def __init__(self, **kwargs):
        super(DailyMean, self).__init__(aggregation_function="daily_mean", **kwargs)


class DailyMedian(DailyValueAggregator):
    def __init__(self, **kwargs):
        super(DailyMedian, self).__init__(aggregation_function="daily_median", **kwargs)


class DailyMax(DailyValueAggregator):
    def __init__(self, **kwargs):
        super(DailyMax, self).__init__(aggregation_function="daily_max", **kwargs)


class DailyMin(DailyValueAggregator):
    def __init__(self, **kwargs):
        super(DailyMin, self).__init__(aggregation_function="daily_min", **kwargs)
