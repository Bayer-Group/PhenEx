"""
Test suite for CHA2DS2-VASc score calculation.

This test comprehensively validates the CHA2DS2-VASc scoring algorithm by generating
all possible combinations of risk factors and verifying the calculated scores.

CHA2DS2-VASc Score Components:
    - C: Congestive heart failure (1 point)
    - H: Hypertension (1 point)
    - A2: Age ≥75 years (2 points)
    - D: Diabetes (1 point)
    - S2: Prior stroke/TIA (2 points)
    - V: Vascular disease (1 point)
    - A: Age 65-74 years (1 point)
    - Sc: Sex category (female) (1 point)

Maximum possible score: 9 points
"""

import datetime
import pandas as pd

from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes import CodelistPhenotype
from phenex.phenotypes.factory.chadsvasc import (
    CHADSVASCPhenotype,
    CHADSVASCComponents,
)
from phenex.filters import (
    RelativeTimeRangeFilter,
    CategoricalFilter,
    ValueFilter,
    GreaterThanOrEqualTo,
)


def get_chadsvasc_components():
    """
    Define database-specific components for CHA2DS2-VASc calculation.

    Uses dummy codes for testing purposes. In production, these would be
    replaced with actual ICD-10/SNOMED codes.
    """
    return CHADSVASCComponents(
        codelist_heart_failure=Codelist(["chf"], name="heart_failure"),
        codelist_hypertension=Codelist(["htn"], name="hypertension"),
        codelist_diabetes=Codelist(["dm"], name="diabetes"),
        codelist_stroke_tia=Codelist(["stroke"], name="stroke_tia"),
        codelist_vascular_disease=Codelist(["vasc"], name="vascular_disease"),
        filter_sex_female=CategoricalFilter(
            column_name="SEX",
            allowed_values=["F"],
            domain="PERSON",
        ),
        domain_diagnosis="CONDITION_OCCURRENCE",
        domain_sex="PERSON",
    )


class CHADSVASCTestGenerator(PhenotypeTestGenerator):
    """
    Test generator for CHA2DS2-VASc score with manually defined patients.

    Each patient has a specific combination of risk factors to test scoring logic.
    """

    name_space = "chadsvasc"
    test_values = True
    value_datatype = int

    def define_input_tables(self):
        """
        Create manually defined patients with specific risk factor combinations.
        """
        INDEX_DATE = datetime.date(2020, 1, 1)
        EVENT_DATE = datetime.date(2019, 6, 1)

        # PERSON table - demographics and age
        person_data = [
            # Person 1: Young male, no age points, no sex points = 0 base
            {"PERSON_ID": "P1", "DATE_OF_BIRTH": datetime.date(1985, 1, 1), "SEX": "M"},
            # Person 2: Young male = 0 base
            {"PERSON_ID": "P2", "DATE_OF_BIRTH": datetime.date(1985, 1, 1), "SEX": "M"},
            # Person 3: Young male = 0 base
            {"PERSON_ID": "P3", "DATE_OF_BIRTH": datetime.date(1985, 1, 1), "SEX": "M"},
            # Person 4: Young male = 0 base
            {"PERSON_ID": "P4", "DATE_OF_BIRTH": datetime.date(1985, 1, 1), "SEX": "M"},
            # Person 5: Young male = 0 base
            {"PERSON_ID": "P5", "DATE_OF_BIRTH": datetime.date(1985, 1, 1), "SEX": "M"},
            # Person 6: Age 70 (65-74) male = 1 point for age
            {"PERSON_ID": "P6", "DATE_OF_BIRTH": datetime.date(1950, 1, 1), "SEX": "M"},
            # Person 7: Age 80 (≥75) male = 2 points for age
            {"PERSON_ID": "P7", "DATE_OF_BIRTH": datetime.date(1940, 1, 1), "SEX": "M"},
            # Person 8: Young female = 1 point for sex
            {"PERSON_ID": "P8", "DATE_OF_BIRTH": datetime.date(1985, 1, 1), "SEX": "F"},
            # Person 9: Age 70 female = 1 age + 1 sex = 2 points base
            {"PERSON_ID": "P9", "DATE_OF_BIRTH": datetime.date(1950, 1, 1), "SEX": "F"},
            # Person 10: Age 80 female = 2 age + 1 sex = 3 points base
            {
                "PERSON_ID": "P10",
                "DATE_OF_BIRTH": datetime.date(1940, 1, 1),
                "SEX": "F",
            },
            # Person 11: No conditions baseline
            {
                "PERSON_ID": "P11",
                "DATE_OF_BIRTH": datetime.date(1985, 1, 1),
                "SEX": "M",
            },
        ]

        df_person = pd.DataFrame(person_data)
        df_person["INDEX_DATE"] = INDEX_DATE

        # CONDITION_OCCURRENCE table - diagnoses
        condition_data = [
            # Person 1: Heart failure only (C=1) → Score: 1
            {"PERSON_ID": "P1", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            # Person 2: Heart failure + Hypertension (C=1, H=1) → Score: 2
            {"PERSON_ID": "P2", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P2", "CODE": "htn", "EVENT_DATE": EVENT_DATE},
            # Person 3: Stroke only (S2=2) → Score: 2
            {"PERSON_ID": "P3", "CODE": "stroke", "EVENT_DATE": EVENT_DATE},
            # Person 4: Diabetes + Vascular disease (D=1, V=1) → Score: 2
            {"PERSON_ID": "P4", "CODE": "dm", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P4", "CODE": "vasc", "EVENT_DATE": EVENT_DATE},
            # Person 5: All 5 diagnoses (C=1, H=1, D=1, S2=2, V=1) → Score: 6
            {"PERSON_ID": "P5", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P5", "CODE": "htn", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P5", "CODE": "dm", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P5", "CODE": "stroke", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P5", "CODE": "vasc", "EVENT_DATE": EVENT_DATE},
            # Person 6: Heart failure + age 70 (C=1, A=1) → Score: 2
            {"PERSON_ID": "P6", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            # Person 7: Heart failure + age 80 (C=1, A2=2) → Score: 3
            {"PERSON_ID": "P7", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            # Person 8: Heart failure + female (C=1, Sc=1) → Score: 2
            {"PERSON_ID": "P8", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            # Person 9: All diagnoses + age 70 + female (6 + 1 + 1) → Score: 8
            {"PERSON_ID": "P9", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P9", "CODE": "htn", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P9", "CODE": "dm", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P9", "CODE": "stroke", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P9", "CODE": "vasc", "EVENT_DATE": EVENT_DATE},
            # Person 10: All diagnoses + age 80 + female (6 + 2 + 1) → Score: 9 (maximum)
            {"PERSON_ID": "P10", "CODE": "chf", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P10", "CODE": "htn", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P10", "CODE": "dm", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P10", "CODE": "stroke", "EVENT_DATE": EVENT_DATE},
            {"PERSON_ID": "P10", "CODE": "vasc", "EVENT_DATE": EVENT_DATE},
            # Person 11: No conditions (baseline) → Score: 0
        ]

        df_conditions = pd.DataFrame(condition_data)
        df_conditions["CODE_TYPE"] = "ICD10CM"
        df_conditions["INDEX_DATE"] = INDEX_DATE

        return [
            {"name": "PERSON", "df": df_person},
            {"name": "CONDITION_OCCURRENCE", "df": df_conditions},
        ]

    def define_phenotype_tests(self):
        """Define expected scores for each manually defined patient."""

        # Expected scores based on manual definitions above
        persons = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11"]
        scores = [
            1,  # P1: CHF only
            2,  # P2: CHF + HTN
            2,  # P3: Stroke
            2,  # P4: DM + Vasc
            6,  # P5: All 5 diagnoses
            2,  # P6: CHF + age 65-74
            3,  # P7: CHF + age ≥75
            2,  # P8: CHF + female
            8,  # P9: All diagnoses + age 65-74 + female
            9,  # P10: All diagnoses + age ≥75 + female (maximum)
            0,  # P11: No conditions
        ]

        chadsvasc = CHADSVASCPhenotype(
            name="chadsvasc",
            components=get_chadsvasc_components(),
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
        )

        return [
            {
                "name": "chadsvasc",
                "persons": persons,
                "values": scores,
                "phenotype": chadsvasc,
            }
        ]


class CHADSVASCMinimumScoreTestGenerator(CHADSVASCTestGenerator):
    """Test CHA2DS2-VASc with minimum score filter (high-risk patients)."""

    name_space = "chadsvasc_filtered"

    def define_phenotype_tests(self):
        """Only include patients with CHA2DS2-VASc ≥2 (P1 excluded, P11 excluded)."""

        # Only patients with score ≥2 (P1 has score 1, P11 has score 0)
        persons = ["P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10"]
        scores = [2, 2, 2, 6, 2, 3, 2, 8, 9]

        chadsvasc_filtered = CHADSVASCPhenotype(
            name="chadsvasc_filtered",
            components=get_chadsvasc_components(),
            relative_time_range=RelativeTimeRangeFilter(
                when="before", min_days=GreaterThanOrEqualTo(0)
            ),
            value_filter=ValueFilter(min_value=GreaterThanOrEqualTo(2)),
        )

        return [
            {
                "name": "chadsvasc_filtered",
                "persons": persons,
                "values": scores,
                "phenotype": chadsvasc_filtered,
            }
        ]


def test_chadsvasc_all_combinations():
    """Test CHA2DS2-VASc score calculation across all risk factor combinations."""
    tg = CHADSVASCTestGenerator()
    tg.run_tests()


def test_chadsvasc_high_risk():
    """Test CHA2DS2-VASc with score ≥2 filter (guideline threshold)."""
    tg = CHADSVASCMinimumScoreTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_chadsvasc_all_combinations()
    test_chadsvasc_high_risk()
