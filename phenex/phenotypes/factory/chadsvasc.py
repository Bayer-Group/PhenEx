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
    Database specific components of CHA2DS2-VASc score calculation.
    
    This dataclass encapsulates all the database-specific definitions needed to 
    calculate the CHA2DS2-VASc score, including codelists for diagnoses, filters 
    for demographic characteristics, and domain names for data tables.
    
    Attributes:
        codelist_heart_failure: Codelist containing codes for congestive heart failure 
            diagnosis (C component, 1 point).
        codelist_hypertension: Codelist containing codes for hypertension diagnosis 
            (H component, 1 point).
        codelist_diabetes: Codelist containing codes for diabetes mellitus diagnosis 
            (D component, 1 point).
        codelist_stroke_tia: Codelist containing codes for prior stroke or transient 
            ischemic attack (S2 component, 2 points).
        codelist_vascular_disease: Codelist containing codes for vascular disease 
            (V component, 1 point). This includes prior myocardial infarction, 
            peripheral artery disease, or aortic plaque.
        filter_sex_female: CategoricalFilter to identify female patients 
            (Sc component, 1 point). Should filter for the appropriate sex value 
            (e.g., "F", "Female", or database-specific code).
        domain_diagnosis: Name of the domain/table containing diagnosis codes. 
            Defaults to "CONDITION_OCCURRENCE_SOURCE" (OMOP CDM convention).
        domain_sex: Name of the domain/table containing patient demographics 
            including sex. Defaults to "PERSON" (OMOP CDM convention).
    
    Note:
        Age-based components (A and A2) are calculated automatically from the 
        patient's birth date and do not require codelist configuration.
    
    Component Summary:
        | Type                | Number |
        |---------------------|--------|
        | Codelists           | 5      |
        | Categorical Filters | 1      |
        | Domains             | 2      |
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
