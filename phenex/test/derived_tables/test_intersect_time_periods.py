import datetime
import pandas as pd
import pytest
import ibis

from phenex.derived_tables import CombineOverlappingPeriods, IntersectTimePeriods
from phenex.test.util.check_equality import check_start_end_date_equality


def create_table(con, name, records):
    df = pd.DataFrame.from_records(
        records, columns=["PERSON_ID", "START_DATE", "END_DATE"]
    )
    df["START_DATE"] = pd.to_datetime(df["START_DATE"])
    df["END_DATE"] = pd.to_datetime(df["END_DATE"])
    return con.create_table(name, df)


def create_table_a(con):
    return create_table(
        con,
        "A",
        [
            ("P1", "2022-01-01", "2022-01-10"),
            # two disjoint periods for P2
            ("P2", "2022-01-01", "2022-01-05"),
            ("P2", "2022-01-10", "2022-01-15"),
            ("P3", "2022-01-01", "2022-01-10"),
            ("P4", "2022-01-01", "2022-01-05"),
            # P5 only exists in A
            ("P5", "2022-01-01", "2022-01-10"),
            ("P6", "2022-01-01", "2022-01-05"),
        ],
    )


def create_table_b(con):
    return create_table(
        con,
        "B",
        [
            ("P1", "2022-01-05", "2022-01-20"),
            ("P2", "2022-01-03", "2022-01-12"),
            # P3's period is wholly contained within A's period
            ("P3", "2022-01-03", "2022-01-07"),
            # P4's period does not overlap A's period at all
            ("P4", "2022-01-06", "2022-01-09"),
            # P6 touches A's period boundary exactly (single day overlap)
            ("P6", "2022-01-05", "2022-01-08"),
            # P7 only exists in B
            ("P7", "2022-01-01", "2022-01-05"),
        ],
    )


def create_expected_ab(con):
    return create_table(
        con,
        "EXPECTED_AB",
        [
            ("P1", "2022-01-05", "2022-01-10"),
            ("P2", "2022-01-03", "2022-01-05"),
            ("P2", "2022-01-10", "2022-01-12"),
            ("P3", "2022-01-03", "2022-01-07"),
            ("P6", "2022-01-05", "2022-01-05"),
        ],
    )


def test_intersect_time_periods_two_tables():
    con = ibis.duckdb.connect()

    table_a = create_table_a(con)
    table_b = create_table_b(con)
    expected = create_expected_ab(con)

    node_a = CombineOverlappingPeriods(name="A_PERIODS", domain="A")
    node_b = CombineOverlappingPeriods(name="B_PERIODS", domain="B")

    intersector = IntersectTimePeriods(
        name="INTERSECTION", time_range_tables=[node_a, node_b]
    )

    result = intersector.execute(tables={"A": table_a, "B": table_b})

    check_start_end_date_equality(result, expected, test_name="intersect_ab")


def test_intersect_time_periods_three_tables():
    con = ibis.duckdb.connect()

    table_a = create_table_a(con)
    table_b = create_table_b(con)
    table_c = create_table(
        con,
        "C",
        [
            # narrows P1's AB overlap (2022-01-05 - 2022-01-10) further
            ("P1", "2022-01-06", "2022-01-09"),
            # does not overlap P2's AB overlap at all -> P2 dropped entirely
            ("P2", "2022-06-01", "2022-06-05"),
        ],
    )
    expected = create_table(
        con,
        "EXPECTED_ABC",
        [
            ("P1", "2022-01-06", "2022-01-09"),
        ],
    )

    node_a = CombineOverlappingPeriods(name="A_PERIODS", domain="A")
    node_b = CombineOverlappingPeriods(name="B_PERIODS", domain="B")
    node_c = CombineOverlappingPeriods(name="C_PERIODS", domain="C")

    intersector = IntersectTimePeriods(
        name="INTERSECTION", time_range_tables=[node_a, node_b, node_c]
    )

    result = intersector.execute(tables={"A": table_a, "B": table_b, "C": table_c})

    check_start_end_date_equality(result, expected, test_name="intersect_abc")


def test_intersect_time_periods_requires_at_least_two_tables():
    node_a = CombineOverlappingPeriods(name="A_PERIODS", domain="A")

    with pytest.raises(ValueError):
        IntersectTimePeriods(name="INTERSECTION", time_range_tables=[node_a])


if __name__ == "__main__":
    test_intersect_time_periods_two_tables()
    test_intersect_time_periods_three_tables()
    test_intersect_time_periods_requires_at_least_two_tables()
