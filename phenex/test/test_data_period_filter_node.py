"""
Tests for DataPeriodFilterNode to verify date filtering behavior.
"""

import pytest
import ibis
from datetime import date
import pandas as pd
from phenex.phenotypes.cohort import DataPeriodFilterNode
from phenex.filters import DateFilter
from phenex.filters.date_filter import AfterOrOn, BeforeOrOn


@pytest.fixture
def date_filter():
    """Create a DateFilter for testing with range 2020-01-01 to 2020-12-31"""
    return DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )


@pytest.fixture
def sample_data():
    """Create sample data for testing"""
    return {
        "PERSON_ID": [1, 2, 3, 4, 5, 6],
        "EVENT_DATE": [
            date(2019, 12, 15),  # Before range
            date(2020, 6, 1),  # Within range
            date(2020, 12, 31),  # End of range
            date(2021, 1, 15),  # After range
            date(2020, 1, 1),  # Start of range
            date(2020, 8, 15),  # Within range
        ],
        "START_DATE": [
            date(2019, 11, 1),  # Before range - should be adjusted
            date(2020, 5, 1),  # Within range - should stay
            date(2019, 12, 1),  # Before range - should be adjusted
            date(2020, 11, 1),  # Within range - should stay
            date(2020, 1, 1),  # Start of range - should stay
            date(2019, 6, 1),  # Before range - should be adjusted
        ],
        "END_DATE": [
            date(2020, 12, 1),  # Within range - should stay
            date(2021, 6, 1),  # After range - should become NULL
            date(2020, 12, 31),  # End of range - should stay
            date(2021, 5, 1),  # After range - should become NULL
            date(2020, 6, 1),  # Within range - should stay
            date(2020, 10, 1),  # Within range - should stay
        ],
        "DATE_OF_DEATH": [
            date(2020, 11, 1),  # Within range - should stay
            date(2021, 3, 1),  # After range - should become NULL
            None,  # NULL - should stay NULL
            date(2020, 12, 31),  # End of range - should stay
            date(2021, 1, 15),  # After range - should become NULL
            date(2020, 5, 1),  # Within range - should stay
        ],
        "DEATH_DATE": [
            date(2021, 2, 1),  # After range - should become NULL
            date(2020, 8, 1),  # Within range - should stay
            date(2021, 6, 1),  # After range - should become NULL
            None,  # NULL - should stay NULL
            date(2020, 3, 1),  # Within range - should stay
            date(2021, 1, 1),  # After range - should become NULL
        ],
    }


def test_event_date_filtering(date_filter, sample_data):
    """Test that EVENT_DATE filtering works correctly"""
    df = pd.DataFrame(sample_data)
    table = ibis.memtable(df)

    # Create node and execute
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    # Convert back to pandas for assertion
    result = filtered_table.to_pandas()

    # Should only have rows where EVENT_DATE is within the date range
    expected_event_dates = [
        date(2020, 6, 1),  # Within range
        date(2020, 12, 31),  # End of range
        date(2020, 1, 1),  # Start of range
        date(2020, 8, 15),  # Within range
    ]

    assert len(result) == 4
    assert set(result["EVENT_DATE"].tolist()) == set(expected_event_dates)


def test_start_date_adjustment(date_filter, sample_data):
    """Test that START_DATE columns are adjusted to max(START_DATE, min_date)"""
    df = pd.DataFrame(sample_data)
    table = ibis.memtable(df)

    # Create node and execute
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    # Convert back to pandas for assertion
    result = filtered_table.to_pandas()

    # Check START_DATE adjustments for remaining rows
    min_date = date(2020, 1, 1)
    for _, row in result.iterrows():
        if pd.notna(row["START_DATE"]):
            # START_DATE should be at least min_date
            assert row["START_DATE"] >= min_date


def test_end_date_nullification(date_filter, sample_data):
    """Test that END_DATE columns are set to NULL if after max_date"""
    df = pd.DataFrame(sample_data)
    table = ibis.memtable(df)

    # Create node and execute
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    # Convert back to pandas for assertion
    result = filtered_table.to_pandas()

    max_date = date(2020, 12, 31)
    for _, row in result.iterrows():
        if pd.notna(row["END_DATE"]):
            # END_DATE should be within the allowed range
            assert row["END_DATE"] <= max_date


def test_death_date_nullification(date_filter, sample_data):
    """Test that death date columns are set to NULL if after max_date"""
    df = pd.DataFrame(sample_data)
    table = ibis.memtable(df)

    # Create node and execute
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    # Convert back to pandas for assertion
    result = filtered_table.to_pandas()

    max_date = date(2020, 12, 31)
    for _, row in result.iterrows():
        # Check DATE_OF_DEATH
        if pd.notna(row["DATE_OF_DEATH"]):
            assert row["DATE_OF_DEATH"] <= max_date

        # Check DEATH_DATE
        if pd.notna(row["DEATH_DATE"]):
            assert row["DEATH_DATE"] <= max_date


def test_multiple_start_date_columns():
    """Test handling of multiple columns containing START_DATE substring"""
    data = {
        "PERSON_ID": [1, 2, 3],
        "EVENT_DATE": [date(2020, 6, 1), date(2020, 7, 1), date(2020, 8, 1)],
        "TREATMENT_START_DATE": [
            date(2019, 11, 1),
            date(2020, 5, 1),
            date(2019, 12, 1),
        ],
        "CONDITION_START_DATE": [date(2019, 10, 1), date(2020, 4, 1), date(2020, 1, 1)],
        "START_DATE_PROCEDURE": [
            date(2019, 9, 1),
            date(2020, 3, 1),
            date(2019, 11, 15),
        ],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()
    min_date = date(2020, 1, 1)

    # All columns containing START_DATE should be adjusted
    for _, row in result.iterrows():
        assert row["TREATMENT_START_DATE"] >= min_date
        assert row["CONDITION_START_DATE"] >= min_date
        assert row["START_DATE_PROCEDURE"] >= min_date


def test_multiple_end_date_columns():
    """Test handling of multiple columns containing END_DATE substring"""
    data = {
        "PERSON_ID": [1, 2, 3],
        "EVENT_DATE": [date(2020, 6, 1), date(2020, 7, 1), date(2020, 8, 1)],
        "TREATMENT_END_DATE": [date(2020, 12, 1), date(2021, 6, 1), date(2020, 12, 31)],
        "CONDITION_END_DATE": [date(2021, 1, 1), date(2020, 11, 1), date(2021, 5, 1)],
        "END_DATE_PROCEDURE": [date(2020, 10, 1), date(2021, 3, 1), date(2020, 11, 15)],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()
    max_date = date(2020, 12, 31)

    # Check that all END_DATE columns after max_date are NULL
    for _, row in result.iterrows():
        if pd.notna(row["TREATMENT_END_DATE"]):
            assert row["TREATMENT_END_DATE"] <= max_date
        if pd.notna(row["CONDITION_END_DATE"]):
            assert row["CONDITION_END_DATE"] <= max_date
        if pd.notna(row["END_DATE_PROCEDURE"]):
            assert row["END_DATE_PROCEDURE"] <= max_date


def test_substring_matching_patterns():
    """Test that substring matching works for various column name patterns"""
    data = {
        "PERSON_ID": [1, 2],
        "EVENT_DATE": [date(2020, 6, 1), date(2020, 7, 1)],
        # START_DATE patterns
        "START_DATE": [date(2019, 11, 1), date(2020, 5, 1)],
        "TREATMENT_START_DATE": [date(2019, 10, 1), date(2020, 4, 1)],
        "START_DATE_PROCEDURE": [date(2019, 9, 1), date(2020, 3, 1)],
        "MEDICATION_START_DATE_TIME": [date(2019, 8, 1), date(2020, 2, 1)],
        # END_DATE patterns
        "END_DATE": [date(2021, 1, 1), date(2020, 11, 1)],
        "TREATMENT_END_DATE": [date(2021, 2, 1), date(2020, 10, 1)],
        "END_DATE_PROCEDURE": [date(2021, 3, 1), date(2020, 9, 1)],
        "MEDICATION_END_DATE_TIME": [date(2021, 4, 1), date(2020, 8, 1)],
        # Death date patterns
        "DATE_OF_DEATH": [date(2021, 5, 1), date(2020, 7, 1)],
        "DEATH_DATE": [date(2021, 6, 1), date(2020, 6, 15)],
        "PATIENT_DATE_OF_DEATH": [date(2021, 7, 1), date(2020, 5, 15)],
        "DEATH_DATE_RECORDED": [date(2021, 8, 1), date(2020, 4, 15)],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()
    min_date = date(2020, 1, 1)
    max_date = date(2020, 12, 31)

    # Check all START_DATE substring columns are adjusted to at least min_date
    start_date_cols = [
        "START_DATE",
        "TREATMENT_START_DATE",
        "START_DATE_PROCEDURE",
        "MEDICATION_START_DATE_TIME",
    ]
    for col in start_date_cols:
        for _, row in result.iterrows():
            assert row[col] >= min_date, f"Column {col} should be >= min_date"

    # Check all END_DATE substring columns are NULL if they were after max_date
    end_date_cols = [
        "END_DATE",
        "TREATMENT_END_DATE",
        "END_DATE_PROCEDURE",
        "MEDICATION_END_DATE_TIME",
    ]
    for col in end_date_cols:
        for _, row in result.iterrows():
            if pd.notna(row[col]):
                assert (
                    row[col] <= max_date
                ), f"Column {col} should be <= max_date or NULL"

    # Check all death date substring columns are NULL if they were after max_date
    death_date_cols = [
        "DATE_OF_DEATH",
        "DEATH_DATE",
        "PATIENT_DATE_OF_DEATH",
        "DEATH_DATE_RECORDED",
    ]
    for col in death_date_cols:
        for _, row in result.iterrows():
            if pd.notna(row[col]):
                assert (
                    row[col] <= max_date
                ), f"Column {col} should be <= max_date or NULL"


def test_multiple_end_date_columns():
    """Test handling of multiple columns containing END_DATE substring"""
    data = {
        "PERSON_ID": [1, 2, 3],
        "EVENT_DATE": [date(2020, 6, 1), date(2020, 7, 1), date(2020, 8, 1)],
        "TREATMENT_END_DATE": [date(2020, 12, 1), date(2021, 6, 1), date(2020, 12, 31)],
        "CONDITION_END_DATE": [date(2021, 1, 1), date(2020, 11, 1), date(2021, 5, 1)],
        "END_DATE_PROCEDURE": [date(2020, 10, 1), date(2021, 3, 1), date(2020, 11, 15)],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()
    max_date = date(2020, 12, 31)

    # Check that all END_DATE columns after max_date are NULL
    for _, row in result.iterrows():
        if pd.notna(row["TREATMENT_END_DATE"]):
            assert row["TREATMENT_END_DATE"] <= max_date
        if pd.notna(row["CONDITION_END_DATE"]):
            assert row["CONDITION_END_DATE"] <= max_date
        if pd.notna(row["END_DATE_PROCEDURE"]):
            assert row["END_DATE_PROCEDURE"] <= max_date


def test_no_relevant_columns():
    """Test that tables without relevant date columns are handled correctly"""
    data = {
        "PERSON_ID": [1, 2, 3],
        "SOME_VALUE": [10, 20, 30],
        "OTHER_COLUMN": ["A", "B", "C"],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()

    # Table should be unchanged since no relevant date columns exist
    pd.testing.assert_frame_equal(
        result.sort_values("PERSON_ID"), df.sort_values("PERSON_ID")
    )


def test_edge_case_boundary_dates():
    """Test behavior with dates exactly at the boundaries"""
    data = {
        "PERSON_ID": [1, 2],
        "EVENT_DATE": [date(2020, 1, 1), date(2020, 12, 31)],  # Exactly at boundaries
        "START_DATE": [date(2020, 1, 1), date(2019, 12, 31)],  # At and before boundary
        "END_DATE": [date(2020, 12, 31), date(2021, 1, 1)],  # At and after boundary
        "DATE_OF_DEATH": [
            date(2020, 12, 31),
            date(2021, 1, 1),
        ],  # At and after boundary
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()

    # Both rows should remain (EVENT_DATE filtering)
    assert len(result) == 2

    # Check boundary handling
    for _, row in result.iterrows():
        # START_DATE should be at least min_date
        assert row["START_DATE"] >= date(2020, 1, 1)

        # END_DATE after max_date should be NULL
        if row["PERSON_ID"] == 2:  # Second row had END_DATE after max_date
            assert pd.isna(row["END_DATE"])
        else:
            assert row["END_DATE"] == date(2020, 12, 31)

        # DATE_OF_DEATH after max_date should be NULL
        if row["PERSON_ID"] == 2:  # Second row had DATE_OF_DEATH after max_date
            assert pd.isna(row["DATE_OF_DEATH"])
        else:
            assert row["DATE_OF_DEATH"] == date(2020, 12, 31)


if __name__ == "__main__":
    # Run a simple test if executed directly
    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    sample_data = {
        "PERSON_ID": [1, 2, 3],
        "EVENT_DATE": [date(2019, 12, 15), date(2020, 6, 1), date(2021, 1, 15)],
        "START_DATE": [date(2019, 11, 1), date(2020, 5, 1), date(2019, 12, 1)],
        "END_DATE": [date(2020, 12, 1), date(2021, 6, 1), date(2020, 12, 31)],
    }


def test_substring_matching_patterns():
    """Test that substring matching works for various column name patterns"""
    data = {
        "PERSON_ID": [1, 2],
        "EVENT_DATE": [date(2020, 6, 1), date(2020, 7, 1)],
        # START_DATE patterns
        "START_DATE": [date(2019, 11, 1), date(2020, 5, 1)],
        "TREATMENT_START_DATE": [date(2019, 10, 1), date(2020, 4, 1)],
        "START_DATE_PROCEDURE": [date(2019, 9, 1), date(2020, 3, 1)],
        "MEDICATION_START_DATE_TIME": [date(2019, 8, 1), date(2020, 2, 1)],
        # END_DATE patterns
        "END_DATE": [date(2021, 1, 1), date(2020, 11, 1)],
        "TREATMENT_END_DATE": [date(2021, 2, 1), date(2020, 10, 1)],
        "END_DATE_PROCEDURE": [date(2021, 3, 1), date(2020, 9, 1)],
        "MEDICATION_END_DATE_TIME": [date(2021, 4, 1), date(2020, 8, 1)],
        # Death date patterns
        "DATE_OF_DEATH": [date(2021, 5, 1), date(2020, 7, 1)],
        "DEATH_DATE": [date(2021, 6, 1), date(2020, 6, 15)],
        "PATIENT_DATE_OF_DEATH": [date(2021, 7, 1), date(2020, 5, 15)],
        "DEATH_DATE_RECORDED": [date(2021, 8, 1), date(2020, 4, 15)],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()
    min_date = date(2020, 1, 1)
    max_date = date(2020, 12, 31)

    # Check all START_DATE substring columns are adjusted to at least min_date
    start_date_cols = [
        "START_DATE",
        "TREATMENT_START_DATE",
        "START_DATE_PROCEDURE",
        "MEDICATION_START_DATE_TIME",
    ]
    for col in start_date_cols:
        for _, row in result.iterrows():
            assert row[col] >= min_date, f"Column {col} should be >= min_date"

    # Check all END_DATE substring columns are NULL if they were after max_date
    end_date_cols = [
        "END_DATE",
        "TREATMENT_END_DATE",
        "END_DATE_PROCEDURE",
        "MEDICATION_END_DATE_TIME",
    ]
    for col in end_date_cols:
        for _, row in result.iterrows():
            if pd.notna(row[col]):
                assert (
                    row[col] <= max_date
                ), f"Column {col} should be <= max_date or NULL"

    # Check all death date substring columns are NULL if they were after max_date
    death_date_cols = [
        "DATE_OF_DEATH",
        "DEATH_DATE",
        "PATIENT_DATE_OF_DEATH",
        "DEATH_DATE_RECORDED",
    ]
    for col in death_date_cols:
        for _, row in result.iterrows():
            if pd.notna(row[col]):
                assert (
                    row[col] <= max_date
                ), f"Column {col} should be <= max_date or NULL"


def test_edge_case_boundary_dates():
    """Test behavior with dates exactly at the boundaries"""
    data = {
        "PERSON_ID": [1, 2],
        "EVENT_DATE": [date(2020, 1, 1), date(2020, 12, 31)],  # Exactly at boundaries
        "START_DATE": [date(2020, 1, 1), date(2019, 12, 31)],  # At and before boundary
        "END_DATE": [date(2020, 12, 31), date(2021, 1, 1)],  # At and after boundary
        "DATE_OF_DEATH": [
            date(2020, 12, 31),
            date(2021, 1, 1),
        ],  # At and after boundary
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()

    # Both rows should remain (EVENT_DATE filtering)
    assert len(result) == 2

    # Check boundary handling
    for _, row in result.iterrows():
        # START_DATE should be at least min_date
        assert row["START_DATE"] >= date(2020, 1, 1)

        # END_DATE after max_date should be NULL
        if row["PERSON_ID"] == 2:  # Second row had END_DATE after max_date
            assert pd.isna(row["END_DATE"])
        else:
            assert row["END_DATE"] == date(2020, 12, 31)

        # DATE_OF_DEATH after max_date should be NULL
        if row["PERSON_ID"] == 2:  # Second row had DATE_OF_DEATH after max_date
            assert pd.isna(row["DATE_OF_DEATH"])
        else:
            assert row["DATE_OF_DEATH"] == date(2020, 12, 31)


if __name__ == "__main__":
    # Run a simple test if executed directly
    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    sample_data = {
        "PERSON_ID": [1, 2, 3],
        "EVENT_DATE": [date(2019, 12, 15), date(2020, 6, 1), date(2021, 1, 15)],
        "START_DATE": [date(2019, 11, 1), date(2020, 5, 1), date(2019, 12, 1)],
        "END_DATE": [date(2020, 12, 1), date(2021, 6, 1), date(2020, 12, 31)],
    }

    df = pd.DataFrame(sample_data)
    table = ibis.memtable(df)

    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    filtered_table = node._execute({"TEST": table})

    result = filtered_table.to_pandas()
    print("Original data:")
    print(df)
    print("\nFiltered data:")
    print(result)
    print("\nTest completed successfully!")
