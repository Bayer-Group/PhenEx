import datetime
import pandas as pd

from phenex.phenotypes.time_shift_phenotype import TimeShiftPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class TimeShiftPhenotypeBasicTestGenerator(PhenotypeTestGenerator):
    """Test basic time shifting functionality with positive and negative day shifts"""

    name_space = "tspt_basic"
    test_values = False  # TimeShiftPhenotype sets VALUE to NULL
    test_date = True  # We're testing date shifting

    def define_input_tables(self):
        """Create test data with multiple patients and event dates"""
        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 6, 15)
        event_date_3 = datetime.date(2022, 12, 31)

        df = pd.DataFrame.from_dict(
            {
                "PERSON_ID": ["P1", "P2", "P3", "P4"],
                "CODE": ["c1", "c1", "c1", "c1"],
                "CODE_TYPE": ["ICD10CM"] * 4,
                "EVENT_DATE": [
                    event_date_1,
                    event_date_2,
                    event_date_3,
                    event_date_1,
                ],
            }
        )

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        """Define test cases for various day shifts"""
        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 6, 15)
        event_date_3 = datetime.date(2022, 12, 31)

        # Create base codelist phenotype
        codelist = Codelist(["c1"], name="c1")

        # Test 1: Shift forward by 1 day
        base_phenotype_1 = CodelistPhenotype(
            name="base_1",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t1 = {
            "name": "shift_forward_1_day",
            "persons": ["P1", "P2", "P3", "P4"],
            "dates": [
                event_date_1 + datetime.timedelta(days=1),
                event_date_2 + datetime.timedelta(days=1),
                event_date_3 + datetime.timedelta(days=1),
                event_date_1 + datetime.timedelta(days=1),
            ],
            "phenotype": TimeShiftPhenotype(
                name="shift_forward_1_day",
                phenotype=base_phenotype_1,
                days=1,
            ),
        }

        # Test 2: Shift forward by 365 days (1 year)
        base_phenotype_2 = CodelistPhenotype(
            name="base_2",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t2 = {
            "name": "shift_forward_365_days",
            "persons": ["P1", "P2", "P3", "P4"],
            "dates": [
                event_date_1 + datetime.timedelta(days=365),
                event_date_2 + datetime.timedelta(days=365),
                event_date_3 + datetime.timedelta(days=365),
                event_date_1 + datetime.timedelta(days=365),
            ],
            "phenotype": TimeShiftPhenotype(
                name="shift_forward_365_days",
                phenotype=base_phenotype_2,
                days=365,
            ),
        }

        # Test 3: Shift backward by 30 days
        base_phenotype_3 = CodelistPhenotype(
            name="base_3",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t3 = {
            "name": "shift_backward_30_days",
            "persons": ["P1", "P2", "P3", "P4"],
            "dates": [
                event_date_1 - datetime.timedelta(days=30),
                event_date_2 - datetime.timedelta(days=30),
                event_date_3 - datetime.timedelta(days=30),
                event_date_1 - datetime.timedelta(days=30),
            ],
            "phenotype": TimeShiftPhenotype(
                name="shift_backward_30_days",
                phenotype=base_phenotype_3,
                days=-30,
            ),
        }

        # Test 4: Shift backward by 1 year (365 days)
        base_phenotype_4 = CodelistPhenotype(
            name="base_4",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t4 = {
            "name": "shift_backward_365_days",
            "persons": ["P1", "P2", "P3", "P4"],
            "dates": [
                event_date_1 - datetime.timedelta(days=365),
                event_date_2 - datetime.timedelta(days=365),
                event_date_3 - datetime.timedelta(days=365),
                event_date_1 - datetime.timedelta(days=365),
            ],
            "phenotype": TimeShiftPhenotype(
                name="shift_backward_365_days",
                phenotype=base_phenotype_4,
                days=-365,
            ),
        }

        # Test 5: Zero shift (no change)
        base_phenotype_5 = CodelistPhenotype(
            name="base_5",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t5 = {
            "name": "shift_zero_days",
            "persons": ["P1", "P2", "P3", "P4"],
            "dates": [
                event_date_1,
                event_date_2,
                event_date_3,
                event_date_1,
            ],
            "phenotype": TimeShiftPhenotype(
                name="shift_zero_days",
                phenotype=base_phenotype_5,
                days=0,
            ),
        }

        return [t1, t2, t3, t4, t5]


class TimeShiftPhenotypeMultipleEventsTestGenerator(PhenotypeTestGenerator):
    """Test time shifting with multiple events per patient"""

    name_space = "tspt_multiple_events"
    test_values = False
    test_date = True

    def define_input_tables(self):
        """Create test data with patients having multiple events"""
        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 2, 1)
        event_date_3 = datetime.date(2022, 3, 1)

        df = pd.DataFrame.from_dict(
            {
                "PERSON_ID": ["P1", "P1", "P1", "P2", "P2", "P3"],
                "CODE": ["c1", "c1", "c1", "c1", "c1", "c1"],
                "CODE_TYPE": ["ICD10CM"] * 6,
                "EVENT_DATE": [
                    event_date_1,
                    event_date_2,
                    event_date_3,
                    event_date_1,
                    event_date_2,
                    event_date_1,
                ],
            }
        )

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        """Test that all events are shifted correctly for patients with multiple events"""
        event_date_1 = datetime.date(2022, 1, 1)
        event_date_2 = datetime.date(2022, 2, 1)
        event_date_3 = datetime.date(2022, 3, 1)

        codelist = Codelist(["c1"], name="c1")

        # Test 1: Shift all events forward by 7 days
        base_phenotype_1 = CodelistPhenotype(
            name="base_multiple_1",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t1 = {
            "name": "multiple_events_shift_7_days",
            "persons": ["P1", "P1", "P1", "P2", "P2", "P3"],
            "dates": [
                event_date_1 + datetime.timedelta(days=7),
                event_date_2 + datetime.timedelta(days=7),
                event_date_3 + datetime.timedelta(days=7),
                event_date_1 + datetime.timedelta(days=7),
                event_date_2 + datetime.timedelta(days=7),
                event_date_1 + datetime.timedelta(days=7),
            ],
            "phenotype": TimeShiftPhenotype(
                name="multiple_events_shift_7_days",
                phenotype=base_phenotype_1,
                days=7,
            ),
        }

        # Test 2: Shift with return_date='first' to get only first shifted date
        base_phenotype_2 = CodelistPhenotype(
            name="base_multiple_2",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="first",
        )

        t2 = {
            "name": "multiple_events_first_shift_14_days",
            "persons": ["P1", "P2", "P3"],
            "dates": [
                event_date_1 + datetime.timedelta(days=14),
                event_date_1 + datetime.timedelta(days=14),
                event_date_1 + datetime.timedelta(days=14),
            ],
            "phenotype": TimeShiftPhenotype(
                name="multiple_events_first_shift_14_days",
                phenotype=base_phenotype_2,
                days=14,
            ),
        }

        # Test 3: Shift with return_date='last' to get only last shifted date
        base_phenotype_3 = CodelistPhenotype(
            name="base_multiple_3",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="last",
        )

        t3 = {
            "name": "multiple_events_last_shift_21_days",
            "persons": ["P1", "P2", "P3"],
            "dates": [
                event_date_3 + datetime.timedelta(days=21),
                event_date_2 + datetime.timedelta(days=21),
                event_date_1 + datetime.timedelta(days=21),
            ],
            "phenotype": TimeShiftPhenotype(
                name="multiple_events_last_shift_21_days",
                phenotype=base_phenotype_3,
                days=21,
            ),
        }

        return [t1, t2, t3]


class TimeShiftPhenotypeLargeShiftTestGenerator(PhenotypeTestGenerator):
    """Test time shifting with large day values"""

    name_space = "tspt_large_shift"
    test_values = False
    test_date = True

    def define_input_tables(self):
        """Create test data for large shift testing"""
        event_date = datetime.date(2020, 1, 1)

        df = pd.DataFrame.from_dict(
            {
                "PERSON_ID": ["P1", "P2", "P3"],
                "CODE": ["c1", "c1", "c1"],
                "CODE_TYPE": ["ICD10CM"] * 3,
                "EVENT_DATE": [event_date] * 3,
            }
        )

        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        """Test large positive and negative shifts"""
        event_date = datetime.date(2020, 1, 1)

        codelist = Codelist(["c1"], name="c1")

        # Test 1: Shift forward by 5 years (1825 days)
        base_phenotype_1 = CodelistPhenotype(
            name="base_large_1",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t1 = {
            "name": "shift_forward_5_years",
            "persons": ["P1", "P2", "P3"],
            "dates": [
                event_date + datetime.timedelta(days=1825),
                event_date + datetime.timedelta(days=1825),
                event_date + datetime.timedelta(days=1825),
            ],
            "phenotype": TimeShiftPhenotype(
                name="shift_forward_5_years",
                phenotype=base_phenotype_1,
                days=1825,
            ),
        }

        # Test 2: Shift backward by 10 years (3650 days)
        base_phenotype_2 = CodelistPhenotype(
            name="base_large_2",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )

        t2 = {
            "name": "shift_backward_10_years",
            "persons": ["P1", "P2", "P3"],
            "dates": [
                event_date - datetime.timedelta(days=3650),
                event_date - datetime.timedelta(days=3650),
                event_date - datetime.timedelta(days=3650),
            ],
            "phenotype": TimeShiftPhenotype(
                name="shift_backward_10_years",
                phenotype=base_phenotype_2,
                days=-3650,
            ),
        }

        return [t1, t2]


def test_basic_time_shift():
    """Test basic time shifting functionality"""
    tg = TimeShiftPhenotypeBasicTestGenerator()
    tg.run_tests()


def test_multiple_events_time_shift():
    """Test time shifting with multiple events per patient"""
    tg = TimeShiftPhenotypeMultipleEventsTestGenerator()
    tg.run_tests()


def test_large_shift():
    """Test time shifting with large day values"""
    tg = TimeShiftPhenotypeLargeShiftTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_basic_time_shift()
    test_multiple_events_time_shift()
    test_large_shift()
