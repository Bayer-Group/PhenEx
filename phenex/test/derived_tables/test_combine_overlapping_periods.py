import datetime, os
import pandas as pd
import ibis
from phenex.derived_tables import CombineOverlappingPeriods

from phenex.test.util.check_equality import check_start_end_date_equality


def create_input_data(con):
    # create all possible edge cases of consecutive and overlapping periods
    df_input = pd.DataFrame.from_records(
        [
            ("P1", "V2", "2022-01-17", "2022-01-19"),
            ("P1", "V1", "2022-01-15", "2022-01-17"),
            ("P2", "V1", "2022-01-15", "2022-01-17"),
            ("P2", "V2", "2022-01-17", "2022-01-19"),
            ("P2", "V3", "2022-01-19", "2022-01-21"),
            ("P3", "V1", "2021-04-01", "2021-04-04"),
            ("P3", "V2", "2021-04-03", "2021-04-05"),
            ("P4", "V1", "2021-04-01", "2021-04-04"),
            ("P4", "V2", "2021-04-03", "2021-04-05"),
            ("P4", "V3", "2021-04-04", "2021-04-08"),
            ("P4", "V4", "2021-04-04", "2021-04-04"),
            ("P5", "V1", "2022-01-15", "2022-01-17"),
            ("P5", "V2", "2022-01-17", "2022-01-19"),
            ("P5", "V3", "2022-01-18", "2022-01-20"),
            ("P6", "V1", "2022-05-15", "2022-05-20"),
            ("P6", "V2", "2022-06-15", "2022-06-20"),
            ("P6", "V3", "2022-07-15", "2022-07-20"),
            ("P7", "V2", "2022-01-15", "2022-01-19"),
            ("P7", "V1", "2022-01-15", "2022-01-17"),
            ("P8", "V2", "2022-01-17", "2022-01-19"),
            ("P8", "V1", "2022-01-15", "2022-01-19"),
            ("P9", "V2", "2022-01-15", "2022-01-19"),
            ("P9", "V1", "2022-01-15", "2022-01-19"),
            ("P10", "V2", "2022-01-17", "2022-01-19"),
            ("P10", "V1", "2022-01-15", "2022-01-19"),
            ("P10", "V3", "2023-01-17", "2023-01-19"),
            ("P10", "V4", "2023-01-15", "2023-01-19"),
            ("P11", "V2", "2022-01-15", "2022-01-19"),
            ("P11", "V1", "2022-01-15", "2022-01-19"),
            ("P11", "V3", "2022-01-21", "2022-01-23"),
            ("P11", "V4", "2022-01-25", "2022-01-27"),
            ("P12", "V1", "2022-03-29", "2022-04-05"),
            ("P13", "V1", "2014-08-19", "2015-07-10"),
            ("P13", "V2", "2014-10-07", "2014-10-17"),
            ("P13", "V3", "2015-06-10", "2015-06-14"),
            ("P13", "V4", "2015-06-17", "2015-06-22"),
        ],
        columns=["PERSON_ID", "VISIT_ID", "START_DATE", "END_DATE"],
    )
    df_input["START_DATE"] = pd.to_datetime(df_input["START_DATE"])
    df_input["END_DATE"] = pd.to_datetime(df_input["END_DATE"])
    return con.create_table("VISIT_OCCURRENCE", df_input)


def create_expected_data(con):
    df_expected = pd.DataFrame.from_records(
        [
            ("P1", "2022-01-15", "2022-01-19"),
            ("P10", "2023-01-15", "2023-01-19"),
            ("P10", "2022-01-15", "2022-01-19"),
            ("P11", "2022-01-15", "2022-01-19"),
            ("P11", "2022-01-21", "2022-01-23"),
            ("P11", "2022-01-25", "2022-01-27"),
            ("P12", "2022-03-29", "2022-04-05"),
            ("P13", "2014-08-19", "2015-07-10"),
            ("P2", "2022-01-15", "2022-01-21"),
            ("P3", "2021-04-01", "2021-04-05"),
            ("P4", "2021-04-01", "2021-04-08"),
            ("P5", "2022-01-15", "2022-01-20"),
            ("P6", "2022-05-15", "2022-05-20"),
            ("P6", "2022-06-15", "2022-06-20"),
            ("P6", "2022-07-15", "2022-07-20"),
            ("P7", "2022-01-15", "2022-01-19"),
            ("P8", "2022-01-15", "2022-01-19"),
            ("P9", "2022-01-15", "2022-01-19"),
        ],
        columns=["PERSON_ID", "START_DATE", "END_DATE"],
    )
    df_expected["START_DATE"] = pd.to_datetime(df_expected["START_DATE"])
    df_expected["END_DATE"] = pd.to_datetime(df_expected["END_DATE"])
    return con.create_table("EXPECTED", df_expected)


def test_combine_overlapping_periods():
    con = ibis.duckdb.connect()

    visit_occurrence_table = create_input_data(con)
    expected_table = create_expected_data(con)

    cop = CombineOverlappingPeriods(
        dest_domain="HOSPITALIZATION",
        source_domain="VISIT_OCCURRENCE",
    )

    result = cop.derive(tables={"VISIT_OCCURRENCE": visit_occurrence_table})

    check_start_end_date_equality(result, expected_table)


if __name__ == "__main__":
    test_combine_overlapping_periods()
