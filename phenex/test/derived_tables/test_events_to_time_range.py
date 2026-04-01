import pandas as pd
import ibis
from phenex.derived_tables import EventsToTimeRange
from phenex.codelists import Codelist
from phenex.filters.value import LessThan, LessThanOrEqualTo

from phenex.test.derived_tables.derived_tables_test_generator import (
    DerivedTablesTestGenerator,
)


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
            max_days=LessThan(5),
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


class EventsToTimeRangeLessThanOrEqualToTestGenerator(
    EventsToTimeRangeLessThanTestGenerator
):
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
            max_days=LessThanOrEqualTo(5),
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


class EventsToTimeRangeDuplicateEventsTestGenerator(DerivedTablesTestGenerator):
    """
    Test that EventsToTimeRange correctly handles duplicate event dates.

    When the same event date appears multiple times in the source table (e.g. due to
    duplicate rows in the raw data), CombineOverlappingPeriods must still produce
    non-overlapping periods. This reproduces a bug where identical periods were not
    deduplicated, causing spurious overlapping output rows.
    """

    name_space = "ettr_duplicate_events"

    def define_input_tables(self):
        df_input = pd.DataFrame.from_records(
            [
                # P1: 2022-07-27 appears three times and 2022-08-23 twice —
                # all five rows must collapse into one period: 2022-07-27 → 2022-09-22
                ("P1", "c1", "2022-07-27"),
                ("P1", "c1", "2022-07-27"),
                ("P1", "c1", "2022-07-27"),
                ("P1", "c1", "2022-08-23"),
                ("P1", "c1", "2022-08-23"),
                # 2022-09-28 is more than 30 days after 2022-09-22, so it forms a
                # separate period: 2022-09-28 → 2022-10-28
                ("P1", "c1", "2022-09-28"),
                # P2: no duplicates — control case
                ("P2", "c1", "2022-01-01"),
                ("P2", "c1", "2022-02-15"),
            ],
            columns=["PERSON_ID", "CODE", "EVENT_DATE"],
        )
        df_input["EVENT_DATE"] = pd.to_datetime(df_input["EVENT_DATE"])

        return [{"name": "DRUG_EXPOSURE", "df": df_input}]

    def define_derived_table_tests(self):
        # P1 expected:
        #   2022-07-27 +30 = 2022-08-26; 2022-08-23 ≤ 2022-08-27 → consecutive
        #   → merged start 2022-07-27, end max(2022-08-26, 2022-09-22) = 2022-09-22
        #   2022-09-28 > 2022-09-23 → new period  2022-09-28 +30 = 2022-10-28
        # P2 expected:
        #   2022-01-01 +30 = 2022-01-31
        #   2022-02-15 > 2022-02-01 → new period  2022-02-15 +30 = 2022-03-17
        df_expected = pd.DataFrame.from_records(
            [
                ("P1", "2022-07-27", "2022-09-22"),
                ("P1", "2022-09-28", "2022-10-28"),
                ("P2", "2022-01-01", "2022-01-31"),
                ("P2", "2022-02-15", "2022-03-17"),
            ],
            columns=["PERSON_ID", "START_DATE", "END_DATE"],
        )
        df_expected["START_DATE"] = pd.to_datetime(df_expected["START_DATE"])
        df_expected["END_DATE"] = pd.to_datetime(df_expected["END_DATE"])

        cl = Codelist(["c1"])
        ettr = EventsToTimeRange(
            name="COMBINED_EVENTS",
            domain="DRUG_EXPOSURE",
            codelist=cl,
            max_days=LessThanOrEqualTo(30),
        )

        return [
            {
                "name": "events_to_time_range_duplicate_events_test",
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


def test_events_to_time_range_duplicate_events():
    test_generator = EventsToTimeRangeDuplicateEventsTestGenerator()
    test_generator.run_tests(verbose=True)


if __name__ == "__main__":
    test_events_to_time_range_less_than()
    test_events_to_time_range_less_than_or_equal_to()
    test_events_to_time_range_duplicate_events()
