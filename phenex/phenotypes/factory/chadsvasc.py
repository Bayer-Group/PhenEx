from dataclasses import dataclass
from typing import Optional, Union

from phenex.codelists import Codelist
from phenex.phenotypes import (
    CodelistPhenotype,
    AgePhenotype,
    CategoricalPhenotype,
    ScorePhenotype
)

from phenex.filters import (
    RelativeTimeRangeFilter,
    GreaterThanOrEqualTo,
    LessThanOrEqualTo,
    LessThan,
    CategoricalFilter,
    ValueFilter
)

from phenex.util import create_logger

logger = create_logger(__name__)


@dataclass
class CHADSVASCComponents:
    """
    Database specific components of CHADS-VASc. These include :


    | Type                | Number                     |
    |---------------------|----------------------------|
    | codelists           | 5                          |
    | categorical filters | 1                          |
    | domains             | 3                          |

    """

    codelist_heart_failure: Codelist
    codelist_hypertension: Codelist
    codelist_diabetes: Codelist
    codelist_stroke_tia: Codelist
    codelist_vascular_disease: Codelist
    filter_sex_female : CategoricalFilter

    domain_diagnosis: str = "CONDITION_OCCURRENCE_SOURCE"
    domain_sex: str = "PERSON"

def CHADSVASCPhenotype(
    components: CHADSVASCComponents,
    relative_time_range: RelativeTimeRangeFilter,
    name: Optional[str] = "chadsvasc",
    value_filter: Optional[ValueFilter] = None
) -> ScorePhenotype:
    """
    Operational definition for CHADS-VASc as defined in [*Refining clinical risk stratification for predicting stroke and thromboembolism in atrial fibrillation using a novel risk factor-based approach: the euro heart survey on atrial fibrillation*,  Lip et. al](https://pubmed.ncbi.nlm.nih.gov/19762550/).

    This is a database agnostic implementation. Database specific components are specified by various CHADSVASCComponents.

    Parameters:
        components: Database specific definitions of codelists, categorical filters, and domains. See documentation for CHADSVASCComponents for more details.
        relative_time_range: Required specificiation of a relative time range which defines the date at which the score will be calculated (i.e. calculated at the anchor date)
        name: Optional override of default name 'chadsvasc'.
        value_filter: Optional filtering of persons by the calculated chadsvasc value
    """

    # --- Create individual components ---
    pt_chf = CodelistPhenotype(
        name = f"{name}_heart_failure",
        domain = components.domain_diagnosis,
        codelist = components.codelist_heart_failure,
        relative_time_range=relative_time_range
    )
    pt_hypertension = CodelistPhenotype(
        name = f"{name}_hypertension",
        domain = components.domain_diagnosis,
        codelist = components.codelist_hypertension,
        relative_time_range=relative_time_range
    )
    pt_age_ge_75 = AgePhenotype(
        name= f"{name}_agege75",
        value_filter=ValueFilter(
            min_value=GreaterThanOrEqualTo(75),
        )
    )
    pt_diabetes = CodelistPhenotype(
        name = f"{name}_diabetes",
        domain = components.domain_diagnosis,
        codelist = components.codelist_diabetes,
        relative_time_range=relative_time_range
    )
    pt_stroke_tia = CodelistPhenotype(
        name = f"{name}_stroke_tia",
        domain = components.domain_diagnosis,
        codelist = components.codelist_stroke_tia,
        relative_time_range=relative_time_range
    )
    pt_vascular_disease = CodelistPhenotype(
        name = f"{name}_vascular_disease",
        domain = components.domain_diagnosis,
        codelist = components.codelist_vascular_disease,
        relative_time_range=relative_time_range
    )
    pt_age_ge65_l75 = AgePhenotype(
        name = f"{name}_age_ge65_l75",
        value_filter=ValueFilter(
            min_value=GreaterThanOrEqualTo(65),
            max_value=LessThan(75)
        ),
    )
    pt_female = CategoricalPhenotype(
        name = f"{name}_sex_female",
        categorical_filter= components.filter_sex_female,
        domain = components.domain_sex,
    )

    return ScorePhenotype(
        expression=(
            pt_chf                 # 1 point
            + pt_hypertension      # 1 point
            + (2 * pt_age_ge_75)   # 2 points
            + pt_diabetes          # 1 point
            + (2 * pt_stroke_tia)  # 2 points
            + pt_vascular_disease  # 1 point
            + pt_age_ge65_l75         # 1 point
            + pt_female            # 1 point
        ),
        name=name,
        value_filter = value_filter
    )
