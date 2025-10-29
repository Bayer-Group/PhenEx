import pytest
import ibis
import pandas as pd
from datetime import date, timedelta
from phenex.filters.time_range_filter import TimeRangeFilter
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.test.mock_phenotype import MockPhenotype
from phenex.filters.value import (
    GreaterThan,
    GreaterThanOrEqualTo,
    LessThan,
    LessThanOrEqualTo,
)

ibis.options.interactive = True

INDEX = date(2020, 5, 15)
p1_START = date(2020, 1, 1)
p2_START = date(2020, 3, 1)
p3_START = date(2020, 5, 1)
p4_START = date(2020, 7, 1)
p5_START = date(2020, 9, 1)

p1_END = date(2020, 1, 30)
p2_END = date(2020, 3, 30)
p3_END = date(2020, 5, 30)
p4_END = date(2020, 7, 30)
p5_END = date(2020, 9, 30)

p1_MID = date(2020, 1, 13)
p2_MID = date(2020, 1, 15)
p3_MID = date(2020, 5, 15)
p4_MID = date(2020, 1, 15)
p5_MID = date(2020, 9, 15)

DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD = (
    123  # date(2020, 9, 15) - date(2020, 5, 15) so half way between last time period
)


def setup_time_range_table():
    """
    Create a test table with a single person having five time ranges:
    - Each time range is 30 days long
    - Time ranges are separated by 30 days
    - Index date is 2020-01-01
    """
    con = ibis.duckdb.connect()

    # Create 5 time ranges, each 30 days long, separated by 30 days
    time_range_data = {
        "PERSON_ID": [1] * 5,
        "START_DATE": [
            p1_START,
            p2_START,
            p3_START,
            p4_START,
            p5_START,
        ],
        "END_DATE": [
            p1_END,
            p2_END,
            p3_END,
            p4_END,
            p5_END,
        ],
        "INDEX_DATE": [INDEX] * 5,
    }

    time_range_df = pd.DataFrame(time_range_data)
    time_range_df["INDEX"] = list(range(len(time_range_df)))
    con.create_table("time_range_table", time_range_df)
    time_range_table = con.table("time_range_table")

    # Create anchor phenotype table
    anchor_data = {
        "PERSON_ID": [1],
        "EVENT_DATE": [INDEX],
        "VALUE": [1.0],  # Use a proper value instead of None
    }
    anchor_df = pd.DataFrame(anchor_data)
    con.create_table("anchor_table", anchor_df)
    anchor_table = con.table("anchor_table")

    return {
        "time_range_table": time_range_table,
        "anchor_table": anchor_table,
        "con": con,
    }


def assert_start_end_dates(start_dates, end_dates, result_df):
    assert len(result_df) == len(start_dates) == len(end_dates)

    for i, [start, end] in enumerate(zip(start_dates, end_dates)):
        assert result_df.iloc[i]["START_DATE"] == start
        assert result_df.iloc[i]["END_DATE"] == end


#### TimeRangeFilter Tests ####


def test_no_time_filtering():
    """Test that with no relative_time_range, all time ranges are included"""
    data = setup_time_range_table()

    time_filter = TimeRangeFilter(
        relative_time_range=None, include_clipped_periods=True, clip_periods=True
    )

    result_table = time_filter.filter(data["time_range_table"])
    result_df = result_table.execute()

    # Should have all 5 time ranges
    assert len(result_df) == 5
    assert result_df["PERSON_ID"].nunique() == 1


def test_trf_INCLUDE_true_CLIP_true_RTF_before_none_none():
    """
    []  []  []  []  []
    x   x   -
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
        p3_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
        p3_MID,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_before_none_none():
    """
    []  []  []  []  []
    x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
        p3_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
        p3_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_before_none_none():
    """
    []  []  []  []  []
    x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_before_none_none():
    """
    []  []  []  []  []
    x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_true_RTF_before_none_max():
    """
    []  []  []  []  []
    -   x   -
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_MID,
        p2_START,
        p3_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
        p3_MID,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_before_none_max():
    """
    []  []  []  []  []
    x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
        p3_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
        p3_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_before_none_max():
    """
    []  []  []  []  []
        x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p2_START,
    ]
    end_dates = [
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_before_none_max():
    """
    []  []  []  []  []
        x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p2_START,
    ]
    end_dates = [
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_true_RTF_before_min_none():
    """
    []  []  []  []  []
    x   x   -
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
        p3_START,
    ]
    end_dates = [p1_END, p2_END, INDEX - timedelta(10)]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_before_min_none():
    """
    []  []  []  []  []
    x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
        p3_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
        p3_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_before_min_none():
    """
    []  []  []  []  []
    x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_before_min_none():
    """
    []  []  []  []  []
    x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="before"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_true_RTF_before_min_max():
    """
    []  []  []  []  []
    -   x   -
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_MID,
        p2_START,
        p3_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
        INDEX - timedelta(10),
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_before_min_max():
    """
    []  []  []  []  []
    x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p1_START,
        p2_START,
        p3_START,
    ]
    end_dates = [
        p1_END,
        p2_END,
        p3_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_before_min_max():
    """
    []  []  []  []  []
        x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p2_START,
    ]
    end_dates = [
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_before_min_max():
    """
    []  []  []  []  []
        x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="before",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p2_START,
    ]
    end_dates = [
        p2_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_true_RTF_after_none_none():
    """
    []  []  []  []  []
            -   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p3_MID,
        p4_START,
        p5_START,
    ]
    end_dates = [
        p3_END,
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_after_none_none():
    """
    []  []  []  []  []
            x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p3_START,
        p4_START,
        p5_START,
    ]
    end_dates = [
        p3_END,
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_after_none_none():
    """
    []  []  []  []  []
                x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
        p5_START,
    ]
    end_dates = [
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_after_none_none():
    """
    []  []  []  []  []
                x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
        p5_START,
    ]
    end_dates = [
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_true_RTF_after_none_max():
    """
    []  []  []  []  []
            -   x   -
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p3_MID,
        p4_START,
        p5_START,
    ]
    end_dates = [
        p3_END,
        p4_END,
        p5_MID,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_after_none_max():
    """
    []  []  []  []  []
            x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p3_START,
        p4_START,
        p5_START,
    ]
    end_dates = [
        p3_END,
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_after_none_max():
    """
    []  []  []  []  []
                x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
    ]
    end_dates = [
        p4_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_after_none_max():
    """
    []  []  []  []  []
                x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(0),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
    ]
    end_dates = [
        p4_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_true_RTF_after_min_none():
    """
    []  []  []  []  []
            -   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        INDEX + timedelta(10),
        p4_START,
        p5_START,
    ]
    end_dates = [p3_END, p4_END, p5_END]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_after_min_none():
    """
    []  []  []  []  []
            x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p3_START,
        p4_START,
        p5_START,
    ]
    end_dates = [
        p3_END,
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_after_min_none():
    """
    []  []  []  []  []
                x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
        p5_START,
    ]
    end_dates = [
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_after_min_none():
    """
    []  []  []  []  []
                x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10), when="after"
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
        p5_START,
    ]
    end_dates = [
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_true_RTF_after_min_max():
    """
    []  []  []  []  []
            -   x   -
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        INDEX + timedelta(10),
        p4_START,
        p5_START,
    ]
    end_dates = [p3_END, p4_END, p5_MID]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_true_CLIP_false_RTF_after_min_max():
    """
    []  []  []  []  []
            x   x   x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=True,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p3_START,
        p4_START,
        p5_START,
    ]
    end_dates = [
        p3_END,
        p4_END,
        p5_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_true_RTF_after_min_max():
    """
    []  []  []  []  []
                x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=True,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
    ]
    end_dates = [
        p4_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


def test_trf_INCLUDE_false_CLIP_false_RTF_after_min_max():
    """
    []  []  []  []  []
                x
    """
    data = setup_time_range_table()
    relative_filter = RelativeTimeRangeFilter(
        min_days=GreaterThanOrEqualTo(10),
        max_days=LessThanOrEqualTo(DAYS_INDEX_TO_HALFWAY_LAST_TIMEPERIOD),
        when="after",
    )
    time_filter = TimeRangeFilter(
        relative_time_range=[relative_filter],
        include_clipped_periods=False,
        clip_periods=False,
    )
    result_df = (
        time_filter.filter(data["time_range_table"]).execute().sort_values(by="INDEX")
    )
    start_dates = [
        p4_START,
    ]
    end_dates = [
        p4_END,
    ]
    assert_start_end_dates(start_dates, end_dates, result_df)


if __name__ == "__main__":
    """Run all test functions when script is executed directly"""

    test_functions = [
        test_no_time_filtering,
        test_trf_INCLUDE_true_CLIP_true_RTF_before_none_none,
        test_trf_INCLUDE_true_CLIP_false_RTF_before_none_none,
        test_trf_INCLUDE_false_CLIP_true_RTF_before_none_none,
        test_trf_INCLUDE_false_CLIP_false_RTF_before_none_none,
        test_trf_INCLUDE_true_CLIP_true_RTF_before_none_max,
        test_trf_INCLUDE_true_CLIP_false_RTF_before_none_max,
        test_trf_INCLUDE_false_CLIP_true_RTF_before_none_max,
        test_trf_INCLUDE_false_CLIP_false_RTF_before_none_max,
        test_trf_INCLUDE_true_CLIP_true_RTF_before_min_none,
        test_trf_INCLUDE_true_CLIP_false_RTF_before_min_none,
        test_trf_INCLUDE_false_CLIP_true_RTF_before_min_none,
        test_trf_INCLUDE_false_CLIP_false_RTF_before_min_none,
        test_trf_INCLUDE_true_CLIP_true_RTF_before_min_max,
        test_trf_INCLUDE_true_CLIP_false_RTF_before_min_max,
        test_trf_INCLUDE_false_CLIP_true_RTF_before_min_max,
        test_trf_INCLUDE_false_CLIP_false_RTF_before_min_max,
        test_trf_INCLUDE_true_CLIP_true_RTF_after_none_none,
        test_trf_INCLUDE_true_CLIP_false_RTF_after_none_none,
        test_trf_INCLUDE_false_CLIP_true_RTF_after_none_none,
        test_trf_INCLUDE_false_CLIP_false_RTF_after_none_none,
        test_trf_INCLUDE_true_CLIP_true_RTF_after_none_max,
        test_trf_INCLUDE_true_CLIP_false_RTF_after_none_max,
        test_trf_INCLUDE_false_CLIP_true_RTF_after_none_max,
        test_trf_INCLUDE_false_CLIP_false_RTF_after_none_max,
        test_trf_INCLUDE_true_CLIP_true_RTF_after_min_none,
        test_trf_INCLUDE_true_CLIP_false_RTF_after_min_none,
        test_trf_INCLUDE_false_CLIP_true_RTF_after_min_none,
        test_trf_INCLUDE_false_CLIP_false_RTF_after_min_none,
        test_trf_INCLUDE_true_CLIP_true_RTF_after_min_max,
        test_trf_INCLUDE_true_CLIP_false_RTF_after_min_max,
        test_trf_INCLUDE_false_CLIP_true_RTF_after_min_max,
        test_trf_INCLUDE_false_CLIP_false_RTF_after_min_max,
    ]

    print("Running TimeRangeFilter tests...")
    print("=" * 50)

    for i, test_func in enumerate(test_functions, 1):
        print(f"{i:2d}. Running {test_func.__name__}...")
        test_func()
        print(f"    ✓ PASSED")

    print("=" * 50)
    print("All tests completed!")
