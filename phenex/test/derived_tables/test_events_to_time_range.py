import pandas as pd
import ibis
from phenex.derived_tables import EventsToTimeRange
from phenex.codelists import Codelist
from phenex.filters.value import LessThan, LessThanOrEqualTo

from phenex.test.derived_tables.derived_tables_test_generator import DerivedTablesTestGenerator


class EventsToTimeRangeLessThanTestGenerator(DerivedTablesTestGenerator):
    """
    A test generator for the EventsToTimeRange derived table.
    """
    name_space = "ettr_lessthan"

    def define_input_tables(self):
        # Create test data similar to the existing test
        df_input = pd.DataFrame.from_records(
            [
                # P1 combines two dates and excludes one
                ("P1", "c1", "2022-01-01"),
                ("P1", "c1", "2022-01-03"),
                ("P1", "c1", "2022-01-10"),
                # P2 combines three dates and excludes none i.e. makes one time period
                ("P2", "c1", "2022-01-01"),
                ("P2", "c1", "2022-01-04"),
                ("P2", "c1", "2022-01-08"),
                # P3 combines none
                ("P3", "c1", "2022-01-01"),
                ("P3", "c1", "2022-01-07"),
                ("P3", "c1", "2022-01-13"),
            ],
            columns=["PERSON_ID", "CODE", "EVENT_DATE"],
        )
        df_input["EVENT_DATE"] = pd.to_datetime(df_input["EVENT_DATE"])
        
        return [
            {
                "name": "DRUG_EXPOSURE",
                "df": df_input,
            }
        ]

    def define_derived_table_tests(self):
        # Create expected output for the test
        df_expected = pd.DataFrame.from_records(
            [
                ("P1", "2022-01-01", "2022-01-07"),
                ("P1", "2022-01-10", "2022-01-14"),
                ("P2", "2022-01-01", "2022-01-12"),
                ("P3", "2022-01-01", "2022-01-05"),
                ("P3", "2022-01-07", "2022-01-11"),
                ("P3", "2022-01-13", "2022-01-17"),
            ],
            columns=["PERSON_ID", "START_DATE", "END_DATE"],
        )
        df_expected["START_DATE"] = pd.to_datetime(df_expected["START_DATE"])
        df_expected["END_DATE"] = pd.to_datetime(df_expected["END_DATE"])
        
        # Create the derived table
        cl = Codelist(["c1"])
        ettr = EventsToTimeRange(
            name="COMBINED_EVENTS",
            domain="DRUG_EXPOSURE",
            codelist=cl,
            max_days=LessThan(5)
        )
        
        # Return test information
        return [
            {
                "name": "events_to_time_range_test",
                "derived_table": ettr,
                "expected_df": df_expected,
                "join_on": ["PERSON_ID", "START_DATE", "END_DATE"],
            }
        ]

class EventsToTimeRangeLessThanOrEqualToTestGenerator(EventsToTimeRangeLessThanTestGenerator):
    """
    A test generator for the EventsToTimeRange derived table.
    """
    name_space = "ettr_lessthanorequalto"

    def define_derived_table_tests(self):
        # Create expected output for the test
        df_expected = pd.DataFrame.from_records(
            [
                ("P1", "2022-01-01", "2022-01-08"),
                ("P1", "2022-01-10", "2022-01-15"),
                ("P2", "2022-01-01", "2022-01-13"),
                ("P3", "2022-01-01", "2022-01-18"),
            ],
            columns=["PERSON_ID", "START_DATE", "END_DATE"],
        )
        df_expected["START_DATE"] = pd.to_datetime(df_expected["START_DATE"])
        df_expected["END_DATE"] = pd.to_datetime(df_expected["END_DATE"])
        
        # Create the derived table
        cl = Codelist(["c1"])
        ettr = EventsToTimeRange(
            name="COMBINED_EVENTS",
            domain="DRUG_EXPOSURE",
            codelist=cl,
            max_days=LessThanOrEqualTo(5)
        )
        
        # Return test information
        return [
            {
                "name": "events_to_time_range_test",
                "derived_table": ettr,
                "expected_df": df_expected,
                "join_on": ["PERSON_ID", "START_DATE", "END_DATE"],
            }
        ]


def test_events_to_time_range_less_than():
    test_generator = EventsToTimeRangeLessThanTestGenerator()
    test_generator.run_tests(verbose=True)

def test_events_to_time_range_less_than_or_equal_to():
    test_generator = EventsToTimeRangeLessThanOrEqualToTestGenerator()
    test_generator.run_tests(verbose=True)

if __name__ == "__main__":
    test_events_to_time_range_less_than()
    test_events_to_time_range_less_than_or_equal_to()