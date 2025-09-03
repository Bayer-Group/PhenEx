from typing import Union, List, Optional
from phenex.phenotypes import CodelistPhenotype
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.phenotypes.functions import select_phenotype_columns
from phenex.util import create_logger

logger = create_logger(__name__)

from ibis import _


class MeasurementPhenotype(CodelistPhenotype):
    """
    # What is MeasurementPhenotype for?
    The MeasurementPhenotype is for manipulating numerical data found in RWD data sources e.g. laboratory or observation results. These tables often contain numerical values (height, weight, blood pressure, lab results). As an event-based table, each row records a single measurement value for a single patient with a date. All numerical values are in a 'value' column. A medical code indicates the type of numerical measurement and the units of measurement are in an additional column.

    MeasurementPhenotype is a subclass of CodelistPhenotype, inheriting all of its functionality to identify patients by single or sets of medical codes (e.g. 'test type') within a specified time period. It can also :

    - identify patients with a measurement value within a value range and
    - return a measurement value, either all measurements values within filter
      criteria or perform simple aggregations (mean, median, max, min).

    # Example data:

    | PersonID    |   MedicalCode   |   EventDate   |   Value    | Unit|
    |-------------|-----------------|---------------|------------|-----|
    | 1           |   HbA1c         |   2010-01-01  |   4.2      | %   |
    | 1           |   HT            |   2010-01-02  |   121      | cm  |
    | 2           |   WT            |   2010-01-01  |   130      | kg  |

    # Note on data cleaning
    In general, data cleaning operations should be performed upstream of Phenex.
    This includes:

    - unit harmonization: ideally all values should be in the same unit for a given measurement type test. There are workarounds to deal with multiple units for a single measurement, but it is not recommended.

    - removing nonsensical values: e.g. negative blood pressures, or values outside of a physiological range. While MeasurementPhenotype provides a clean_nonphysiologicals_value_filter parameter to remove such values,  is recommended to perform this operation upstream of apex.

    - dealing with duplicate entries: e.g. multiple entries for the same patient on the same day. The meaning of multiple entries on the same day may vary between data sources, so it is recommended to handle duplicate entries upstream of apex. In some EHR datasources, duplicate entries may suggest that this value is 'more accurate', as it is passed and recorded through multiple providers and systems, while in other datasources multiple entries may suggest faulty data entry.


    Parameters:
        value_aggregation (ValueAggregator): A ValueAggregator PhenEx class defining aggregation, whether over the whole defined time period (relative time range filter, date filter) using Mean, Median, Min, Max) or daily aggregation operation (DailyMin, DailyMax, DailyMedian, DailyMean) to be performed on the measurement values. This operation occurs **after** the cleaning value filter but **prior** to the primary value_filter.
        value_filter (ValueFilter): A ValueFilter to be applied to the measurement values. This filter is applied **after** the clean_nonphysiologicals_value_filter and value_aggregation. This filter is used to identify patients with a measurement value within a value range. If not specified, no value filter is applied. For example, to identify patients with a 1. systolic blood pressure above 120 mmHg, the value_filter would be set to ValueFilter(min_value=GreaterThan(120)), 2. systolic blood pressure above 120 mmHg but below 140 mmHg, the value_filter would be set to ValueFilter(min_value=GreaterThan(120), max_value=LessThan(140)).
        further_value_filter_phenotype (str): If the input to the current MeasurementPhenotype is the output of a previous MeasurementPhenotype, set this parameter to the previous MeasurementPhenotype.
        clean_nonphysiologicals_value_filter (str): A value filter to be applied **prior** to any filtering or aggregation. This should be used to remove nonsensical values e.g. negative blood pressures, or values outside of a physiological range that are certain to be due to measurement error. Ideally, such cleaing steps should performed upstream of apex, but have been provided due to realization of practical necessity.
        clean_null_values (str): A boolean indicating whether to remove null values from the measurement table. If set to True, null values are removed prior to value filtering. If set to False, null values are not removed. If not specified, null values are removed (default is true)
        return_date (str): Specifies whether to return the 'first', 'last', or 'nearest' event date. Default is 'first'.

    """

    def __init__(
        self,
        value_filter: Optional["ValueFilter"] = None,
        clean_nonphysiologicals_value_filter: Optional["ValueFilter"] = None,
        clean_null_values: Optional[bool] = True,
        value_aggregation: Optional[
            Union[
                "ValueAggregator",
                "DailyMedian",
                "DailyMean",
                "DailyMin",
                "DailyMax",
                "DailyValueAggregator",
                "Min",
                "Max",
                "Mean",
            ]
        ] = None,
        further_value_filter_phenotype: Optional["MeasurementPhenotype"] = None,
        **kwargs,
    ):
        # Default value of return_date in codelist_phenotype is 'first'. This is not helpful behavior for measurementphenotype as we will perform further operations that require all values. For example, if we want the mean of all values in the post index period, setting return_date = 'first' will return only the values on the first day
        if "return_date" not in kwargs:
            kwargs["return_date"] = "all"
        kwargs["return_value"] = "all"
        super(MeasurementPhenotype, self).__init__(
            **kwargs,
        )

        if further_value_filter_phenotype is not None:
            self.add_children(further_value_filter_phenotype)

        self.clean_nonphysiologicals_value_filter = clean_nonphysiologicals_value_filter
        self.clean_null_values = clean_null_values
        self.value_filter = value_filter
        self.value_aggregation = value_aggregation
        self.further_value_filter_phenotype = further_value_filter_phenotype

        if self.return_date != "all":
            if self.value_aggregation.__class__.__name__ in [
                "Mean",
                "Median",
                "Max",
                "Min",
            ]:
                raise ValueError(
                    f"{self.name}: you have selected an aggregation of the entire time period ({self.value_aggregation.__class__.__name__}) while selecting a single date selection of {self.return_date}. Select a daily aggregator (DailyMean, DailyMedian, DailyMin, DailyMax) if selecting a specific return date."
                )

    def _execute(self, tables) -> PhenotypeTable:
        # perform codelist filtering
        # perform nonphysiological value filtering
        # perform value aggreation
        # perform value filter
        # perform value and dateaggregation
        code_table = tables[self.domain]
        code_table = self._perform_codelist_filtering(code_table)
        code_table = self._perform_categorical_filtering(code_table, tables)
        code_table = self._perform_null_value_filtering(code_table)
        code_table = self._perform_nonphysiological_value_filtering(code_table)
        code_table = self._perform_time_filtering(code_table)
        code_table = self._perform_date_selection(code_table)
        code_table = self._perform_value_aggregation(code_table)
        code_table = self._perform_value_filtering(code_table)
        return select_phenotype_columns(code_table)

    def _perform_null_value_filtering(self, code_table):
        if self.clean_null_values and self.value_filter:
            logger.debug(f"Applying null filtering for {self.name}")
            code_table = code_table[code_table[self.value_filter.column_name].notnull()]
        return code_table

    def _perform_nonphysiological_value_filtering(self, code_table):
        if self.clean_nonphysiologicals_value_filter is not None:
            code_table = self.clean_nonphysiologicals_value_filter.filter(code_table)
        return code_table

    def _perform_value_aggregation(self, code_table):
        if self.value_aggregation is not None:
            code_table = self.value_aggregation.aggregate(code_table)
        return code_table

    def _perform_value_filtering(self, code_table):
        if self.value_filter is not None:
            code_table = self.value_filter.filter(code_table)
        return code_table
