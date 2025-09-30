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

    # Check that death after Jan 1 is set to NULL
    jan_2_rows = result_inclusive[result_inclusive["PERSON_ID"] == 3]
    assert len(jan_2_rows) == 1
    assert pd.isna(jan_2_rows.iloc[0]["DATE_OF_DEATH"])  # Should be NULL (after Jan 1)

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

    # Check that death before Jan 1 is kept
    dec_31_rows = result_exclusive[result_exclusive["PERSON_ID"] == 1]
    assert len(dec_31_rows) == 1
    assert dec_31_rows.iloc[0]["DATE_OF_DEATH"] == date(
        2019, 12, 31
    )  # Should NOT be NULL


def test_operator_edge_cases_end_dates():
    """
    Test that end date filtering respects the operator (< vs <=) properly.
    """
    # Test data without EVENT_DATE to avoid filtering complications
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "END_DATE": [
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
    assert dec_31_rows.iloc[0]["END_DATE"] == date(2020, 12, 31)  # Should NOT be NULL

    # Check that end dates after Dec 31 are set to NULL
    jan_1_rows = result_inclusive[result_inclusive["PERSON_ID"] == 3]
    assert len(jan_1_rows) == 1
    assert pd.isna(jan_1_rows.iloc[0]["END_DATE"])  # Should be NULL

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
    assert pd.isna(dec_31_rows_excl.iloc[0]["END_DATE"])  # Should be NULL

    # Check that end date before Dec 31 is kept
    dec_30_rows = result_exclusive[result_exclusive["PERSON_ID"] == 1]
    assert len(dec_30_rows) == 1
    assert dec_30_rows.iloc[0]["END_DATE"] == date(2020, 12, 30)  # Should NOT be NULL


def test_operator_edge_cases_start_dates():
    """
    Test that start date adjustment works correctly with different operators.
    START_DATE adjustment should use max(start_date, min_value) for both > and >= operators.
    """
    # Test data without EVENT_DATE to avoid filtering complications
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "START_DATE": [
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
        assert row["START_DATE"] >= date(2020, 1, 1)

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
        assert row["START_DATE"] >= min_expected_date


def test_invalid_column_name_error():
    """
    Test that DataPeriodFilterNode raises ValueError for non-EVENT_DATE column names.
    """
    # Should work with EVENT_DATE
    date_filter_valid = DateFilter(
        min_date=AfterOrOn("2020-01-01"),
        max_date=BeforeOrOn("2020-12-31"),
        column_name="EVENT_DATE",
    )
    node_valid = DataPeriodFilterNode(
        name="test_node", domain="TEST", date_filter=date_filter_valid
    )
    # Should not raise an error
    assert node_valid.date_filter.column_name == "EVENT_DATE"

    # Should raise error with non-EVENT_DATE column name
    date_filter_invalid = DateFilter(
        min_date=AfterOrOn("2020-01-01"),
        max_date=BeforeOrOn("2020-12-31"),
        column_name="DIAGNOSIS_DATE",  # Invalid column name
    )

    with pytest.raises(
        ValueError,
        match="DataPeriodFilterNode only supports filtering by EVENT_DATE column",
    ):
        DataPeriodFilterNode(
            name="test_node", domain="TEST", date_filter=date_filter_invalid
        )


def test_operator_edge_cases_comprehensive():
    """
    Test comprehensive coverage of operator edge cases for all supported operators.
    This ensures our operator handling logic works correctly for > vs >= and < vs <=.
    """
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "START_DATE": [
            date(2019, 12, 31),  # Before boundary
            date(2020, 1, 1),  # On boundary
            date(2020, 6, 15),  # Within range
            date(2020, 12, 31),  # On boundary
        ],
        "END_DATE": [
            date(2020, 1, 1),  # On boundary
            date(2020, 6, 15),  # Within range
            date(2020, 12, 31),  # On boundary
            date(2021, 1, 1),  # After boundary
        ],
        "DATE_OF_DEATH": [
            date(2020, 1, 1),  # On boundary
            date(2020, 6, 15),  # Within range
            date(2020, 12, 31),  # On boundary
            date(2021, 1, 1),  # After boundary
        ],
    }

    df = pd.DataFrame(data)
    table = ibis.memtable(df)

    # Test all supported operator combinations
    test_cases = [
        (AfterOrOn("2020-01-01"), BeforeOrOn("2020-12-31"), ">=", "<="),
        (After("2019-12-31"), Before("2021-01-01"), ">", "<"),
        (AfterOrOn("2020-01-01"), Before("2021-01-01"), ">=", "<"),
        (After("2019-12-31"), BeforeOrOn("2020-12-31"), ">", "<="),
    ]

    for min_date, max_date, min_op, max_op in test_cases:
        date_filter = DateFilter(min_date=min_date, max_date=max_date)
        node = DataPeriodFilterNode(
            name=f"test_node_{min_op}_{max_op}", domain="TEST", date_filter=date_filter
        )
        result = node._execute({"TEST": table}).to_pandas()

        # Verify the operations completed without error
        assert len(result) > 0, f"No results for operators {min_op}/{max_op}"

        # Verify START_DATE adjustments
        min_expected = min_date.value
        for _, row in result.iterrows():
            assert (
                row["START_DATE"] >= min_expected
            ), f"START_DATE not properly adjusted for {min_op}"

        # Verify END_DATE and DATE_OF_DEATH nullification
        max_expected = max_date.value
        for _, row in result.iterrows():
            if pd.notna(row["END_DATE"]):
                if max_op == "<=":
                    assert (
                        row["END_DATE"] <= max_expected
                    ), f"END_DATE not properly handled for {max_op}"
                else:  # max_op == "<"
                    assert (
                        row["END_DATE"] < max_expected
                    ), f"END_DATE not properly handled for {max_op}"

            if pd.notna(row["DATE_OF_DEATH"]):
                if max_op == "<=":
                    assert (
                        row["DATE_OF_DEATH"] <= max_expected
                    ), f"DATE_OF_DEATH not properly handled for {max_op}"
                else:  # max_op == "<"
                    assert (
                        row["DATE_OF_DEATH"] < max_expected
                    ), f"DATE_OF_DEATH not properly handled for {max_op}"


def test_row_exclusion_end_date_before_min():
    """
    Test that rows with END_DATE strictly before min_date are excluded entirely.
    """
    data = {
        "PERSON_ID": [1, 2, 3, 4],
        "END_DATE": [
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
        "START_DATE": [
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
