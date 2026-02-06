from typing import Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import ValueFilter, RelativeTimeRangeFilter
from phenex.tables import PhenotypeTable
from phenex.phenotypes.functions import attach_anchor_and_get_reference_date
import ibis
from ibis import _
from ibis.expr.types.relations import Table


class TimeRangeDaysToNextRange(Phenotype):
    """
    TimeRangeDaysToNextRange identifies the time range that contains the anchor phenotype,
    then finds the adjacent time range (next or previous) and counts the days difference between them.

    If relative_time_range.when is 'after' (default):
        Finds the next consecutive time range.
        VALUE: Days difference between the end of anchored time range and start of next time range.
        EVENT_DATE: The start date of the next consecutive time range.

    If relative_time_range.when is 'before':
        Finds the previous consecutive time range.
        VALUE: Days difference between the start of the anchored time range and the end of the previous time range.
        EVENT_DATE: The end date of the previous consecutive time range.


    Example: Count number days to next hospitalization after index date hospitalization
        ```python
        from phenex.phenotypes import TimeRangeDaysToNextRange
        from phenex.filters import RelativeTimeRangeFilter
        # the hospitalization domain contains START_DATE and END_DATE columns for hospital admission and hospital discharge dates
        ttnh = TimeRangeDaysToNextRange(
            name="time_to_next_readmission",
            domain="HOSPITALIZATION",
            relative_time_range = RelativeTimeRangeFilter(when='after') # uses index date as anchor by default; must be used as in a cohort
        )
        ```
    """

    output_display_type = "value"

    def __init__(
        self,
        domain: str,
        name: Optional[str] = None,
        relative_time_range: Optional[RelativeTimeRangeFilter] = None,
        value_filter: Optional[ValueFilter] = None,
        **kwargs
    ):
        super().__init__(name=name, **kwargs)
        self.domain = domain
        self.relative_time_range = relative_time_range
        self.value_filter = value_filter

        if self.relative_time_range is not None:
            if self.relative_time_range.anchor_phenotype is not None:
                self.add_children(self.relative_time_range.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]
        anchor_phenotype = None
        when = "after"

        if self.relative_time_range:
            anchor_phenotype = self.relative_time_range.anchor_phenotype
            if self.relative_time_range.when:
                when = self.relative_time_range.when

        # 1. Identify anchored range
        # attach_anchor_and_get_reference_date handles default to INDEX_DATE if anchor_phenotype is None
        anchored_table, reference_column = attach_anchor_and_get_reference_date(
            table, anchor_phenotype
        )

        # Filter for ranges containing the anchor
        # Ensure END_DATE and START_DATE are not null for gap calculation
        anchored_table = anchored_table.filter(
            (anchored_table.START_DATE <= reference_column)
            & (reference_column <= anchored_table.END_DATE)
            & (anchored_table.END_DATE.notnull())
            & (anchored_table.START_DATE.notnull())
        )

        # 2. Get neighbor ranges
        neighbor_table = tables[self.domain]
        neighbor_table = neighbor_table.filter(neighbor_table.START_DATE.notnull())
        # Rename columns to avoid collision
        neighbor_table = neighbor_table.rename(
            NEIGHBOR_START_DATE="START_DATE", NEIGHBOR_END_DATE="END_DATE"
        )

        # Join anchored_table with neighbor_table on PERSON_ID
        joined = anchored_table.join(neighbor_table, "PERSON_ID")

        # 3. Filter and Calculate Gap based on 'when'
        if when == "before":
            # Looking for range BEFORE anchored range
            # neighbor_end < current_start
            joined = joined.filter(joined.NEIGHBOR_END_DATE < joined.START_DATE)
            VALUE = joined.START_DATE.delta(joined.NEIGHBOR_END_DATE, "day")
            EVENT_DATE = joined.NEIGHBOR_END_DATE
            group_key = "START_DATE"
        else:  # when == 'after'
            # Looking for range AFTER anchored range
            # neighbor_start > current_end
            joined = joined.filter(joined.NEIGHBOR_START_DATE > joined.END_DATE)
            VALUE = joined.NEIGHBOR_START_DATE.delta(joined.END_DATE, "day")
            EVENT_DATE = joined.NEIGHBOR_START_DATE
            group_key = "END_DATE"

        joined = joined.mutate(VALUE=VALUE, EVENT_DATE=EVENT_DATE)

        # 4. Remove all time_ranges except the closest one (min value/gap)
        # We find the min VALUE for each anchor range
        joined = joined.group_by(["PERSON_ID", group_key]).mutate(min_val=_.VALUE.min())
        joined = joined.filter(joined.VALUE == joined.min_val).drop("min_val")

        # 5. Apply Value Filter
        if self.value_filter is not None:
            joined = self.value_filter.filter(joined)

        return self._perform_final_processing(joined)
