from typing import Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
from phenex.phenotypes.time_range_phenotype import TimeRangePhenotype
from phenex.filters.date_filter import ValueFilter
from phenex.tables import PhenotypeTable
from phenex.phenotypes.functions import attach_anchor_and_get_reference_date
import ibis
from ibis import _
from ibis.expr.types.relations import Table


class TimeRangeDaysToNextRange(TimeRangePhenotype):
    """
    TimeRangeDaysToNextRange identifies the time range that contains the anchor phenotype,
    then finds the next consecutive time range and counts the days difference between
    the anchored end date and the start date of that following time range.

    The returned Phenotype has the following interpretation:
    EVENT_DATE: The start date of the next consecutive time range.
    VALUE: Days difference between the end of anchored time range and start of next time range.
    """

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]
        # 1. Identify anchored range
        anchored_table, reference_column = attach_anchor_and_get_reference_date(
            table, self.relative_time_range
        )

        # Filter for ranges containing the anchor
        # And ensure END_DATE is not null because we need a gap after it.
        # Assumption: No overlapping coverage periods.
        anchored_table = anchored_table.filter(
            (anchored_table.START_DATE <= reference_column)
            & (reference_column <= anchored_table.END_DATE)
            & (anchored_table.END_DATE.notnull())
        )

        # 2. Get next ranges
        next_table = tables[self.domain]
        # Rename columns to avoid collision and identify next range columns
        next_table = next_table.rename(
            NEXT_START_DATE="START_DATE", NEXT_END_DATE="END_DATE"
        )

        # Join anchored_table with next_table on PERSON_ID
        joined = anchored_table.join(next_table, "PERSON_ID")

        # 3. Filter for time_range after anchored time_range
        # joined.END_DATE is from anchored. joined.NEXT_START_DATE is from candidate.
        joined = joined.filter(joined.NEXT_START_DATE > joined.END_DATE)

        # 4. Count days difference
        VALUE = joined.NEXT_START_DATE.delta(joined.END_DATE, "day")
        joined = joined.mutate(VALUE=VALUE)

        # 5. Remove all time_ranges except that next consecutive time_range (min value/gap)
        # We find the min VALUE for each anchor range (identified by PERSON_ID and END_DATE)
        joined = joined.group_by(["PERSON_ID", "END_DATE"]).mutate(min_val=_.VALUE.min())
        joined = joined.filter(joined.VALUE == joined.min_val).drop("min_val")

        # Set EVENT_DATE to start of next range
        joined = joined.mutate(EVENT_DATE=joined.NEXT_START_DATE)

        if self.relative_time_range is not None:
            value_filter = ValueFilter(
                min_value=self.relative_time_range.min_days,
                max_value=self.relative_time_range.max_days,
                column_name="VALUE",
            )
            ibis.options.interactive = True
            joined = value_filter.filter(joined)

        return self._perform_final_processing(joined)
