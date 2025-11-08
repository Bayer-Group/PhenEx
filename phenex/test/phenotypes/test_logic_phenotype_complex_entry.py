import datetime
import os
import pandas as pd

from phenex.phenotypes import LogicPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.phenotypes.time_range_phenotype import TimeRangePhenotype
from phenex.codelists.codelists import Codelist
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.categorical_filter import CategoricalFilter
from phenex.phenotypes.factory.one_inpatient_two_outpatient import (
    OneInpatientTwoOutpatientPhenotype,
)
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator
from phenex.filters.value import (
    GreaterThanOrEqualTo,
    LessThanOrEqualTo,
)


def build_complex_test_data():
    """
    Build comprehensive test data for AF diagnosis + 1 year coverage entry criterion.
    
    Test scenarios cover:
    1. Valid entries: AF diagnosis with full 1 year coverage before
    2. Boundary conditions: Coverage exactly 365 days
    3. Invalid: Coverage gaps within the year
    4. Invalid: Coverage starts after AF diagnosis
    5. Invalid: Coverage is too short (<365 days)
    6. Edge cases: Multiple AF diagnoses, multiple coverage periods
    7. Inpatient vs outpatient combinations
    8. Coverage ending on/before AF diagnosis date
    """
    
    # Base index date for relative calculations
    base_index = datetime.date(2022, 9, 20)
    
    fake_conditions = [
        # P1: PASS - 1 inpatient AF, exactly 365 days coverage before
        {
            "PERSON_ID": "P1",
            "EVENT_DATE": datetime.date(2021, 10, 15),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        
        # P2: PASS - 2 outpatient AFs, more than 365 days coverage before
        {
            "PERSON_ID": "P2",
            "EVENT_DATE": datetime.date(2021, 8, 1),
            "CODE": "I48.0",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        {
            "PERSON_ID": "P2",
            "EVENT_DATE": datetime.date(2021, 8, 10),
            "CODE": "I48.0",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        
        # P3: PASS - 1 inpatient + 1 outpatient AF, exactly 365 days coverage
        {
            "PERSON_ID": "P3",
            "EVENT_DATE": datetime.date(2021, 9, 20),
            "CODE": "I48.1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        {
            "PERSON_ID": "P3",
            "EVENT_DATE": datetime.date(2021, 9, 25),
            "CODE": "I48.1",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        
        # P4: FAIL - 1 inpatient AF but only 364 days coverage (1 day short)
        {
            "PERSON_ID": "P4",
            "EVENT_DATE": datetime.date(2021, 7, 10),
            "CODE": "I48.2",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        
        # P5: FAIL - Only 1 outpatient AF (needs 2 for outpatient path)
        {
            "PERSON_ID": "P5",
            "EVENT_DATE": datetime.date(2021, 6, 15),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        
        # P6: FAIL - 1 inpatient AF but coverage gap in the middle
        {
            "PERSON_ID": "P6",
            "EVENT_DATE": datetime.date(2021, 5, 1),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        
        # P7: PASS - Multiple AF diagnoses, use first one with valid coverage
        {
            "PERSON_ID": "P7",
            "EVENT_DATE": datetime.date(2021, 4, 1),  # First AF diagnosis
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        {
            "PERSON_ID": "P7",
            "EVENT_DATE": datetime.date(2021, 6, 1),  # Second AF diagnosis
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        
        # P8: FAIL - AF diagnosis but no coverage period at all
        {
            "PERSON_ID": "P8",
            "EVENT_DATE": datetime.date(2021, 3, 1),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        
        # P9: FAIL - Coverage starts AFTER AF diagnosis
        {
            "PERSON_ID": "P9",
            "EVENT_DATE": datetime.date(2021, 2, 1),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        
        # P10: PASS - 2 outpatient AFs with 400 days coverage
        {
            "PERSON_ID": "P10",
            "EVENT_DATE": datetime.date(2021, 1, 15),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        {
            "PERSON_ID": "P10",
            "EVENT_DATE": datetime.date(2021, 1, 20),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        
        # P11: FAIL - AF on same day as coverage start (no prior coverage)
        {
            "PERSON_ID": "P11",
            "EVENT_DATE": datetime.date(2020, 12, 1),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        
        # P12: PASS - Exactly 365 days, coverage ends on AF diagnosis date
        {
            "PERSON_ID": "P12",
            "EVENT_DATE": datetime.date(2020, 11, 1),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "inpatient",
        },
        
        # P13: FAIL - 2 outpatient but coverage too short (200 days)
        {
            "PERSON_ID": "P13",
            "EVENT_DATE": datetime.date(2020, 10, 1),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
        {
            "PERSON_ID": "P13",
            "EVENT_DATE": datetime.date(2020, 10, 5),
            "CODE": "I48",
            "CODE_TYPE": "ICD10",
            "ENCOUNTER_TYPE": "outpatient",
        },
    ]
    
    # Build observation periods (coverage)
    fake_coverage = [
        # P1: Exactly 365 days before AF diagnosis
        {
            "PERSON_ID": "P1",
            "START_DATE": datetime.date(2020, 1, 15),  # >365 days before AF
            "END_DATE": datetime.date(2021, 11, 15),    # after AF diagnosis date
        },
        
        # P2: 500 days of coverage before AF
        {
            "PERSON_ID": "P2",
            "START_DATE": datetime.date(2020, 3, 1),
            "END_DATE": datetime.date(2022, 1, 1),
        },
        
        # P3: Exactly 365 days before first AF
        {
            "PERSON_ID": "P3",
            "START_DATE": datetime.date(2020, 9, 20),
            "END_DATE": datetime.date(2021, 12, 31),
        },
        
        # P4: Only 364 days before AF (boundary test - should fail)
        {
            "PERSON_ID": "P4",
            "START_DATE": datetime.date(2020, 7, 11),  # 364 days before
            "END_DATE": datetime.date(2021, 7, 10),
        },
        
        # P5: Full coverage but only 1 outpatient (AF criterion fails)
        {
            "PERSON_ID": "P5",
            "START_DATE": datetime.date(2020, 6, 1),
            "END_DATE": datetime.date(2022, 1, 1),
        },
        
        # P6: Coverage with gap - two separate periods
        {
            "PERSON_ID": "P6",
            "START_DATE": datetime.date(2020, 5, 1),
            "END_DATE": datetime.date(2020, 10, 1),  # Gap here
        },
        {
            "PERSON_ID": "P6",
            "START_DATE": datetime.date(2020, 11, 15),
            "END_DATE": datetime.date(2021, 5, 1),  # Continuous from second period
        },
        
        # P7: Multiple coverage periods, first AF has full coverage
        {
            "PERSON_ID": "P7",
            "START_DATE": datetime.date(2020, 3, 1),
            "END_DATE": datetime.date(2021, 12, 31),
        },
        
        # P8: No coverage period (empty)
        
        # P9: Coverage starts AFTER AF diagnosis (should fail)
        {
            "PERSON_ID": "P9",
            "START_DATE": datetime.date(2021, 3, 1),  # After AF
            "END_DATE": datetime.date(2022, 3, 1),
        },
        
        # P10: 400 days before first AF
        {
            "PERSON_ID": "P10",
            "START_DATE": datetime.date(2019, 12, 1),
            "END_DATE": datetime.date(2021, 6, 1),
        },
        
        # P11: Coverage starts ON AF diagnosis date (no prior coverage)
        {
            "PERSON_ID": "P11",
            "START_DATE": datetime.date(2020, 12, 1),  # Same as AF date
            "END_DATE": datetime.date(2021, 12, 1),
        },
        
        # P12: Exactly 365 days, testing boundary
        {
            "PERSON_ID": "P12",
            "START_DATE": datetime.date(2019, 11, 1),  # Exactly 365 days
            "END_DATE": datetime.date(2020, 11, 1),     # On AF date
        },
        
        # P13: Only 200 days of coverage (too short)
        {
            "PERSON_ID": "P13",
            "START_DATE": datetime.date(2020, 3, 15),  # ~200 days before
            "END_DATE": datetime.date(2020, 12, 31),
        },
    ]
    
    df_conditions = pd.DataFrame(fake_conditions)
    df_conditions["INDEX_DATE"] = pd.Timestamp(base_index)
    
    df_coverage = pd.DataFrame(fake_coverage)
    
    return df_conditions, df_coverage


class LogicPhenotypeComplexEntryTestGenerator(PhenotypeTestGenerator):
    """
    Test generator for complex entry phenotype combining:
    1. AF diagnosis (OneInpatientTwoOutpatient pattern)
    2. One year continuous coverage prior to AF diagnosis
    3. Anchored RelativeTimeRangeFilter on the AF diagnosis phenotype
    """
    
    name_space = "lgpt_complex_entry"
    test_date = True

    def define_input_tables(self):
        df_conditions, df_coverage = build_complex_test_data()
        
        # Get all unique persons from both tables
        persons_from_conditions = set(df_conditions["PERSON_ID"].unique())
        persons_from_coverage = set(df_coverage["PERSON_ID"].unique())
        all_persons = persons_from_conditions.union(persons_from_coverage)
        
        df_persons = pd.DataFrame({"PERSON_ID": list(all_persons)})
        
        return [
            {"name": "CONDITION_OCCURRENCE_SOURCE", "df": df_conditions},
            {"name": "OBSERVATION_PERIOD", "df": df_coverage},
            {"name": "PERSON", "df": df_persons},
        ]

    def define_phenotype_tests(self):
        # Define codelists for AF
        cl_atrial_fibrillation = Codelist(
            {
                "ICD10": [
                    "I48",
                    "I48.0",
                    "I48.1",
                    "I48.2",
                    "I48.3",
                    "I48.4",
                    "I48.9",
                ]
            }
        )
        
        # Define categorical filters
        f_inpatient_categorical = CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["inpatient"],
            domain="CONDITION_OCCURRENCE_SOURCE",
        )
        
        f_outpatient_categorical = CategoricalFilter(
            column_name="ENCOUNTER_TYPE",
            allowed_values=["outpatient"],
            domain="CONDITION_OCCURRENCE_SOURCE",
        )
        
        # Optional: Add outpatient time range constraint
        f_outpatient_relative_time_range = RelativeTimeRangeFilter(
            when="before",
        )
        
        # Step 1: Create AF diagnosis phenotype
        pt_af_diagnosis = OneInpatientTwoOutpatientPhenotype(
            name="first_af_diagnosis",
            domain="CONDITION_OCCURRENCE_SOURCE",
            codelist=cl_atrial_fibrillation,
            categorical_filter_inpatient=f_inpatient_categorical,
            categorical_filter_outpatient=f_outpatient_categorical,
            relative_time_range=None,
            outpatient_relative_time_range=f_outpatient_relative_time_range,
            return_date="first",
        )
        
        # Step 2: Create filter for one year before AF diagnosis
        f_one_year_pre_entry = RelativeTimeRangeFilter(
            when="before",
            min_days=GreaterThanOrEqualTo(365),
            anchor_phenotype=pt_af_diagnosis,
        )
        
        # Step 3: Create coverage phenotype anchored to AF diagnosis
        pt_coverage = TimeRangePhenotype(
            name="one_year_coverage_prior",
            domain="OBSERVATION_PERIOD",
            relative_time_range=f_one_year_pre_entry,
        )
        
        # Step 4: Combine into entry phenotype
        pt_entry = LogicPhenotype(
            name="first_af_diagnosis_with_one_year_coverage",
            expression=pt_af_diagnosis & pt_coverage,
            return_date=pt_af_diagnosis,
        )
        
        # Expected patients who should pass all criteria:
        # P1: 1 inpatient, exactly 365 days coverage
        # P2: 2 outpatient, >365 days coverage  
        # P3: 1 inpatient + 1 outpatient, exactly 365 days
        # P7: Multiple AF diagnoses, first one has valid coverage
        # P10: 2 outpatient, 400 days coverage
        # P12: 1 inpatient, exactly 365 days (boundary case)
        
        entry_test = {
            "name": "af_entry_with_coverage",
            "persons": ["P1", "P2", "P3", "P7", "P10", "P12"],
            "dates": [
                datetime.date(2021, 10, 15),  # P1
                datetime.date(2021, 8, 1),    # P2 - first outpatient
                datetime.date(2021, 9, 20),   # P3 - first AF (inpatient)
                datetime.date(2021, 4, 1),    # P7 - first AF
                datetime.date(2021, 1, 15),   # P10 - first outpatient
                datetime.date(2020, 11, 1),   # P12 - inpatient
            ],
            "phenotype": pt_entry,
        }
        
        test_infos = [entry_test]
        
        return test_infos


def test_logic_phenotype_complex_entry():
    """
    Test complex entry phenotype with AF diagnosis and one year coverage requirement.
    
    This test validates:
    - Correct identification of AF diagnosis using OneInpatientTwoOutpatient pattern
    - Proper anchoring of RelativeTimeRangeFilter to the AF diagnosis phenotype
    - Accurate calculation of 365-day coverage requirement before AF diagnosis
    - Boundary conditions (exactly 365 days, 364 days, etc.)
    - Handling of coverage gaps and multiple coverage periods
    - Correct date selection (first AF diagnosis date)
    """
    tg = LogicPhenotypeComplexEntryTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_logic_phenotype_complex_entry()
