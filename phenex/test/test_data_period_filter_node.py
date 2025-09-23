"""
Tests for DataPeriodFilterNode to verify date filtering behavior.
"""

import pytest
import ibis
from datetime import date
import pandas as pd
from phenex.phenotypes.cohort import DataPeriodFilterNode
from phenex.filters import DateFilter
from phenex.filters.date_filter import AfterOrOn, BeforeOrOn, Before, After


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


# Tests for operator edge cases - moved from test_operator_edge_cases.py


def test_operator_edge_cases_death_dates():
    """
    Test that death date filtering respects the operator (< vs <=) properly.
    This is especially important for death dates where the boundary matters.

    Example scenarios:
    - If max_date is <= Jan 1, 2020, then deaths that occur on Jan 1 should be included.
    - If max_date is < Jan 1, 2020, then deaths that occur on Jan 1 should be set to null.
    """
    # Test data without EVENT_DATE to avoid initial filtering complications
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "DATE_OF_DEATH": [
            date(2019, 12, 31),
            date(2020, 1, 1),
            date(2020, 1, 2),
            date(2020, 12, 31),
        ],
        "DEATH_DATE": [
            date(2019, 12, 31),
            date(2020, 1, 1),
            date(2020, 1, 2),
            date(2020, 12, 31),
        ],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    # Test with BeforeOrOn (<=) - deaths ON Jan 1 should be INCLUDED
    date_filter_inclusive = DateFilter(
        min_date=AfterOrOn("2019-01-01"), max_date=BeforeOrOn("2020-01-01")
    )
    node_inclusive = DataPeriodFilterNode(
        name="test_node_inclusive", domain="TEST", date_filter=date_filter_inclusive
    )
    result_inclusive = node_inclusive._execute({"TEST": table}).to_pandas()

    # Check that death on Jan 1 is kept (not set to NULL)
    jan_1_rows = result_inclusive[result_inclusive["PERSON_ID"] == 2]
    assert len(jan_1_rows) == 1
    assert jan_1_rows.iloc[0]["DATE_OF_DEATH"] == date(2020, 1, 1)  # Should NOT be NULL
    assert jan_1_rows.iloc[0]["DEATH_DATE"] == date(2020, 1, 1)  # Should NOT be NULL

    # Check that death after Jan 1 is set to NULL
    jan_2_rows = result_inclusive[result_inclusive["PERSON_ID"] == 3]
    assert len(jan_2_rows) == 1
    assert pd.isna(jan_2_rows.iloc[0]["DATE_OF_DEATH"])  # Should be NULL (after Jan 1)
    assert pd.isna(jan_2_rows.iloc[0]["DEATH_DATE"])  # Should be NULL (after Jan 1)

    # Test with Before (<) - deaths ON Jan 1 should be EXCLUDED (set to NULL)
    date_filter_exclusive = DateFilter(
        min_date=AfterOrOn("2019-01-01"), max_date=Before("2020-01-01")
    )
    node_exclusive = DataPeriodFilterNode(
        name="test_node_exclusive", domain="TEST", date_filter=date_filter_exclusive
    )
    result_exclusive = node_exclusive._execute({"TEST": table}).to_pandas()

    # Check that death on Jan 1 is set to NULL (because it's not < Jan 1)
    jan_1_rows_excl = result_exclusive[result_exclusive["PERSON_ID"] == 2]
    assert len(jan_1_rows_excl) == 1
    assert pd.isna(
        jan_1_rows_excl.iloc[0]["DATE_OF_DEATH"]
    )  # Should be NULL (not < Jan 1)
    assert pd.isna(
        jan_1_rows_excl.iloc[0]["DEATH_DATE"]
    )  # Should be NULL (not < Jan 1)

    # Check that death before Jan 1 is kept
    dec_31_rows = result_exclusive[result_exclusive["PERSON_ID"] == 1]
    assert len(dec_31_rows) == 1
    assert dec_31_rows.iloc[0]["DATE_OF_DEATH"] == date(
        2019, 12, 31
    )  # Should NOT be NULL
    assert dec_31_rows.iloc[0]["DEATH_DATE"] == date(2019, 12, 31)  # Should NOT be NULL


def test_operator_edge_cases_end_dates():
    """
    Test that end date filtering respects the operator (< vs <=) properly.
    """
    # Test data without EVENT_DATE to avoid filtering complications
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "TREATMENT_END_DATE": [
            date(2020, 12, 30),
            date(2020, 12, 31),
            date(2021, 1, 1),
            date(2021, 1, 2),
        ],
        "CONDITION_END_DATE": [
            date(2020, 12, 30),
            date(2020, 12, 31),
            date(2021, 1, 1),
            date(2021, 1, 2),
        ],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    # Test with BeforeOrOn (<=) - end dates ON Dec 31 should be KEPT
    date_filter_inclusive = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node_inclusive = DataPeriodFilterNode(
        name="test_node_inclusive", domain="TEST", date_filter=date_filter_inclusive
    )
    result_inclusive = node_inclusive._execute({"TEST": table}).to_pandas()

    # Check that end date on Dec 31 is kept
    dec_31_rows = result_inclusive[result_inclusive["PERSON_ID"] == 2]
    assert len(dec_31_rows) == 1
    assert dec_31_rows.iloc[0]["TREATMENT_END_DATE"] == date(
        2020, 12, 31
    )  # Should NOT be NULL
    assert dec_31_rows.iloc[0]["CONDITION_END_DATE"] == date(
        2020, 12, 31
    )  # Should NOT be NULL

    # Check that end dates after Dec 31 are set to NULL
    jan_1_rows = result_inclusive[result_inclusive["PERSON_ID"] == 3]
    assert len(jan_1_rows) == 1
    assert pd.isna(jan_1_rows.iloc[0]["TREATMENT_END_DATE"])  # Should be NULL
    assert pd.isna(jan_1_rows.iloc[0]["CONDITION_END_DATE"])  # Should be NULL

    # Test with Before (<) - end dates ON Dec 31 should be EXCLUDED (set to NULL)
    date_filter_exclusive = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=Before("2020-12-31")
    )
    node_exclusive = DataPeriodFilterNode(
        name="test_node_exclusive", domain="TEST", date_filter=date_filter_exclusive
    )
    result_exclusive = node_exclusive._execute({"TEST": table}).to_pandas()

    # Check that end date on Dec 31 is set to NULL (because it's not < Dec 31)
    dec_31_rows_excl = result_exclusive[result_exclusive["PERSON_ID"] == 2]
    assert len(dec_31_rows_excl) == 1
    assert pd.isna(dec_31_rows_excl.iloc[0]["TREATMENT_END_DATE"])  # Should be NULL
    assert pd.isna(dec_31_rows_excl.iloc[0]["CONDITION_END_DATE"])  # Should be NULL

    # Check that end date before Dec 31 is kept
    dec_30_rows = result_exclusive[result_exclusive["PERSON_ID"] == 1]
    assert len(dec_30_rows) == 1
    assert dec_30_rows.iloc[0]["TREATMENT_END_DATE"] == date(
        2020, 12, 30
    )  # Should NOT be NULL
    assert dec_30_rows.iloc[0]["CONDITION_END_DATE"] == date(
        2020, 12, 30
    )  # Should NOT be NULL


def test_operator_edge_cases_start_dates():
    """
    Test that start date adjustment works correctly.
    Note: START_DATE adjustment should always use max(start_date, min_value)
    regardless of whether min_value operator is > or >=.
    """
    # Test data without EVENT_DATE to avoid filtering complications
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "TREATMENT_START_DATE": [
            date(2019, 12, 30),
            date(2019, 12, 31),
            date(2020, 1, 1),
            date(2020, 1, 2),
        ],
        "PROCEDURE_START_DATE": [
            date(2019, 12, 30),
            date(2019, 12, 31),
            date(2020, 1, 1),
            date(2020, 1, 2),
        ],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    # Test with AfterOrOn (>=) - start dates should be adjusted to at least Jan 1
    date_filter_inclusive = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node_inclusive = DataPeriodFilterNode(
        name="test_node_inclusive", domain="TEST", date_filter=date_filter_inclusive
    )
    result_inclusive = node_inclusive._execute({"TEST": table}).to_pandas()

    # All start dates should be at least Jan 1, 2020
    for _, row in result_inclusive.iterrows():
        assert row["TREATMENT_START_DATE"] >= date(2020, 1, 1)
        assert row["PROCEDURE_START_DATE"] >= date(2020, 1, 1)

    # Test with After (>) - start dates should be adjusted to at least the min_value.value
    date_filter_exclusive = DateFilter(
        min_date=After("2019-12-31"), max_date=BeforeOrOn("2020-12-31")
    )
    node_exclusive = DataPeriodFilterNode(
        name="test_node_exclusive", domain="TEST", date_filter=date_filter_exclusive
    )
    result_exclusive = node_exclusive._execute({"TEST": table}).to_pandas()

    # All start dates should be at least the min_value.value (2019-12-31)
    min_expected_date = date(2019, 12, 31)
    for _, row in result_exclusive.iterrows():
        assert row["TREATMENT_START_DATE"] >= min_expected_date
        assert row["PROCEDURE_START_DATE"] >= min_expected_date


def test_row_exclusion_end_date_before_min():
    """
    Test that rows with END_DATE strictly before min_date are excluded entirely.
    """
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "TREATMENT_END_DATE": [
            date(2019, 12, 30),
            date(2020, 1, 1),
            date(2020, 6, 15),
            date(2020, 12, 31),
        ],
        "OTHER_COLUMN": ["A", "B", "C", "D"],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    result = node._execute({"TEST": table}).to_pandas()

    # Person 1 should be excluded (END_DATE 2019-12-30 < min_date 2020-01-01)
    person_ids = result["PERSON_ID"].tolist()
    assert 1 not in person_ids, "Row with END_DATE before min_date should be excluded"

    # Other persons should remain
    assert 2 in person_ids
    assert 3 in person_ids
    assert 4 in person_ids


def test_row_exclusion_start_date_after_max():
    """
    Test that rows with START_DATE strictly after max_date are excluded entirely.
    """
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "TREATMENT_START_DATE": [
            date(2019, 6, 15),
            date(2020, 1, 1),
            date(2020, 12, 31),
            date(2021, 1, 2),
        ],
        "OTHER_COLUMN": ["A", "B", "C", "D"],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    date_filter = DateFilter(
        min_date=AfterOrOn("2020-01-01"), max_date=BeforeOrOn("2020-12-31")
    )
    node = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter
    )
    result = node._execute({"TEST": table}).to_pandas()

    # Person 4 should be excluded (START_DATE 2021-01-02 > max_date 2020-12-31)
    person_ids = result["PERSON_ID"].tolist()
    assert 4 not in person_ids, "Row with START_DATE after max_date should be excluded"

    # Other persons should remain
    assert 1 in person_ids
    assert 2 in person_ids
    assert 3 in person_ids
