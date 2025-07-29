from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.phenotypes.event_count_phenotype import (
    EventCountPhenotype,
)
from phenex.phenotypes.cohort import Cohort
from phenex.codelists.codelists import Codelist
from phenex.filters.value_filter import ValueFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.value_filter import ValueFilter
from phenex.util.serialization.to_dict import to_dict
from phenex.filters.value import LessThanOrEqualTo, GreaterThanOrEqualTo
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists.codelists import Codelist
from phenex.phenotypes.cohort import Cohort
from phenex.phenotypes.age_phenotype import AgePhenotype
from phenex.phenotypes.measurement_phenotype import MeasurementPhenotype
from phenex.util.serialization.to_dict import to_dict
from phenex.filters.value import Value


def diabetes_cohort():
    """
    This function defines an example cohort for patients with diabetes using a specific codelist.

    The cohort is defined based on an entry criterion that identifies patients with diabetes
    using ICD9 and ICD10 codes. Additionally, it includes inclusion criteria for patients
    aged 18 years or older and those with chronic kidney disease (CKD) using SNOMED codes.
    It also excludes patients with high blood pressure.

    Returns:
        dict: A dictionary representation of the cohort.
    """
    # Define an explicit codelist for diabetes
    diabetes_codelist = Codelist(
        codelist={
            "ICD9": [
                "250.00",
                "250.01",
                "250.02",
            ],  # Diabetes mellitus without mention of complication
            "ICD10": [
                "E10.9",
                "E11.9",
                "E13.9",
            ],  # Type 1, Type 2, and other specified diabetes mellitus without complications
        },
        name="diabetes_codelist",
    )

    # Create a CodelistPhenotype as the entry criterion
    entry_criterion = CodelistPhenotype(
        name="diabetes_entry",
        description="Identifies patients with diabetes using ICD9 and ICD10 codes for diabetes mellitus without complications.",
        codelist=diabetes_codelist,
        return_date="first",
        domain="CONDITION_OCCURRENCE_SOURCE",
    )

    # Create an AgePhenotype as an inclusion criterion
    age_inclusion = AgePhenotype(
        name="age_inclusion",
        description="Includes patients aged 18 years or older.",
        value_filter=ValueFilter(min_value=Value(">=", 18)),
    )

    # Define an explicit codelist for CKD using SNOMED codes
    ckd_codelist = Codelist(
        codelist={
            "SNOMED": [
                "431855005",  # Chronic kidney disease stage 1
                "431856006",  # Chronic kidney disease stage 2
                "433144002",  # Chronic kidney disease stage 3
                "431857002",  # Chronic kidney disease stage 4
                "433146000",  # Chronic kidney disease stage 5
            ]
        },
        use_code_type=False,
        name="ckd_codelist",
    )

    # Create a CodelistPhenotype for CKD as an inclusion criterion
    ckd_inclusion = CodelistPhenotype(
        name="ckd_inclusion",
        description="Includes patients with chronic kidney disease (CKD) using SNOMED codes.",
        codelist=ckd_codelist,
        domain="CONDITION_OCCURRENCE",
    )

    # Define an explicit codelist for high blood pressure
    hbp_codelist = Codelist(
        codelist=["SBP"],
        use_code_type=False,
        name="hbp_codelist",
    )

    # Create a MeasurementPhenotype for high blood pressure as an exclusion criterion
    hbp_exclusion = MeasurementPhenotype(
        name="hbp_exclusion",
        description="Excludes patients with high blood pressure based on SNOMED codes.",
        codelist=hbp_codelist,
        value_filter=Value(">=", 140),  # Example: Systolic BP >= 140 mmHg
        domain="MEASUREMENT_SOURCE",
    )

    # Define the cohort
    cohort = Cohort(
        name="diabetes_cohort",
        description="A cohort of patients with diabetes, defined by the entry criterion, aged 18 years or older, with chronic kidney disease (CKD), and excluding those with high blood pressure.",
        entry_criterion=entry_criterion,
        inclusions=[age_inclusion, ckd_inclusion],
        exclusions=[hbp_exclusion],
    )

    return to_dict(cohort)


def atrial_fibrillation_cohort():
    """
    This function defines a cohort for patients with atrial fibrillation (AF) requiring
    two instances of an AF code within 90 days of each other as the entry criterion.

    Returns:
        dict: A dictionary representation of the cohort.
    """
    # Define an explicit codelist for atrial fibrillation
    af_codelist = Codelist(
        codelist={
            "ICD10": ["I48.0", "I48.1", "I48.2", "I48.91"],  # Atrial fibrillation codes
            "ICD9": ["427.31"],  # Atrial fibrillation code
        },
        name="atrial_fibrillation_codelist",
    )

    # Create a CodelistPhenotype for atrial fibrillation
    af_phenotype = CodelistPhenotype(
        name="af_phenotype",
        description="Identifies instances of atrial fibrillation using ICD9 and ICD10 codes.",
        codelist=af_codelist,
        domain="CONDITION_OCCURRENCE_SOURCE",
    )

    # Create a MultipleOccurrencesPhenotype for the entry criterion
    entry_criterion = EventCountPhenotype(
        name="af_multiple_occurrences",
        description="Requires two instances of atrial fibrillation codes within 90 days of each other.",
        phenotype=af_phenotype,
        value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
        return_event="second",
        return_date='first'
    )

    # Define the cohort
    cohort = Cohort(
        name="atrial_fibrillation_cohort",
        description="A cohort of patients with atrial fibrillation requiring two instances of AF codes within 90 days of each other.",
        entry_criterion=entry_criterion,
    )

    return to_dict(cohort)


EXAMPLES = [diabetes_cohort(), atrial_fibrillation_cohort()]
