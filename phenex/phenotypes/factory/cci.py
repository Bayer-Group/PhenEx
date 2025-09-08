from apex.core.cohort import Cohort
from apex.core.tables import *
from apex.core.data_source import DataSource
from apex.core.cohort_writer import CohortWriter
from apex.helpers import *
from apex.test.generate_test_suite import clean
from apex.operations.study_period import StudyPeriod
from apex.operations.filters import (
    TimeRangeFilter,
    DateFilter,
    ValueFilter,
    CategoricalFilter,
)

from apex.phenotypes import (
    AgePhenotype,
    EntryPhenotype,
    CodelistPhenotype,
    MeasurementPhenotype,
    ContinuousCoveragePhenotype,
    LogicPhenotype,
    SexPhenotype,
    ArithmeticPhenotype,
    PersonPhenotype,
    ManualPhenotype,
    CountPhenotype,
    MultipleOccurrencesPhenotype,
    DeathPhenotype,
)


def create_one_inpatient_two_outpatient_phenotype(
    name_codelist,
    time_range_filter=None,
    name_phenotype=None,
    inpatient_allowed_values=["inpatient"],
    outpatient_allowed_values=["outpatient"],
    columnname_encounter_type="ENCOUNTER_TYPE",
):
    """
    A common operational definition pattern is to require a single inpatient
    visit OR two outpatient visits. This reduces misclassification error for
    example in detection of Atrial Fibrillation.
    This function creates a phenotype that implements this pattern.

    Parameters
    ----------
    name_codelist : str
        The name of the codelist to be used in the phenotype. The same codelist
        is used for in inpatient and outpatient visits.
    time_range_filter : TimeRangeFilter, optional
        A time range filter to be applied to the phenotype, for example,
        'one year before the index date'.
    name_phenotype : str, optional
        The name of the phenotype. If not provided, the name of the codelist is used
    inpatient_allowed_values : list, optional
        A list of allowed values for the inpatient visits.
    outpatient_allowed_values : list, optional
        A list of allowed values for the outpatient visits.
    columnname_encounter_type : str, optional
        The column name of the encounter type in the data source.
    """
    if name_phenotype is None:
        name_phenotype = name_codelist

    # Create single occurrence of inpatient code phenotype
    one_inpatient = CodelistPhenotype(
        name_phenotype=f"{name_phenotype}_1ip",
        name_codelist=name_codelist,
        domain="condition_occurrence",
        categorical_filter=CategoricalFilter(
            allowed_values=inpatient_allowed_values,
            columnname=columnname_encounter_type,
        )
        & CategoricalFilter(
            allowed_values=["Diagnosis of"], columnname="DIAGNOSIS_TYPE"
        ),
        time_range_filter=time_range_filter,
    )

    # Create two occurrences of outpatient code phenotype
    two_outpatient = MultipleOccurrencesPhenotype(
        name_phenotype=f"{name_phenotype}_2op",
        phenotype=CodelistPhenotype(
            name_phenotype=f"{name_phenotype}_1op",
            name_codelist=name_codelist,
            domain="condition_occurrence",
            return_date="all",
            categorical_filter=CategoricalFilter(
                allowed_values=outpatient_allowed_values,
                columnname=columnname_encounter_type,
            )
            & CategoricalFilter(
                allowed_values=["Diagnosis of"], columnname="DIAGNOSIS_TYPE"
            ),
            time_range_filter=time_range_filter,
        ),
    )

    # Create composite logical phenotype that detects either one inpatient or two outpatients
    return LogicPhenotype(
        name_phenotype=f"{name_phenotype}_1ip2op", logic=one_inpatient | two_outpatient
    )


def create_cci_phenotype():
    # define one year preindex
    one_year_pre_index = TimeRangeFilter(
        min_days=ValueFilter(">=", 0), max_days=ValueFilter("<=", 365), when="before"
    )

    # Dictionary mapping each cci component codelist to the assigned score
    scores = {
        "cci_aids": 6,
        "cci_cerebrovascular_disease": 1,
        "cci_chronic_pulmonary_disease": 1,
        "cci_congestive_heart_failure": 1,
        "cci_dementia": 1,
        "cci_diabetes_without_complications": 1,
        "cci_diabetes_with_complications_end_organ_damage": 2,
        "cci_hemiplegia": 2,
        "cci_hiv": 3,
        "cci_any_malignancy_including_lymphoma_and_leukemia_except_non_melanoma_skin_cancer": 2,
        "cci_metastatic_solid_tumor": 6,
        "cci_mild_liver_disease": 1,
        "cci_renal_disease_mild_to_moderate": 1,
        "cci_moderate_or_severe_liver_diseasease": 3,
        "cci_myocardial_infarction": 1,
        "cci_peptic_ulcer_disease": 1,
        "cci_peripheral_vascular_disease": 1,
        "cci_rheumatic_disease": 1,
        "cci_renal_disease_severe": 3,
    }

    # We will create a parallel dictionary to the scores dictionary, where, as in scores,
    # each key is a cci_codelist. Each value will be a oneInpatientTwoOutpatientPhenotype
    # for that respective code. Init an empty dictionary
    cci_component_phenotypes = {}

    # iterate over each codelist name and create the necessary component phenotype (one
    # inpatient or 2 outpatient)
    for i, name_codelist in enumerate(scores.keys()):
        cci_component_phenotypes[
            name_codelist
        ] = create_one_inpatient_two_outpatient_phenotype(
            name_phenotype=f"cci_{i}_{name_codelist.split('_')[1]}",
            name_codelist=name_codelist,
            time_range_filter=one_year_pre_index,
        )

    # The cci algorithm has unique scores for each component phenotype. Multiply
    # each component phenotype by its respective score (Apex phenotypes support
    # multiplication by an integer; default returns a '1' for each phenotype, and
    # we multiply by the respective score)
    for name_codelist in scores.keys():
        cci_component_phenotypes[name_codelist] = (
            cci_component_phenotypes[name_codelist] * scores[name_codelist]
        )

    # CCI algorithm has 'trumping' phenotypes to prevent 'double counting' of related
    # conditions. For example, a patient should receive only the points for 'aids'
    # not both 'aids' and 'hiv'.
    # We define the trumping logic as a list of lists, where each sublist contains
    # two cci component codelists.
    # The first codelist in the sublist is the more severe condition, and the second
    # codelist is the less severe condition. If the patient has both conditions, the
    # patient should only receive the points for the more severe condition.
    trumps = [
        ["cci_aids", "cci_hiv"],
        ["cci_hemiplegia", "cci_cerebrovascular_disease"],
        ["cci_moderate_or_severe_liver_diseasease", "cci_mild_liver_disease"],
        [
            "cci_diabetes_with_complications_end_organ_damage",
            "cci_diabetes_without_complications",
        ],
        ["cci_renal_disease_severe", "cci_renal_disease_mild_to_moderate"],
        [
            "cci_metastatic_solid_tumor",
            "cci_any_malignancy_including_lymphoma_and_leukemia_except_non_melanoma_skin_cancer",
        ],
    ]

    # Iterate over the trumps list of lists and create a new logic phenotype
    # for the less severe phenotype that is the less severe phenotype AND NOT the
    # more severe phenotype. Replace the less severe phenotype (in
    # cci_component_phenotypes) with this new logic phenotype. Don't forget
    # that we need to multiply this new less severe phenotype by the less severe's
    # respective score.
    for [more_severe, less_severe] in trumps:
        _tmp_pt = LogicPhenotype(
            name_phenotype=f"trumps_{less_severe}_NOT_{more_severe}",
            logic=cci_component_phenotypes[less_severe]
            & ~cci_component_phenotypes[more_severe],
        )
        cci_component_phenotypes[less_severe] = _tmp_pt * scores[less_severe]

    # Create the final cci phenotype. Each component phenotype calculates the score
    # for the respective condition. The final cci score is the sum of all component
    # values. Apex phenotypes allow addition e.g. cci_component_1 + cci_component_1
    # Because the list of components is very long, we will use python sum function.
    # The second argument of the sum function can take the first object to be summed,
    # which will define the data type of addition operation. We wish to sum phenotype
    # objects, thus we will use the first object in the cci_component_phenotypes as
    # the second argument of the sum operation.
    cci_component_phenotypes_list = list(cci_component_phenotypes.values())
    cci = ArithmeticPhenotype(
        name_phenotype="cci",
        logic=sum(cci_component_phenotypes_list[1:], cci_component_phenotypes_list[0]),
    )

    return cci
