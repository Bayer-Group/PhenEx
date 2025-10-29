from typing import Union, List, Optional, Dict
from datetime import date
from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import (
    ValueFilter,
    DateFilter,
    RelativeTimeRangeFilter,
    TimeRangeFilter,
)
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import (
    select_phenotype_columns,
)
from ibis.expr.types.relations import Table
from ibis import _
import ibis


class TimeRangeCountPhenotype(Phenotype):
    """
    TimeRangeCountPhenotype works with time range tables i.e. the input table must have a START_DATE and END_DATE column (in addition to PERSON_ID). It counts the number of distinct time ranges for each person, either total or within a specified date range (relative or absolute). If no relative_time_range defined, it returns the number of time periods per person. If relative_time_range is defined, it counts the number of time periods before or after (depending on when keyword argument of relative_time_range), NOT including the time period defined by the relative_time_range anchor.

    If min_days or max_days of the relative_time_range are defined, the entire time period must be included in the relative time range i.e. if before, the start date of all time periods must be contained within the time range.

    This can be used :
    - given an admission discharge table, to count the number of hospitalizations that occurred e.g. in the post index period
    - given a drug exposure table, to count the number of times a person has taken a medication

    DATE: Date is always null
    VALUE: Number of distinct time periods in the specified time range.

    Parameters:
        domain: The domain of the phenotype.
        name: The name of the phenotype. Optional. If not passed the name will be TimeRangeCountPhenotype.
        relative_time_range: A relative time range filter or a list of filters to apply.
        value_filter: Filter persons by number of time ranges determined
        allow_null_end_date: If True, allows time ranges with null END_DATE (ongoing periods). If False, removes such rows. Default is True.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Examples:

    Example: Count hospitalizations in post-index period (OMOP)
        ```python
        from phenex.phenotypes import CodelistPhenotype, TimeRangeCountPhenotype
        from phenex.filters import RelativeTimeRangeFilter
        from phenex.filters.value import GreaterThanOrEqualTo, LessThanOrEqualTo

        # Define entry phenotype (index date)
        entry_phenotype = CodelistPhenotype(
            domain='CONDITION_OCCURRENCE',
            codelist=atrial_fibrillation_codes,
            return_date='first',
        )

        # Count hospitalizations in the 365 days after index
        post_index_hospitalizations = TimeRangeCountPhenotype(
            domain='VISIT_OCCURRENCE',  # or admission-discharge table
            relative_time_range=RelativeTimeRangeFilter(
                anchor_phenotype=entry_phenotype,
                when='after',
                min_days=GreaterThanOrEqualTo(1),
                max_days=LessThanOrEqualTo(365)
            ),
            value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(1))  # At least 1 hospitalization
        )

        result = post_index_hospitalizations.execute(tables)
        ```
    """

    def __init__(
        self,
        domain: str,
        name: Optional[str] = None,
        date_range: DateFilter = None,  # TODO implement date_range
        relative_time_range: Union[
            RelativeTimeRangeFilter, List[RelativeTimeRangeFilter]
        ] = None,
        value_filter: Optional[ValueFilter] = None,
        allow_null_end_date: bool = True,
        **kwargs,
    ):
        if name is None:
            name = "TimeRangeCountPhenotype"
        super(TimeRangeCountPhenotype, self).__init__(name=name, **kwargs)

        self.date_range = date_range
        self.value_filter = value_filter
        self.domain = domain
        self.allow_null_end_date = allow_null_end_date
        if isinstance(relative_time_range, RelativeTimeRangeFilter):
            relative_time_range = [relative_time_range]

        self.relative_time_range = relative_time_range
        if self.relative_time_range is not None:
            for rtr in self.relative_time_range:
                if rtr.anchor_phenotype is not None:
                    self.add_children(rtr.anchor_phenotype)

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        table = tables[self.domain]

        # Filter out null values in START_DATE and END_DATE based on allow_null_end_date setting
        # Always remove rows with null START_DATE
        table = table.filter(table.START_DATE.notnull())

        # Remove rows with null END_DATE only if allow_null_end_date is False
        if not self.allow_null_end_date:
            table = table.filter(table.END_DATE.notnull())

        # Apply time filtering first if we have relative time ranges
        if self.relative_time_range is not None:
            time_filter = TimeRangeFilter(
                relative_time_range=self.relative_time_range,
                include_clipped_periods=False,  # Exclude periods that cross boundaries
                clip_periods=False,
            )
            table = time_filter.filter(table)

        # Count distinct time ranges per person
        # Each row represents a distinct time range (START_DATE, END_DATE combination)
        count_table = table.select(["PERSON_ID", "START_DATE", "END_DATE"]).distinct()
        count_table = count_table.group_by("PERSON_ID").aggregate(VALUE=_.count())

        # Apply value filtering if specified
        if self.value_filter is not None:
            count_table = self.value_filter.filter(count_table)

        # Create the final phenotype table with DATE as null (as specified in docstring)
        result_table = count_table.mutate(EVENT_DATE=ibis.null(date), BOOLEAN=True)

        # Select only the required phenotype columns
        result_table = select_phenotype_columns(result_table)

        # if persons table exist, join to get the persons with 0 time ranges
        if "PERSON" in tables.keys():
            table_persons = tables["PERSON"].select("PERSON_ID").distinct()
            result_table = table_persons.join(
                result_table,
                table_persons.PERSON_ID == result_table.PERSON_ID,
                how="left",
            ).drop("PERSON_ID_right")
            # fill null VALUES with 0 for persons with no time ranges
            result_table = result_table.mutate(VALUE=result_table.VALUE.fillna(0))
        return self._perform_final_processing(result_table)
