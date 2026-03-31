import datetime
import pandas as pd

from phenex.phenotypes.time_shift_phenotype import TimeShiftPhenotype
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist
from phenex.filters.date_filter import DateFilter, Before, BeforeOrOn, After, AfterOrOn
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class TimeShiftPhenotypeBasicTestGenerator(PhenotypeTestGenerator):
    """Test basic time shifting functionality with positive and negative day shifts"""

    name_space = "tspt_basic"
    test_values = True
    test_date = True
    value_datatype = float

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
            "values": [1.0, 1.0, 1.0, 1.0],
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
            "values": [365.0, 365.0, 365.0, 365.0],
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
            "values": [-30.0, -30.0, -30.0, -30.0],
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
            "values": [-365.0, -365.0, -365.0, -365.0],
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
            "values": [0.0, 0.0, 0.0, 0.0],
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
    test_values = True
    test_date = True
    value_datatype = float

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
            "values": [7.0, 7.0, 7.0, 7.0, 7.0, 7.0],
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
            "values": [14.0, 14.0, 14.0],
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
            "values": [21.0, 21.0, 21.0],
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
    test_values = True
    test_date = True
    value_datatype = float

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
            "values": [1825.0, 1825.0, 1825.0],
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
            "values": [-3650.0, -3650.0, -3650.0],
            "phenotype": TimeShiftPhenotype(
                name="shift_backward_10_years",
                phenotype=base_phenotype_2,
                days=-3650,
            ),
        }

        return [t1, t2]


class TimeShiftPhenotypeValueTestGenerator(PhenotypeTestGenerator):
    """Test that VALUE equals the number of days shifted (no clipping)."""

    name_space = "tspt_value"
    test_values = True
    test_date = True
    value_datatype = float

    def define_input_tables(self):
        self.origin = datetime.date(2022, 3, 1)
        df = pd.DataFrame(
            {
                "PERSON_ID": ["P1", "P2", "P3"],
                "CODE": ["c1"] * 3,
                "CODE_TYPE": ["ICD10CM"] * 3,
                "EVENT_DATE": [self.origin] * 3,
            }
        )
        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        codelist = Codelist(["c1"], name="c1")

        base = CodelistPhenotype(
            name="base_v1",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )
        t1 = {
            "name": "value_forward_90",
            "persons": ["P1", "P2", "P3"],
            "dates": [self.origin + datetime.timedelta(days=90)] * 3,
            "values": [90.0, 90.0, 90.0],
            "phenotype": TimeShiftPhenotype(
                name="value_forward_90", phenotype=base, days=90
            ),
        }

        base2 = CodelistPhenotype(
            name="base_v2",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )
        t2 = {
            "name": "value_backward_30",
            "persons": ["P1", "P2", "P3"],
            "dates": [self.origin - datetime.timedelta(days=30)] * 3,
            "values": [-30.0, -30.0, -30.0],
            "phenotype": TimeShiftPhenotype(
                name="value_backward_30", phenotype=base2, days=-30
            ),
        }

        base3 = CodelistPhenotype(
            name="base_v3",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )
        t3 = {
            "name": "value_zero",
            "persons": ["P1", "P2", "P3"],
            "dates": [self.origin] * 3,
            "values": [0.0, 0.0, 0.0],
            "phenotype": TimeShiftPhenotype(
                name="value_zero", phenotype=base3, days=0
            ),
        }

        return [t1, t2, t3]


class TimeShiftPhenotypeDateRangeClipTestGenerator(PhenotypeTestGenerator):
    """
    Test date clipping with date_range.

    Data layout:
        - P0: event on 2022-01-01  → shifted +365 → 2023-01-01 (no clip)
        - P1: event on 2022-06-01  → shifted +365 → 2023-06-01  → clipped to 2023-03-31
        - P2: event on 2022-10-01  → shifted +365 → 2023-10-01  → clipped to 2023-03-31
        - P3: event on 2022-01-01  → shifted -365 → 2021-01-01  → clipped to 2021-06-01 (min_date clip)
    """

    name_space = "tspt_clip"
    test_values = True
    test_date = True
    value_datatype = float

    def define_input_tables(self):
        self.event_dates = [
            datetime.date(2022, 1, 1),   # P0
            datetime.date(2022, 6, 1),   # P1
            datetime.date(2022, 10, 1),  # P2
            datetime.date(2022, 1, 1),   # P3 (backward clip test)
        ]
        df = pd.DataFrame(
            {
                "PERSON_ID": ["P0", "P1", "P2", "P3"],
                "CODE": ["c1"] * 4,
                "CODE_TYPE": ["ICD10CM"] * 4,
                "EVENT_DATE": self.event_dates,
            }
        )
        return [{"name": "CONDITION_OCCURRENCE", "df": df}]

    def define_phenotype_tests(self):
        codelist = Codelist(["c1"], name="c1")
        clip_max = datetime.date(2023, 3, 31)
        clip_min = datetime.date(2021, 6, 1)

        # --- max_date clipping (forward shift) ---
        base_fwd = CodelistPhenotype(
            name="base_clip_fwd",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )
        # P0: 2022-01-01 +365 = 2023-01-01, no clip, value=365
        # P1: 2022-06-01 +365 = 2023-06-01, clipped to clip_max, value=(clip_max - P1_date).days
        # P2: 2022-10-01 +365 = 2023-10-01, clipped to clip_max, value=(clip_max - P2_date).days
        # P3: 2022-01-01 +365 = 2023-01-01 (same as P0), no clip, value=365
        t1 = {
            "name": "clip_max_date",
            "persons": ["P0", "P1", "P2", "P3"],
            "dates": [
                datetime.date(2023, 1, 1),
                clip_max,
                clip_max,
                datetime.date(2023, 1, 1),
            ],
            "values": [
                365.0,
                float((clip_max - self.event_dates[1]).days),
                float((clip_max - self.event_dates[2]).days),
                365.0,
            ],
            "phenotype": TimeShiftPhenotype(
                name="clip_max_date",
                phenotype=base_fwd,
                days=365,
                date_range=DateFilter(max_date=BeforeOrOn(clip_max)),
            ),
        }

        # --- min_date clipping (backward shift) ---
        base_bwd = CodelistPhenotype(
            name="base_clip_bwd",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )
        # P0: 2022-01-01 -365 = 2021-01-01, clipped to clip_min, value=(clip_min - P0_date).days
        # P1: 2022-06-01 -365 = 2021-06-01 = clip_min, no clip, value=-365
        # P2: 2022-10-01 -365 = 2021-10-01 > clip_min, no clip, value=-365
        # P3: 2022-01-01 -365 = 2021-01-01, clipped to clip_min (same as P0)
        t2 = {
            "name": "clip_min_date",
            "persons": ["P0", "P1", "P2", "P3"],
            "dates": [
                clip_min,
                clip_min,
                self.event_dates[2] - datetime.timedelta(days=365),
                clip_min,
            ],
            "values": [
                float((clip_min - self.event_dates[0]).days),
                -365.0,
                -365.0,
                float((clip_min - self.event_dates[3]).days),
            ],
            "phenotype": TimeShiftPhenotype(
                name="clip_min_date",
                phenotype=base_bwd,
                days=-365,
                date_range=DateFilter(min_date=AfterOrOn(clip_min)),
            ),
        }

        # --- no clip when shift lands within range ---
        base_inrange = CodelistPhenotype(
            name="base_clip_inrange",
            domain="CONDITION_OCCURRENCE",
            codelist=codelist,
            return_date="all",
        )
        # All 4 patients shift +30 days; all land within [clip_min, clip_max], value=30
        t3 = {
            "name": "no_clip_within_range",
            "persons": ["P0", "P1", "P2", "P3"],
            "dates": [d + datetime.timedelta(days=30) for d in self.event_dates],
            "values": [30.0, 30.0, 30.0, 30.0],
            "phenotype": TimeShiftPhenotype(
                name="no_clip_within_range",
                phenotype=base_inrange,
                days=30,
                date_range=DateFilter(
                    min_date=AfterOrOn(clip_min), max_date=BeforeOrOn(clip_max)
                ),
            ),
        }

        return [t1, t2, t3]


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


def test_value():
    """Test VALUE column equals days shifted"""
    tg = TimeShiftPhenotypeValueTestGenerator()
    tg.run_tests()


def test_date_range_clipping():
    """Test date clipping and VALUE reflects clipped duration"""
    tg = TimeShiftPhenotypeDateRangeClipTestGenerator()
    tg.run_tests()


if __name__ == "__main__":
    test_basic_time_shift()
    test_multiple_events_time_shift()
    test_large_shift()
    test_value()
    test_date_range_clipping()
