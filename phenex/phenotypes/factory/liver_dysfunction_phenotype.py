from typing import Optional, Union
from dataclasses import dataclass

from phenex import (
    Codelist,
    MeasurementPhenotype,
    LogicPhenotype,
    SexSplitMeasurementPhenotype, SexSplitMeasurementComponents,
    ValueFilter, 
    RelativeTimeRangeFilter,
    CategoricalFilter,
)

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
    relative_time_range = None,

):
    """
    This is a database agnostic convenience implementation of a liver dysfunction phenotype. Database specific components are specified by LiverDysfunctionComponents. This phenotype identifies patients that have distinct measurement thresholds for male and female patients for AST and ALT.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for LiverDysfunctionComponents for more details.
        name: Optional override of default name 'liver_dysfunction'.
        relative_time_range: Optional specification of a relative time range in which to observe measurements.

    """
    sex_split_components = SexSplitMeasurementComponents(
        codelist = components.alt_codelist,
        categorical_filter_male = components.categorical_filter_male,
        categorical_filter_female = components.categorical_filter_female,
        value_filter_male = components.alt_value_filter_male,
        value_filter_female = components.alt_value_filter_female,
        domain = components.domain
    )

    pt_alt = SexSplitMeasurementPhenotype(
        name= f"{name}_ALT",
        codelist = components.alt_codelist,
        domain = components.domain,
        value_filter_male=components.alt_value_filter_male,
        value_filter_female=components.alt_value_filter_female,
        categorical_filter_male = components.categorical_filter_male,
        categorical_filter_female = components.categorical_filter_female,
        relative_time_range = relative_time_range
    )

    pt_ast = SexSplitMeasurementPhenotype(
        name= f"{name}_AST",
        codelist = components.ast_codelist,
        domain = components.domain,
        value_filter_male=components.ast_value_filter_male,
        value_filter_female=components.ast_value_filter_female,
        categorical_filter_male = components.categorical_filter_male,
        categorical_filter_female = components.categorical_filter_female,
        relative_time_range = relative_time_range
    )

    return LogicPhenotype(
        name = f"{name}",
        expression = pt_alt | pt_ast
    )