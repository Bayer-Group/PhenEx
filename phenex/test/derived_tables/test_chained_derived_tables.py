import pandas as pd
import ibis

from phenex.core.cohort import Cohort
from phenex.derived_tables import (
    LoadTable,
    EventsToTimeRange,
    IntersectTimePeriods,
)
from phenex.test.util.check_equality import check_start_end_date_equality


def _create_source_tables(con):
    """Two raw source tables, each with PERSON_ID / EVENT_DATE / VALUE."""
    lvef = pd.DataFrame.from_records(
        [
            # low LVEF (<= 35) starts a period; the later normal reading ends it
            ("P1", "2022-01-01", 30),
            ("P1", "2022-03-01", 50),
        ],
        columns=["PERSON_ID", "EVENT_DATE", "VALUE"],
    )
    lvef["EVENT_DATE"] = pd.to_datetime(lvef["EVENT_DATE"])

    nyha = pd.DataFrame.from_records(
        [
            # class III starts a period; the later non-III reading ends it
            ("P1", "2022-01-15", "3"),
            ("P1", "2022-02-01", "2"),
        ],
        columns=["PERSON_ID", "EVENT_DATE", "VALUE"],
    )
    nyha["EVENT_DATE"] = pd.to_datetime(nyha["EVENT_DATE"])

    con.create_table("LVEF_ALL_PATIENTS", lvef)
    con.create_table("NYHA_ALL_PATIENTS", nyha)


def test_chained_derived_tables():
    """Chain three kinds of derived tables so each consumes the previous one's output:

    LoadTable (raw table + simple filter)
        -> EventsToTimeRange (domain/exit_domain reference the LoadTable outputs)
            -> IntersectTimePeriods (intersects two EventsToTimeRange outputs).
    """
    con = ibis.duckdb.connect()
    _create_source_tables(con)

    # --- Layer 1: LoadTable splits each source table by a simple filter -------
    lvef_low = LoadTable(
        name="LVEF_LOW",
        table_name="LVEF_ALL_PATIENTS",
        function=lambda t: t.filter(t.VALUE <= 35),
    )
    lvef_normal = LoadTable(
        name="LVEF_NORMAL",
        table_name="LVEF_ALL_PATIENTS",
        function=lambda t: t.filter(t.VALUE > 35),
    )
    nyha_iii = LoadTable(
        name="NYHA_III",
        table_name="NYHA_ALL_PATIENTS",
        function=lambda t: t.filter(t.VALUE == "3"),
    )
    nyha_not_iii = LoadTable(
        name="NYHA_NOT_III",
        table_name="NYHA_ALL_PATIENTS",
        function=lambda t: t.filter(t.VALUE != "3"),
    )

    # --- Layer 2: EventsToTimeRange builds periods from the LoadTable outputs --
    lvef_as_time_ranges = EventsToTimeRange(
        name="LVEF_TIME_RANGE",
        domain="LVEF_LOW",
        max_days=90,
        exit_domain="LVEF_NORMAL",
    )
    nyha_as_time_ranges = EventsToTimeRange(
        name="NYHA_TIME_RANGE",
        domain="NYHA_III",
        max_days=30,
        exit_domain="NYHA_NOT_III",
    )

    # --- Layer 3: IntersectTimePeriods intersects the two period tables -------
    lvef_intersect_nyha = IntersectTimePeriods(
        name="LVEF_INTERSECT_NYHA",
        time_range_tables=[nyha_as_time_ranges, lvef_as_time_ranges],
    )

    derived_tables = [
        lvef_low,
        lvef_normal,
        lvef_as_time_ranges,
        nyha_iii,
        nyha_not_iii,
        nyha_as_time_ranges,
        lvef_intersect_nyha,
    ]

    # Link each EventsToTimeRange to the LoadTables it references by domain name,
    # so the LoadTable outputs are executed and published before they are consumed.
    Cohort._wire_derived_table_dependencies(derived_tables)

    result = lvef_intersect_nyha.execute(
        tables={
            "LVEF_ALL_PATIENTS": con.table("LVEF_ALL_PATIENTS"),
            "NYHA_ALL_PATIENTS": con.table("NYHA_ALL_PATIENTS"),
        }
    )

    expected = con.create_table(
        "EXPECTED_INTERSECTION",
        pd.DataFrame(
            {
                "PERSON_ID": ["P1"],
                "START_DATE": pd.to_datetime(["2022-01-15"]),
                "END_DATE": pd.to_datetime(["2022-01-31"]),
            }
        ),
    ).mutate(
        START_DATE=ibis._.START_DATE.cast("date"),
        END_DATE=ibis._.END_DATE.cast("date"),
    )

    check_start_end_date_equality(result, expected, test_name="chained_derived_tables")


if __name__ == "__main__":
    test_chained_derived_tables()
