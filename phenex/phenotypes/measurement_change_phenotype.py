from typing import Optional
from phenex.phenotypes import MeasurementPhenotype, Phenotype
from phenex.filters.value import Value, GreaterThanOrEqualTo
from phenex.filters.value_filter import ValueFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.tables import PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from ibis import _


class MeasurementChangePhenotype(Phenotype):
    """
    MeasurementChangePhenotype looks for changes in the value of a measurement within a certain time period.

    Parameters:
        name: The name of the phenotype.
        phenotype: The measurement phenotype to look for changes.
        min_change: The minimum change in the measurement value to look for.
        max_days_apart: The maximum number of days between the measurements.
        return_date: Specifies whether to return the 'first' or 'second' event date. Default is 'second'.

    Example:
        ```python
        hemoglobin = MeasurementPhenotype(
            name='hemoglobin_drop',
            codelist=hb_codes,
            domain='observation',
            relative_time_range=ONEYEAR_PREINDEX,
        )

        hemoglobin_drop = MeasurementChangePhenotype(
            phenotype=hemoglobin,
            min_change=GreaterThanOrEqualTo(2),
            max_days_apart=LessThanOrEqualTo(2),
            return_date='second'
        )
        ```
    """

    def __init__(
        self,
        name: str,
        phenotype: MeasurementPhenotype,
        min_change: Value = None,
        max_change: Value = None,
        min_days_between: Value = GreaterThanOrEqualTo(0),
        max_days_between: Value = None,
        relative_time_range: RelativeTimeRangeFilter = None,
        return_date="second",
    ):
        self.name = name
        self.phenotype = phenotype
        self.min_change = min_change
        self.max_change = max_change
        self.min_days_between = min_days_between
        self.max_days_between = max_days_between
        self.return_date = return_date
        self.relative_time_range = relative_time_range
        self.children = [phenotype]
        super(Phenotype, self).__init__()

    def _execute(self, tables) -> PhenotypeTable:
        # Execute the child phenotype to get the initial filtered table
        phenotype_table_1 = self.phenotype.table
        phenotype_table_2 = self.phenotype.table.view()

        # Create a self-join to compare each measurement with every other measurement
        import ibis
        ibis.options.interactive = True     
        joined_table = phenotype_table_1.join(
            phenotype_table_2, 
            [
                phenotype_table_1.PERSON_ID == phenotype_table_2.PERSON_ID,
                (phenotype_table_1.EVENT_DATE != phenotype_table_2.EVENT_DATE) | (phenotype_table_1.VALUE != phenotype_table_2.VALUE),
            ],
            lname='{name}_1',
            rname='{name}_2'
        ).filter(_.EVENT_DATE_1 <= _.EVENT_DATE_2)

        # Calculate the change in value and the days apart
        days_between = joined_table.EVENT_DATE_2.delta(joined_table.EVENT_DATE_1, "day")
        value_change = joined_table.VALUE_2 - joined_table.VALUE_1
        joined_table = joined_table.mutate(
            VALUE_CHANGE=value_change,
            DAYS_BETWEEN=days_between
        )

        # Filter to keep only those with at least min_change and within max_days_apart
        value_filter = ValueFilter(min=self.min_change, max=self.max_change, column_name='VALUE_CHANGE')
        filtered_table = value_filter.filter(joined_table)

        time_filter = ValueFilter(min=self.min_days_between, max=self.max_days_between, column_name='DAYS_BETWEEN')
        filtered_table =  time_filter.filter(filtered_table)

        # Determine the return date based on the return_date attribute
        if self.return_date == "first":
            filtered_table = filtered_table.mutate(
                EVENT_DATE=filtered_table.EVENT_DATE_1,
            )
        elif self.return_date == "second":
            filtered_table = filtered_table.mutate(
                EVENT_DATE=filtered_table.EVENT_DATE_2,
            )

        # Select the required columns
        filtered_table = filtered_table.mutate(
            PERSON_ID='PERSON_ID_1',
            VALUE='VALUE_CHANGE',
            BOOLEAN=True            
        )   
        result_table = filtered_table.select(PHENOTYPE_TABLE_COLUMNS).distinct()
    
        if self.relative_time_range is not None:
            result_table = self.relative_time_range.filter(result_table)

        return result_table