import datetime
import pandas as pd
import ibis
import pytest
from phenex.tables import CodeTable, PhenexPersonTable, PhenexTable


class TestCoalescingMapper(CodeTable):
    """Test mapper with coalescing columns."""

    NAME_TABLE = "TEST_EVENTS"
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": [
            "START_DATE",
            "RECORDED_DATE",
            "CREATED_DATE",
        ],  # Coalesce multiple date columns
        "CODE": "EVENT_CODE",
    }


class TestSingleColumnMapper(CodeTable):
    """Test mapper with single column mappings only."""

    NAME_TABLE = "TEST_SIMPLE_EVENTS"
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "EVENT_DATE": "EVENT_DATE",
        "CODE": "EVENT_CODE",
    }


class TestPersonCoalescingMapper(PhenexPersonTable):
    """Test person mapper with coalescing birth date."""

    NAME_TABLE = "TEST_PERSON"
    DEFAULT_MAPPING = {
        "PERSON_ID": "PERSON_ID",
        "DATE_OF_BIRTH": [
            "BIRTH_DATETIME",
            "BIRTH_DATE",
        ],  # Prefer datetime, fallback to date
    }


def test_coalesce_first_column_present():
    """Test that when first column has value, it's used."""
    # Create test data where START_DATE is always present
    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2", "P3"],
            "START_DATE": [
                datetime.date(2020, 1, 1),
                datetime.date(2020, 2, 1),
                datetime.date(2020, 3, 1),
            ],
            "RECORDED_DATE": [
                datetime.date(2020, 1, 15),
                datetime.date(2020, 2, 15),
                datetime.date(2020, 3, 15),
            ],
            "CREATED_DATE": [
                datetime.date(2020, 1, 20),
                datetime.date(2020, 2, 20),
                datetime.date(2020, 3, 20),
            ],
            "EVENT_CODE": ["E1", "E2", "E3"],
        }
    )

    table = ibis.memtable(test_data)
    mapped_table = TestCoalescingMapper(table)

    result = mapped_table.execute()

    df_expected = pd.DataFrame(
        {
            "EVENT_DATE": [
                datetime.datetime(2020, 1, 1),
                datetime.datetime(2020, 2, 1),
                datetime.datetime(2020, 3, 1),
            ],
        }
    )
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["EVENT_DATE"]])

    # Should use START_DATE for all rows (cast to timestamp)
    pd.testing.assert_frame_equal(
        result[["EVENT_DATE"]], df_expected, check_dtype=False
    )


def test_coalesce_fallback_to_second_column():
    """Test that when first column is null, second column is used."""
    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2", "P3"],
            "START_DATE": [
                datetime.date(2020, 1, 1),
                None,  # Null for P2
                datetime.date(2020, 3, 1),
            ],
            "RECORDED_DATE": [
                datetime.date(2020, 1, 15),
                datetime.date(2020, 2, 15),  # Should be used for P2
                datetime.date(2020, 3, 15),
            ],
            "CREATED_DATE": [
                datetime.date(2020, 1, 20),
                datetime.date(2020, 2, 20),
                datetime.date(2020, 3, 20),
            ],
            "EVENT_CODE": ["E1", "E2", "E3"],
        }
    )

    table = ibis.memtable(test_data)
    mapped_table = TestCoalescingMapper(table)

    result = mapped_table.execute()

    df_expected = pd.DataFrame(
        {
            "EVENT_DATE": [
                datetime.datetime(2020, 1, 1),
                datetime.datetime(2020, 2, 15),
                datetime.datetime(2020, 3, 1),
            ],
        }
    )
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["EVENT_DATE"]])

    pd.testing.assert_frame_equal(
        result[["EVENT_DATE"]], df_expected, check_dtype=False
    )


def test_coalesce_fallback_to_third_column():
    """Test that coalesce works through multiple fallbacks."""
    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2", "P3"],
            "START_DATE": [
                None,  # Null for P1
                None,  # Null for P2
                datetime.date(2020, 3, 1),
            ],
            "RECORDED_DATE": [
                None,  # Null for P1
                datetime.date(2020, 2, 15),  # Should be used for P2
                datetime.date(2020, 3, 15),
            ],
            "CREATED_DATE": [
                datetime.date(2020, 1, 20),  # Should be used for P1
                datetime.date(2020, 2, 20),
                datetime.date(2020, 3, 20),
            ],
            "EVENT_CODE": ["E1", "E2", "E3"],
        }
    )

    table = ibis.memtable(test_data)
    mapped_table = TestCoalescingMapper(table)

    result = mapped_table.execute()

    df_expected = pd.DataFrame(
        {
            "EVENT_DATE": [
                datetime.datetime(2020, 1, 20),
                datetime.datetime(2020, 2, 15),
                datetime.datetime(2020, 3, 1),
            ],
        }
    )
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["EVENT_DATE"]])

    pd.testing.assert_frame_equal(
        result[["EVENT_DATE"]], df_expected, check_dtype=False
    )


def test_single_column_mapping():
    """Test that single column mappings still work."""
    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2", "P3"],
            "EVENT_DATE": [
                datetime.date(2020, 1, 1),
                datetime.date(2020, 2, 1),
                datetime.date(2020, 3, 1),
            ],
            "EVENT_CODE": ["E1", "E2", "E3"],
        }
    )

    table = ibis.memtable(test_data)
    mapped_table = TestSingleColumnMapper(table)

    result = mapped_table.execute()

    df_expected = pd.DataFrame(
        {
            "EVENT_DATE": [
                datetime.date(2020, 1, 1),
                datetime.date(2020, 2, 1),
                datetime.date(2020, 3, 1),
            ],
            "CODE": ["E1", "E2", "E3"],
        }
    )
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["EVENT_DATE", "CODE"]])

    pd.testing.assert_frame_equal(
        result[["EVENT_DATE", "CODE"]], df_expected, check_dtype=False
    )


def test_person_table_coalescing():
    """Test coalescing in person table for birth dates."""
    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2", "P3"],
            "BIRTH_DATETIME": [
                datetime.datetime(1980, 1, 1, 8, 30),  # P1 has datetime
                None,  # P2 missing datetime
                datetime.datetime(1990, 1, 1, 10, 15),
            ],
            "BIRTH_DATE": [
                datetime.date(1980, 1, 1),
                datetime.date(1985, 1, 1),  # P2 falls back to date
                datetime.date(1990, 1, 1),
            ],
        }
    )

    table = ibis.memtable(test_data)
    mapped_table = TestPersonCoalescingMapper(table)

    result = mapped_table.execute()

    df_expected = pd.DataFrame(
        {
            "DATE_OF_BIRTH": [
                datetime.datetime(1980, 1, 1, 8, 30),
                datetime.datetime(1985, 1, 1, 0, 0),
                datetime.datetime(1990, 1, 1, 10, 15),
            ],
        }
    )
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["DATE_OF_BIRTH"]])

    pd.testing.assert_frame_equal(
        result[["DATE_OF_BIRTH"]], df_expected, check_dtype=False
    )


def test_mixed_mapping():
    """Test mapper with both single and coalesced columns."""

    class MixedMapper(CodeTable):
        NAME_TABLE = "MIXED_EVENTS"
        DEFAULT_MAPPING = {
            "PERSON_ID": "PERSON_ID",  # Single column
            "EVENT_DATE": ["START_DT", "END_DT"],  # Coalesced
            "CODE": "CODE_VALUE",  # Single column
        }

    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2"],
            "START_DT": [datetime.date(2020, 1, 1), None],
            "END_DT": [datetime.date(2020, 1, 15), datetime.date(2020, 2, 15)],
            "CODE_VALUE": ["C1", "C2"],
        }
    )

    table = ibis.memtable(test_data)
    mapped_table = MixedMapper(table)

    result = mapped_table.execute()

    df_expected = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2"],
            "EVENT_DATE": [
                datetime.datetime(2020, 1, 1),
                datetime.datetime(2020, 2, 15),
            ],
            "CODE": ["C1", "C2"],
        }
    )
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["PERSON_ID", "EVENT_DATE", "CODE"]])

    pd.testing.assert_frame_equal(
        result[["PERSON_ID", "EVENT_DATE", "CODE"]], df_expected, check_dtype=False
    )


def test_all_nulls_coalesce():
    """Test behavior when all columns in coalesce are null."""
    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1"],
            "START_DATE": [None],
            "RECORDED_DATE": [None],
            "CREATED_DATE": [None],
            "EVENT_CODE": ["E1"],
        }
    )

    table = ibis.memtable(test_data)
    mapped_table = TestCoalescingMapper(table)

    result = mapped_table.execute()

    df_expected = pd.DataFrame({"EVENT_DATE": [None]})
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["EVENT_DATE"]])

    assert pd.isna(result["EVENT_DATE"][0])


def test_column_mapping_override():
    """Test that column_mapping parameter can override DEFAULT_MAPPING."""

    test_data = pd.DataFrame(
        {
            "PERSON_ID": ["P1", "P2"],
            "EVENT_DATE": [datetime.date(2020, 1, 1), datetime.date(2020, 2, 1)],
            "EVENT_CODE": ["E1", "E2"],
            "CUSTOM_CODE": ["C1", "C2"],
        }
    )

    table = ibis.memtable(test_data)

    # Override CODE mapping
    mapped_table = TestSingleColumnMapper(table, column_mapping={"CODE": "CUSTOM_CODE"})

    result = mapped_table.execute()

    df_expected = pd.DataFrame({"CODE": ["C1", "C2"]})
    print("Expected:")
    print(df_expected)
    print("Got:")
    print(result[["CODE"]])

    pd.testing.assert_frame_equal(result[["CODE"]], df_expected, check_dtype=False)


if __name__ == "__main__":
    test_single_column_mapping()
    test_coalesce_first_column_present()
    test_coalesce_fallback_to_second_column()
    test_coalesce_fallback_to_third_column()
    test_person_table_coalescing()
    test_mixed_mapping()
    test_all_nulls_coalesce()
    test_column_mapping_override()
