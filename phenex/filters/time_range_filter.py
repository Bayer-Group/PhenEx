from typing import Union, List
from phenex.filters.filter import Filter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from ibis.expr.types.relations import Table
import ibis


class TimeRangeFilter(Filter):
    """
    TimeRangeFilter applies time range filtering to tables with START_DATE and END_DATE columns.
    This filter handles complex time range logic including clipping periods and including/excluding
    periods that cross time boundaries.

    Parameters:
        relative_time_range: A RelativeTimeRangeFilter or list of filters that define the time constraints
        include_clipped_periods: If True, includes time periods that partially overlap with the time range.
                               If False, excludes periods that cross the boundaries. Default is True.
        clip_periods: If True, clips (truncates) time periods to fit within the specified boundaries.
                     If False, includes/excludes entire periods without modification. Default is True.

    The behavior with different parameter combinations:
    - include_clipped_periods=True, clip_periods=True: Include periods that overlap, clip them to boundaries
    - include_clipped_periods=True, clip_periods=False: Include periods that overlap, keep original dates
    - include_clipped_periods=False, clip_periods=True: Exclude overlapping periods, clip remaining ones
    - include_clipped_periods=False, clip_periods=False: Exclude overlapping periods, keep original dates

    Examples:
        ```python
        # Include and clip periods that overlap with the time range
        filter1 = TimeRangeFilter(
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=index_phenotype,
                when='after',
                min_days=GreaterThanOrEqualTo(1),
                max_days=LessThanOrEqualTo(365)
            ),
            include_clipped_periods=True,
            clip_periods=True
        )

        # Exclude periods that cross boundaries, don't clip remaining ones
        filter2 = TimeRangeFilter(
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=index_phenotype,
                when='before',
                max_days=LessThan(0)
            ),
            include_clipped_periods=False,
            clip_periods=False
        )
        ```
    """

    def __init__(
        self,
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ],
        include_clipped_periods: bool = True,
        clip_periods: bool = True,
    ):
        super().__init__()
        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]

        self.relative_time_range = relative_time_range
        self.include_clipped_periods = include_clipped_periods
        self.clip_periods = clip_periods

    def _filter(self, table: Table) -> Table:
        """
        Apply time range filtering to the table based on START_DATE and END_DATE columns.
        """
        # Validate that table has required columns
        required_columns = ["PERSON_ID", "START_DATE", "END_DATE"]
        missing_columns = [col for col in required_columns if col not in table.columns]
        if missing_columns:
            raise ValueError(
                f"Table must have columns {required_columns}. Missing: {missing_columns}"
            )

        filtered_table = table

        # If no time range filters specified, return table as-is
        if self.relative_time_range is None:
            return filtered_table

        for rtr in self.relative_time_range:
            filtered_table = self._apply_single_time_range_filter(filtered_table, rtr)

        return filtered_table

    def _apply_single_time_range_filter(
        self, table: Table, rtr: RelativeTimeRangeFilter
    ) -> Table:
        """
        Apply a single RelativeTimeRangeFilter to the table.
        """
        from phenex.phenotypes.functions import attach_anchor_and_get_reference_date

        # Attach anchor phenotype data to get reference dates
        table, reference_column = attach_anchor_and_get_reference_date(
            table, rtr.anchor_phenotype
        )

        # Apply basic time direction filtering and clipping
        if rtr.when == "before":
            table = self._filter_before(table, reference_column)
        elif rtr.when == "after":
            table = self._filter_after(table, reference_column)
        else:
            raise ValueError(f"Unsupported 'when' value: {rtr.when}")

        # Apply min_days and max_days constraints
        if rtr.min_days is not None:
            table = self._apply_min_days_filter(
                table, reference_column, rtr.min_days, rtr.when
            )

        if rtr.max_days is not None:
            table = self._apply_max_days_filter(
                table, reference_column, rtr.max_days, rtr.when
            )

        return table

    def _filter_before(self, table: Table, reference_column) -> Table:
        """Apply 'before' filtering logic."""
        if self.include_clipped_periods:
            # Include time ranges that START before or on the anchor date
            # INCLUDING periods that contain the anchor date
            table = table.filter(table.START_DATE <= reference_column)

            if self.clip_periods:
                # Clip END_DATE to reference_column if it extends beyond
                table = table.mutate(
                    END_DATE=ibis.least(table.END_DATE, reference_column)
                )
        else:
            # Exclude periods that cross the boundary - only include periods that END before anchor
            table = table.filter(table.END_DATE < reference_column)

        return table

    def _filter_after(self, table: Table, reference_column) -> Table:
        """Apply 'after' filtering logic."""
        if self.include_clipped_periods:
            # Include time ranges that END on or after the anchor date
            # INCLUDING periods that contain the anchor date
            table = table.filter(table.END_DATE >= reference_column)

            if self.clip_periods:
                # Clip START_DATE to reference_column if it starts before
                table = table.mutate(
                    START_DATE=ibis.greatest(table.START_DATE, reference_column)
                )
        else:
            # Exclude periods that cross the boundary - only include periods that START after anchor
            table = table.filter(table.START_DATE > reference_column)

        return table

    def _apply_min_days_filter(
        self, table: Table, reference_column, min_days, when: str
    ) -> Table:
        """Apply min_days constraint."""
        if when == "before":
            # Calculate the min boundary date
            if min_days.operator == ">=":
                min_boundary_date = reference_column - ibis.interval(
                    days=min_days.value
                )
            elif min_days.operator == ">":
                min_boundary_date = reference_column - ibis.interval(
                    days=min_days.value + 1
                )
            else:
                raise ValueError(f"Unsupported min_days operator: {min_days.operator}")

            if self.include_clipped_periods:
                # Include periods that overlap with the min boundary
                table = table.filter(table.START_DATE <= min_boundary_date)

                if self.clip_periods:
                    # Clip END_DATE to boundary if it extends beyond
                    table = table.mutate(
                        END_DATE=ibis.least(table.END_DATE, min_boundary_date)
                    )
            else:
                # Exclude periods that cross the boundary
                table = table.filter(table.END_DATE <= min_boundary_date)

        elif when == "after":
            # Calculate the min boundary date
            if min_days.operator == ">=":
                min_boundary_date = reference_column + ibis.interval(
                    days=min_days.value
                )
            elif min_days.operator == ">":
                min_boundary_date = reference_column + ibis.interval(
                    days=min_days.value + 1
                )
            else:
                raise ValueError(f"Unsupported min_days operator: {min_days.operator}")

            if self.include_clipped_periods:
                # Include periods that overlap with the min boundary
                table = table.filter(table.END_DATE >= min_boundary_date)

                if self.clip_periods:
                    # Clip START_DATE to boundary if it starts before
                    table = table.mutate(
                        START_DATE=ibis.greatest(table.START_DATE, min_boundary_date)
                    )
            else:
                # Exclude periods that cross the boundary
                table = table.filter(table.START_DATE >= min_boundary_date)

        return table

    def _apply_max_days_filter(
        self, table: Table, reference_column, max_days, when: str
    ) -> Table:
        """Apply max_days constraint."""
        if when == "before":
            # Calculate the max boundary date
            if max_days.operator == "<=":
                max_boundary_date = reference_column - ibis.interval(
                    days=max_days.value
                )
            elif max_days.operator == "<":
                max_boundary_date = reference_column - ibis.interval(
                    days=max_days.value - 1
                )
            else:
                raise ValueError(f"Unsupported max_days operator: {max_days.operator}")

            if self.include_clipped_periods:
                # Include periods that overlap with the max boundary
                table = table.filter(table.END_DATE >= max_boundary_date)

                if self.clip_periods:
                    # Clip START_DATE to boundary if it starts before
                    table = table.mutate(
                        START_DATE=ibis.greatest(table.START_DATE, max_boundary_date)
                    )
            else:
                # Exclude periods that cross the boundary
                table = table.filter(table.START_DATE >= max_boundary_date)

        elif when == "after":
            # Calculate the max boundary date
            if max_days.operator == "<=":
                max_boundary_date = reference_column + ibis.interval(
                    days=max_days.value
                )
            elif max_days.operator == "<":
                max_boundary_date = reference_column + ibis.interval(
                    days=max_days.value - 1
                )
            else:
                raise ValueError(f"Unsupported max_days operator: {max_days.operator}")

            if self.include_clipped_periods:
                # Include periods that overlap with the max boundary
                table = table.filter(table.START_DATE <= max_boundary_date)

                if self.clip_periods:
                    # Clip END_DATE to boundary if it extends beyond
                    table = table.mutate(
                        END_DATE=ibis.least(table.END_DATE, max_boundary_date)
                    )
            else:
                # Exclude periods that cross the boundary
                table = table.filter(table.END_DATE <= max_boundary_date)

        return table
