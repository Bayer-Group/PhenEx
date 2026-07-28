from typing import Optional, Union
from dataclasses import dataclass

from phenex.codelists.codelists import Codelist
from phenex.phenotypes.computation_graph_phenotypes import LogicPhenotype
from phenex.phenotypes.measurement_phenotype import MeasurementPhenotype
from phenex.filters.value_filter import ValueFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.categorical_filter import CategoricalFilter


from phenex.util import create_logger


@dataclass
class SexSplitMeasurementComponents:
    """
    Database specific components of a sex split measurement phenotype. These include :


    | Type                | Number                     |
    |---------------------|----------------------------|
    | codelists           | 2                          |
    | categorical filters | 2                          |
    | value filters       | 4                          |

    """

    codelist: Codelist
    categorical_filter_male: CategoricalFilter
    categorical_filter_female: CategoricalFilter
    value_filter_male: ValueFilter
    value_filter_female: ValueFilter
    domain: str = "LAB"


def SexSplitMeasurementPhenotype(
    name: str,
    components: SexSplitMeasurementComponents,
    clean_nonphysiologicals_value_filter: Optional["ValueFilter"] = None,
    clean_null_values: Optional[bool] = True,
    value_aggregation: Optional["ValueAggregator"] = None,
    relative_time_range: Optional["RelativeTimeRangeFilter"] = None,
):
    """
    This is a database agnostic convenience implementation of a sex split measurement phenotype. Database specific components are specified by SexSplitMeasurementComponents. This phenotype identifies patients that have distinct measurement thresholds for male and female patients.


    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for SexSplitMeasurementComponents for more details.
        name: Optional override of default name 'sex_split_measurement'.
        clean_nonphysiologicals_value_filter: Optional value filter to clean non-physiological values.
        clean_null_values: Specify whether to clean null values.
        value_aggregation: Optional specification of how to aggregate multiple values for the same patient.
        relative_time_range: Optional specification of a relative time range in which to observe measurements. For example, 'any_time_post_index' could be constructed and passed to the sex split measurement phenotype.

    """
    pt_male = MeasurementPhenotype(
        name=f"{name}_male",
        codelist=components.codelist,
        domain=components.domain,
        value_filter=components.value_filter_male,
        clean_nonphysiologicals_value_filter=clean_nonphysiologicals_value_filter,
        clean_null_values=clean_null_values,
        value_aggregation=value_aggregation,
        relative_time_range=relative_time_range,
    )

    pt_female = MeasurementPhenotype(
        name=f"{name}_female",
        codelist=components.codelist,
        domain=components.domain,
        value_filter=components.value_filter_female,
        clean_nonphysiologicals_value_filter=clean_nonphysiologicals_value_filter,
        clean_null_values=clean_null_values,
        value_aggregation=value_aggregation,
        relative_time_range=relative_time_range,
    )

    return LogicPhenotype(name=name, expression=pt_male | pt_female)
