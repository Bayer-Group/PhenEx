from typing import Optional
from phenex.phenotypes import MeasurementPhenotype, Phenotype
from phenex.filters.value import Value, GreaterThanOrEqualTo
from phenex.filters.value_filter import ValueFilter
from phenex.tables import PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.aggregators.aggregator import First, Last, ValueAggregator, DailyMedian

from ibis import _


class MeasurementChangePhenotype(Phenotype):
    """
    MeasurementChangePhenotype looks for changes in the value of a MeasurementPhenotype within a certain time period. Returns EVENT_DATE as either the date of the first or second MeasurementPhenotype event and VALUE as the observed change in the underlying MeasurementPhenotype's VALUE.

    Parameters:
        name: The name of the phenotype.
        phenotype: The measurement phenotype to look for changes.
        min_change: The minimum change in the measurement value to look for.
        direction: Whether the min_change / max_change are to be interpreted as an 'increase' in the value or a 'decrease' in the value. For example, min_change = GreatThan(0), max_change = LessThan(3), direction = 'decrease' looks for a decrease of the value between 0 and 3.
        min_days_apart: The minimum number of days between the measurements. FIXME Currently unable to detect measurement changes on the same day due to lack of intraday time resolution!
        max_days_apart: The maximum number of days between the measurements.
        component_date_select: Specifies which MeasurementPhenotype event to use for defining the date of the MeasurementChange ('first' or 'second')
        return_date: Specifies which MeasurementChangePhenotyp event to return among all events passing the filters ('first', 'last' or 'all')
        return_value: A ValueAggregator operation describing which value to return when more than one value per person pass all the filters. FIXME: return_value and return_date don't really place nicely together in this Phenotype. If you need this feature or experience breakages, reach out for support. This is a known issue but it was decided to put off fixing it.

    Example: Drop in Hemoglobin of at Least 2g/dL
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
            direction='decrease',
            component_date_select='second',
            return_date='first'
        )
        ```
    """

    def __init__(
        self,
        phenotype: MeasurementPhenotype,
        min_change: Value = None,
        max_change: Value = None,
        direction="increase",
        min_days_between: Value = GreaterThanOrEqualTo(0),
        max_days_between: Value = None,
        component_date_select="second",
        return_date="first",
        return_value: Optional[ValueAggregator] = None,
        **kwargs,
    ):
        super(MeasurementChangePhenotype, self).__init__(**kwargs)
        self.phenotype = phenotype
        self.add_children(phenotype)
        self.min_change = min_change
        self.max_change = max_change
        self.direction = direction
        self.min_days_between = min_days_between
        self.max_days_between = max_days_between
        self.component_date_select = component_date_select
        self.return_date = return_date
        self.return_value = return_value
        if self.direction not in ["increase", "decrease"]:
            raise ValueError(
                f"Invalid choice for direction: {direction}. Must be 'increase' or 'decrease'."
            )
        if component_date_select not in ["first", "second"]:
            raise ValueError(
                f'component_date_select = {component_date_select} not supported, must be either "first" or "second"'
            )

    def _execute(self, tables) -> PhenotypeTable:
        # Execute the child phenotype to get the initial filtered table
        phenotype_table_1 = self.phenotype.table
        phenotype_table_2 = self.phenotype.table.view()
        # Create a self-join to compare each measurement with every other measurement
        joined_table = phenotype_table_1.join(
            phenotype_table_2,
            [
                phenotype_table_1.PERSON_ID == phenotype_table_2.PERSON_ID,
                (phenotype_table_1.EVENT_DATE != phenotype_table_2.EVENT_DATE)
                | (phenotype_table_1.VALUE != phenotype_table_2.VALUE),
            ],
            lname="{name}_1",
            rname="{name}_2",
        ).filter(_.EVENT_DATE_1 < _.EVENT_DATE_2)
        # Calculate the change in value and the days apart
        days_between = joined_table.EVENT_DATE_2.delta(joined_table.EVENT_DATE_1, "day")
        value_change = joined_table.VALUE_2 - joined_table.VALUE_1
        joined_table = joined_table.mutate(
            VALUE_CHANGE=value_change, DAYS_BETWEEN=days_between
        )

        # Filter to keep only those with at least min_change and within max_days_apart
        if self.direction == "decrease":
            if self.min_change:
                max_change = Value(
                    operator=self.min_change.operator.replace(">", "<"),
                    value=-self.min_change.value,
                )
            else:
                max_change = None
            if self.max_change:
                min_change = Value(
                    operator=self.max_change.operator.replace("<", ">"),
                    value=-self.max_change.value,
                )
            else:
                min_change = None
        else:
            min_change = self.min_change
            max_change = self.max_change

        value_filter = ValueFilter(
            min_value=min_change, max_value=max_change, column_name="VALUE_CHANGE"
        )
        filtered_table = value_filter.filter(joined_table)
        time_filter = ValueFilter(
            min_value=self.min_days_between,
            max_value=self.max_days_between,
            column_name="DAYS_BETWEEN",
        )
        filtered_table = time_filter.filter(filtered_table)

        # Determine the return date based on the return_date attribute
        if self.component_date_select == "first":
            filtered_table = filtered_table.mutate(
                EVENT_DATE=filtered_table.EVENT_DATE_1,
            )
        elif self.component_date_select == "second":
            filtered_table = filtered_table.mutate(
                EVENT_DATE=filtered_table.EVENT_DATE_2,
            )

        # Select the required columns
        filtered_table = filtered_table.mutate(
            PERSON_ID="PERSON_ID_1", VALUE="VALUE_CHANGE", BOOLEAN=True
        )

        # Handle the return_date attribute for each PERSON_ID using window functions
        if self.return_date == "first":
            filtered_table = First(reduce=False).aggregate(filtered_table)
        elif self.return_date == "last":
            filtered_table = Last(reduce=False).aggregate(filtered_table)

        if self.return_value is not None:
            filtered_table = self.return_value.aggregate(filtered_table)

        filtered_table = (
            filtered_table.mutate(BOOLEAN=True)
            .select(PHENOTYPE_TABLE_COLUMNS)
            .distinct()
        )

        return filtered_table
