from typing import Optional, Union
from dataclasses import dataclass

from phenex.codelists.codelists import Codelist
from phenex.phenotypes.computation_graph_phenotypes import LogicPhenotype
from phenex.phenotypes.factory.sex_split_measurement_phenotype import (
    SexSplitMeasurementPhenotype,
    SexSplitMeasurementComponents,
)
from phenex.filters.value_filter import ValueFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.categorical_filter import CategoricalFilter

from phenex.util import create_logger


@dataclass
class LiverDysfunctionComponents:
    """
    Database specific components of ISTH Major Bleed. These include :


    | Type                | Number                     |
    |---------------------|----------------------------|
    | codelists           | 2                          |
    | categorical filters | 2                          |
    | value filters       | 4                          |

    """

    alt_codelist: Codelist
    ast_codelist: Codelist
    categorical_filter_male: CategoricalFilter
    categorical_filter_female: CategoricalFilter
    alt_value_filter_male: ValueFilter
    alt_value_filter_female: ValueFilter
    ast_value_filter_male: ValueFilter
    ast_value_filter_female: ValueFilter
    domain: str = "LAB"


def LiverDysfunctionPhenotype(
    components: LiverDysfunctionComponents,
    name: Optional[str] = "liver_dysfunction",
    clean_nonphysiologicals_value_filter: Optional[ValueFilter] = None,
    clean_null_values: Optional[bool] = True,
    value_aggregation=None,
    relative_time_range: Optional[RelativeTimeRangeFilter] = None,
):
    """
    This is a database agnostic convenience implementation of a liver dysfunction phenotype. Database specific components are specified by LiverDysfunctionComponents. This phenotype identifies patients that have distinct measurement thresholds for male and female patients for AST and ALT.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for LiverDysfunctionComponents for more details.
        name: Optional override of default name 'liver_dysfunction'.
        clean_nonphysiologicals_value_filter: Optional value filter applied before any other filtering to remove physiologically impossible values (e.g. negative values or extreme outliers).
        clean_null_values: Whether to remove null measurement values before filtering. Defaults to True.
        value_aggregation: Optional ValueAggregator to aggregate multiple measurements per patient (e.g. Mean, Max) before applying value filters.
        relative_time_range: Optional specification of a relative time range in which to observe measurements.

    """
    sex_split_components_alt = SexSplitMeasurementComponents(
        codelist=components.alt_codelist,
        categorical_filter_male=components.categorical_filter_male,
        categorical_filter_female=components.categorical_filter_female,
        value_filter_male=components.alt_value_filter_male,
        value_filter_female=components.alt_value_filter_female,
        domain=components.domain,
    )

    pt_alt = SexSplitMeasurementPhenotype(
        name=f"{name}_ALT",
        components=sex_split_components_alt,
        clean_nonphysiologicals_value_filter=clean_nonphysiologicals_value_filter,
        clean_null_values=clean_null_values,
        value_aggregation=value_aggregation,
        relative_time_range=relative_time_range,
    )

    sex_split_components_ast = SexSplitMeasurementComponents(
        codelist=components.ast_codelist,
        categorical_filter_male=components.categorical_filter_male,
        categorical_filter_female=components.categorical_filter_female,
        value_filter_male=components.ast_value_filter_male,
        value_filter_female=components.ast_value_filter_female,
        domain=components.domain,
    )

    pt_ast = SexSplitMeasurementPhenotype(
        name=f"{name}_AST",
        components=sex_split_components_ast,
        clean_nonphysiologicals_value_filter=clean_nonphysiologicals_value_filter,
        clean_null_values=clean_null_values,
        value_aggregation=value_aggregation,
        relative_time_range=relative_time_range,
    )

    return LogicPhenotype(name=f"{name}", expression=pt_alt | pt_ast)
