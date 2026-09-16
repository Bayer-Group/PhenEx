import datetime
import pandas as pd
import pytest
import ibis

from phenex.phenotypes import TimeRangeDateSelectPhenotype
from phenex.filters import DateFilter, AfterOrOn


def create_periods_table(con):
    df = pd.DataFrame.from_records(
        [
            # P1 has two periods; A is earlier (by START_DATE) than B
            ("P1", "2022-01-01", "2022-01-05"),  # period A
            ("P1", "2022-01-10", "2022-01-12"),  # period B
            # P2 has a single period
            ("P2", "2022-02-01", "2022-02-03"),
        ],
        columns=["PERSON_ID", "START_DATE", "END_DATE"],
    )
    df["START_DATE"] = pd.to_datetime(df["START_DATE"])
    df["END_DATE"] = pd.to_datetime(df["END_DATE"])
    return con.create_table("PERIODS", df)


def dates(d0, d1=None):
    if d1 is None:
        return [datetime.date.fromisoformat(d0)]
    start = datetime.date.fromisoformat(d0)
    end = datetime.date.fromisoformat(d1)
    n = (end - start).days
    return [start + datetime.timedelta(days=i) for i in range(n + 1)]


def _to_date(value):
    return value.date() if isinstance(value, datetime.datetime) else value


def assert_event_dates(result, expected):
    """expected: dict PERSON_ID -> list[date]"""
    df = result.select("PERSON_ID", "EVENT_DATE").to_pandas()
    actual = {
        person_id: sorted(_to_date(v) for v in group["EVENT_DATE"].tolist())
        for person_id, group in df.groupby("PERSON_ID")
    }
    expected_sorted = {k: sorted(v) for k, v in expected.items()}
    assert actual == expected_sorted


@pytest.mark.parametrize(
    "return_period,return_date,expected",
    [
        ("first", "first", {"P1": dates("2022-01-01"), "P2": dates("2022-02-01")}),
        ("first", "last", {"P1": dates("2022-01-05"), "P2": dates("2022-02-03")}),
        ("last", "first", {"P1": dates("2022-01-10"), "P2": dates("2022-02-01")}),
        ("last", "last", {"P1": dates("2022-01-12"), "P2": dates("2022-02-03")}),
        (
            "all",
            "first",
            {"P1": dates("2022-01-01") + dates("2022-01-10"), "P2": dates("2022-02-01")},
        ),
        (
            "all",
            "last",
            {"P1": dates("2022-01-05") + dates("2022-01-12"), "P2": dates("2022-02-03")},
        ),
        (
            "first",
            "all",
            {"P1": dates("2022-01-01", "2022-01-05"), "P2": dates("2022-02-01", "2022-02-03")},
        ),
        (
            "all",
            "all",
            {
                "P1": dates("2022-01-01", "2022-01-05") + dates("2022-01-10", "2022-01-12"),
                "P2": dates("2022-02-01", "2022-02-03"),
            },
        ),
    ],
)
def test_time_range_date_select_phenotype(return_period, return_date, expected):
    con = ibis.duckdb.connect()
    table = create_periods_table(con)

    pt = TimeRangeDateSelectPhenotype(
        name="DATE_SELECT",
        domain="PERIODS",
        return_period=return_period,
        return_date=return_date,
    )
    result = pt.execute(tables={"PERIODS": table})

    assert_event_dates(result, expected)


def test_time_range_date_select_phenotype_date_range_clipping():
    con = ibis.duckdb.connect()
    table = create_periods_table(con)

    pt = TimeRangeDateSelectPhenotype(
        name="DATE_SELECT",
        domain="PERIODS",
        date_range=DateFilter(
            min_date=AfterOrOn(datetime.date(2022, 1, 3)),
        ),
        return_period="first",
        return_date="all",
    )
    result = pt.execute(tables={"PERIODS": table})

    # P1's first period (Jan 1 - Jan 5) is clipped to start Jan 3
    assert_event_dates(
        result,
        {
            "P1": dates("2022-01-03", "2022-01-05"),
            "P2": dates("2022-02-01", "2022-02-03"),
        },
    )


def test_time_range_date_select_phenotype_invalid_arguments():
    with pytest.raises(ValueError):
        TimeRangeDateSelectPhenotype(
            name="DATE_SELECT", domain="PERIODS", return_period="middle"
        )
    with pytest.raises(ValueError):
        TimeRangeDateSelectPhenotype(
            name="DATE_SELECT", domain="PERIODS", return_date="middle"
        )


if __name__ == "__main__":
    test_time_range_date_select_phenotype_date_range_clipping()
    test_time_range_date_select_phenotype_invalid_arguments()
