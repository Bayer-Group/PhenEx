import pandas as pd
from phenex.derived_tables import MinMaxDatesToTimeRange
from phenex.test.derived_tables.derived_tables_test_generator import (
    DerivedTablesTestGenerator,
)


class MinMaxDatesToTimeRangeTestGenerator(DerivedTablesTestGenerator):
    """
    A test generator for the MinMaxDatesToTimeRange derived table.
    """

    name_space = "min_max_dates_to_time_range"

    def define_input_tables(self):
        # Create test data spanning multiple tables as well as edge cases:
        # P1: Multiple events in DRUG_EXPOSURE spanning from 2020-01-01 to 2020-01-15
        # P2: Single event in DRUG_EXPOSURE
        # P3: Multiple events on the same day in DRUG_EXPOSURE
        # P4: Event found only in CONDITION_OCCURRENCE
        # P5: Events found across both DRUG_EXPOSURE and CONDITION_OCCURRENCE
        
        df_drug = pd.DataFrame.from_records(
            [
                ("P1", "c1", "2020-01-01"),  # Global min for P1
                ("P1", "c1", "2020-01-10"),
                ("P1", "c1", "2020-01-15"),  # Global max for P1
                ("P2", "c1", "2021-05-01"),  # Single event for P2 -> min == max
                ("P3", "c1", "2022-01-01"),  # Same day events for P3 -> min == max
                ("P3", "c1", "2022-01-01"),
                ("P5", "c1", "2023-01-01"),  # Global min for P5
                ("P5", "c1", "2023-01-05"),  # Intermediate event for P5
            ],
            columns=["PERSON_ID", "CODE", "EVENT_DATE"],
        )
        df_drug["EVENT_DATE"] = pd.to_datetime(df_drug["EVENT_DATE"])

        df_condition = pd.DataFrame.from_records(
            [
                ("P4", "c1", "2019-12-31"),  # Exclusive to this table
                ("P5", "c1", "2023-01-10"),  # Global max for P5
            ],
            columns=["PERSON_ID", "CODE", "EVENT_DATE"],
        )
        df_condition["EVENT_DATE"] = pd.to_datetime(df_condition["EVENT_DATE"])
        
        # An invalid table without EVENT_DATE
        df_visit = pd.DataFrame.from_records(
            [
                ("P1", "V1", "c1"),
            ],
            columns=["PERSON_ID", "VISIT_ID", "CODE"]
        )

        return [
            {
                "name": "DRUG_EXPOSURE",
                "df": df_drug,
            },
            {
                "name": "CONDITION_OCCURRENCE",
                "df": df_condition,
            },
            {
                "name": "VISIT_OCCURRENCE",
                "df": df_visit,
            }
        ]

    def define_derived_table_tests(self):
        # Create expected output for the test
        df_expected = pd.DataFrame.from_records(
            [
                ("P1", "2020-01-01", "2020-01-15"),
                ("P2", "2021-05-01", "2021-05-01"),
                ("P3", "2022-01-01", "2022-01-01"),
                ("P4", "2019-12-31", "2019-12-31"),
                ("P5", "2023-01-01", "2023-01-10"),
            ],
            columns=["PERSON_ID", "start_date", "end_date"],
        )
        df_expected["start_date"] = pd.to_datetime(df_expected["start_date"])
        df_expected["end_date"] = pd.to_datetime(df_expected["end_date"])

        # Create the derived table
        node = MinMaxDatesToTimeRange(name="GLOBAL_TIME_RANGE")

        # Return test information
        return [
            {
                "name": "min_max_dates_to_time_range_test",
                "derived_table": node,
                "expected_df": df_expected,
                "join_on": ["PERSON_ID", "start_date", "end_date"],
            }
        ]

def test_min_max_dates_to_time_range():
    test_generator = MinMaxDatesToTimeRangeTestGenerator()
    test_generator.run_tests(verbose=True)


if __name__ == "__main__":
    test_min_max_dates_to_time_range()
