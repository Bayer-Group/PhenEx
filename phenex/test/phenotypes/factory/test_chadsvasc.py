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
import os
import pandas as pd
import ibis

from phenex.test.cohort_test_generator import CohortTestGenerator
from phenex.codelists import Codelist
from phenex.phenotypes import Cohort, CodelistPhenotype
from phenex.phenotypes.factory.chadsvasc import (
    CHADSVASCPhenotype,
    CHADSVASCComponents,
)
from phenex.filters import (
    RelativeTimeRangeFilter,
    CategoricalFilter,
    GreaterThanOrEqualTo,
)
from phenex.mappers import (
    OMOPPersonTable,
    OMOPConditionOccurrenceSourceTable,
)
from phenex.test.util.dummy.generate_dummy_cohort_data import (
    generate_dummy_cohort_data,
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
        domain_diagnosis="CONDITION_OCCURRENCE_SOURCE",
        domain_sex="PERSON",
    )


class CHADSVASCTestGenerator(CohortTestGenerator):
    """
    Test generator for CHA2DS2-VASc score using combinatorial testing.
    
    Generates all possible combinations of risk factors to ensure correct
    scoring across all scenarios.
    """

    def define_cohort(self):
        """Define cohort with entry criterion and CHA2DS2-VASc score."""
        entry = CodelistPhenotype(
            name="entry",
            codelist=Codelist(["entry_code"]),
            domain="CONDITION_OCCURRENCE_SOURCE",
            return_date="first",
        )

        chadsvasc = CHADSVASCPhenotype(
            name="chadsvasc",
            components=get_chadsvasc_components(),
            relative_time_range=RelativeTimeRangeFilter(
                when="before", anchor_phenotype=entry
            ),
        )

        return Cohort(
            name="chadsvasc_cohort",
            entry_criterion=entry,
            inclusions=[chadsvasc],
        )

    def generate_dummy_input_values_dict(self):
        """
        Generate all combinations of CHA2DS2-VASc risk factors.
        
        Creates a data dictionary with binary values (present/absent) for each
        risk factor, along with appropriate dates and demographic data.
        
        Returns:
            List of dictionaries defining all possible combinations of risk factors.
        """
        values = [
            # Entry criterion - all patients have this
            {
                "name": "entry",
                "values": ["entry_code"],
            },
            {
                "name": "entry_date",
                "values": [datetime.date(2020, 1, 1)],
            },
            # Heart failure (C) - 1 point
            {
                "name": "heart_failure",
                "values": ["chf", None],
            },
            {
                "name": "heart_failure_date",
                "values": [datetime.date(2019, 6, 1), None],
            },
            # Hypertension (H) - 1 point
            {
                "name": "hypertension",
                "values": ["htn", None],
            },
            {
                "name": "hypertension_date",
                "values": [datetime.date(2019, 6, 1), None],
            },
            # Diabetes (D) - 1 point
            {
                "name": "diabetes",
                "values": ["dm", None],
            },
            {
                "name": "diabetes_date",
                "values": [datetime.date(2019, 6, 1), None],
            },
            # Stroke/TIA (S2) - 2 points
            {
                "name": "stroke",
                "values": ["stroke", None],
            },
            {
                "name": "stroke_date",
                "values": [datetime.date(2019, 6, 1), None],
            },
            # Vascular disease (V) - 1 point
            {
                "name": "vascular_disease",
                "values": ["vasc", None],
            },
            {
                "name": "vascular_disease_date",
                "values": [datetime.date(2019, 6, 1), None],
            },
            # Age - (A2) ≥75 = 2 points, (A) 65-74 = 1 point, <65 = 0 points
            {
                "name": "birth_date",
                "values": [
                    datetime.date(1930, 1, 1),  # Age 90 at entry (≥75) = 2 points
                    datetime.date(1950, 1, 1),  # Age 70 at entry (65-74) = 1 point
                    datetime.date(1980, 1, 1),  # Age 40 at entry (<65) = 0 points
                ],
            },
            # Sex (Sc) - Female = 1 point, Male = 0 points
            {
                "name": "sex",
                "values": ["F", "M"],
            },
        ]
        return values

    def generate_dummy_input_data(self):
        """Generate combinatorial test data from values dictionary."""
        values = self.generate_dummy_input_values_dict()
        return generate_dummy_cohort_data(values)

    def calculate_expected_score(self, row):
        """
        Calculate expected CHA2DS2-VASc score for a patient record.
        
        Args:
            row: DataFrame row containing patient data
            
        Returns:
            Integer score from 0 to 9
        """
        score = 0

        # C: Congestive heart failure (1 point)
        if pd.notna(row["heart_failure"]) and row["heart_failure"] == "chf":
            score += 1

        # H: Hypertension (1 point)
        if pd.notna(row["hypertension"]) and row["hypertension"] == "htn":
            score += 1

        # D: Diabetes (1 point)
        if pd.notna(row["diabetes"]) and row["diabetes"] == "dm":
            score += 1

        # S2: Stroke/TIA (2 points)
        if pd.notna(row["stroke"]) and row["stroke"] == "stroke":
            score += 2

        # V: Vascular disease (1 point)
        if pd.notna(row["vascular_disease"]) and row["vascular_disease"] == "vasc":
            score += 1

        # A2/A: Age scoring
        entry_date = datetime.date(2020, 1, 1)
        birth_date = row["birth_date"]
        age = (entry_date - birth_date).days / 365.25

        if age >= 75:
            score += 2  # A2: Age ≥75 (2 points)
        elif age >= 65:
            score += 1  # A: Age 65-74 (1 point)

        # Sc: Female sex (1 point)
        if row["sex"] == "F":
            score += 1

        return score

    def get_correct_patients_by_score(self):
        """
        Calculate expected scores for all generated patients.
        
        Returns:
            Dictionary mapping patient IDs to their expected scores
        """
        df = self.generate_dummy_input_data()
        patient_scores = {}

        for _, row in df.iterrows():
            patient_id = row["PATID"]
            expected_score = self.calculate_expected_score(row)
            patient_scores[patient_id] = expected_score

        return patient_scores

    def define_mapped_tables(self):
        """Create mapped tables for OMOP CDM structure."""
        self.con = ibis.duckdb.connect()
        df_allvalues = self.generate_dummy_input_data()

        # Save full data for debugging
        df_allvalues.to_csv(
            os.path.join(self.dirpaths["mapped_tables"], "df_all_values.csv"),
            index=False,
        )

        # Create PERSON table
        df_person = df_allvalues[["PATID", "birth_date", "sex"]].copy()
        df_person.columns = ["PERSON_ID", "BIRTH_DATETIME", "SEX"]

        schema_person = {
            "PERSON_ID": str,
            "BIRTH_DATETIME": datetime.date,
            "SEX": str,
        }
        person_table = OMOPPersonTable(
            self.con.create_table("PERSON", df_person, schema=schema_person)
        )

        # Create CONDITION_OCCURRENCE table with all diagnosis codes
        condition_data = []
        diagnosis_columns = [
            ("entry", "entry_date"),
            ("heart_failure", "heart_failure_date"),
            ("hypertension", "hypertension_date"),
            ("diabetes", "diabetes_date"),
            ("stroke", "stroke_date"),
            ("vascular_disease", "vascular_disease_date"),
        ]

        for code_col, date_col in diagnosis_columns:
            temp_df = df_allvalues[["PATID", code_col, date_col]].copy()
            temp_df.columns = [
                "PERSON_ID",
                "CONDITION_SOURCE_VALUE",
                "CONDITION_START_DATE",
            ]
            # Only include rows where code is not null
            temp_df = temp_df[temp_df["CONDITION_SOURCE_VALUE"].notna()]
            condition_data.append(temp_df)

        df_conditions = pd.concat(condition_data, ignore_index=True)

        schema_conditions = {
            "PERSON_ID": str,
            "CONDITION_SOURCE_VALUE": str,
            "CONDITION_START_DATE": datetime.date,
        }
        condition_table = OMOPConditionOccurrenceSourceTable(
            self.con.create_table(
                "CONDITION_OCCURRENCE_SOURCE",
                df_conditions,
                schema=schema_conditions,
            )
        )

        return {
            "PERSON": person_table,
            "CONDITION_OCCURRENCE_SOURCE": condition_table,
        }

    def define_expected_output(self):
        """
        Define expected output including patient IDs and their scores.
        
        All patients should be in the cohort (all have entry criterion),
        and each should have their correctly calculated CHA2DS2-VASc score.
        """
        df = self.generate_dummy_input_data()
        patient_scores = self.get_correct_patients_by_score()

        # Create expected index with all patients and their scores
        df_expected = pd.DataFrame(
            {
                "PERSON_ID": list(patient_scores.keys()),
                "chadsvasc": list(patient_scores.values()),
            }
        )

        # Print score distribution for verification
        score_dist = df_expected["chadsvasc"].value_counts().sort_index()
        print("\nExpected CHA2DS2-VASc Score Distribution:")
        print(score_dist.to_string())
        print(f"\nTotal patients: {len(df_expected)}")
        print(f"Score range: {df_expected['chadsvasc'].min()} to {df_expected['chadsvasc'].max()}")

        return {"index": df_expected}


class CHADSVASCMinimumScoreTestGenerator(CHADSVASCTestGenerator):
    """Test CHA2DS2-VASc with minimum score filter (high-risk patients)."""

    def define_cohort(self):
        """Define cohort with CHA2DS2-VASc ≥2 (guideline threshold for anticoagulation)."""
        entry = CodelistPhenotype(
            name="entry",
            codelist=Codelist(["entry_code"]),
            domain="CONDITION_OCCURRENCE_SOURCE",
            return_date="first",
        )

        chadsvasc = CHADSVASCPhenotype(
            name="chadsvasc",
            components=get_chadsvasc_components(),
            relative_time_range=RelativeTimeRangeFilter(
                when="before", anchor_phenotype=entry
            ),
            value_filter=GreaterThanOrEqualTo(2),
        )

        return Cohort(
            name="chadsvasc_high_risk_cohort",
            entry_criterion=entry,
            inclusions=[chadsvasc],
        )

    def define_expected_output(self):
        """Only include patients with CHA2DS2-VASc ≥2."""
        df = self.generate_dummy_input_data()
        patient_scores = self.get_correct_patients_by_score()

        # Filter to only high-risk patients (score ≥2)
        high_risk_patients = {
            pid: score for pid, score in patient_scores.items() if score >= 2
        }

        df_expected = pd.DataFrame(
            {
                "PERSON_ID": list(high_risk_patients.keys()),
                "chadsvasc": list(high_risk_patients.values()),
            }
        )

        print(f"\nHigh-risk patients (score ≥2): {len(df_expected)}")
        print(f"Total patients: {len(patient_scores)}")
        print(f"Percentage high-risk: {100*len(df_expected)/len(patient_scores):.1f}%")

        return {"index": df_expected}


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
