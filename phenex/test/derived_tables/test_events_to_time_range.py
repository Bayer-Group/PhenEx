import datetime, os
import pandas as pd
import ibis
from phenex.derived_tables import EventsToTimeRange
from phenex.codelists import Codelist
from phenex.filters.value import LessThanOrEqualTo, LessThan
from phenex.test.util.check_equality import check_start_end_date_equality
ibis.options.interactive = True


def create_input_data(con):
    # create all possible edge cases of consecutive and overlapping periods
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
    return con.create_table("DRUG_EXPOSURE", df_input)

def create_expected_data(con):
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
    return con.create_table("EXPECTED", df_expected)

def test_events_to_time_range():
    con = ibis.duckdb.connect()

    drug_exposure_table = create_input_data(con)
    expected_table = create_expected_data(con)

    cl = Codelist(["c1"])
    ettr = EventsToTimeRange(
        name="COMBINED_EVENTS",
        domain="DRUG_EXPOSURE",
        codelist=cl,
        max_days=LessThan(5)
    )
    result = ettr.execute(tables={"DRUG_EXPOSURE": drug_exposure_table})
    check_start_end_date_equality(result, expected_table)


if __name__ == "__main__":
    test_events_to_time_range()
