import pytest
from phenex.sim import DomainsMocker
from phenex.mappers import OMOPDomains


class TestDomainsMocker:
    """Test class for DomainsMocker functionality."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # Use real OMOPDomains for testing
        self.domains_dict = OMOPDomains

        # Initialize DomainsMocker with small number of patients for fast testing
        self.mocker = DomainsMocker(
            domains_dict=self.domains_dict, n_patients=100, random_seed=42
        )

    def test_get_source_tables_returns_correct_tables(self):
        """Test that get_source_tables() returns the expected table names."""
        source_tables = self.mocker.get_source_tables()

        # Should return a dictionary
        assert isinstance(source_tables, dict)

        # Should have the expected OMOP table names as keys
        expected_tables = {
            "PERSON",
            "VISIT_OCCURRENCE",
            "CONDITION_OCCURRENCE",
            "DEATH",
        }
        actual_tables = set(source_tables.keys())

        # Check that we get the expected tables (could be subset or superset)
        assert expected_tables.issubset(
            actual_tables
        ), f"Missing tables: {expected_tables - actual_tables}"

    def test_get_mapped_tables_returns_correct_tables(self):
        """Test that get_mapped_tables() returns the expected table names."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Should return a dictionary
        assert isinstance(mapped_tables, dict)

        # Should have the expected OMOP table names as keys
        expected_tables = {
            "PERSON",
            "VISIT_OCCURRENCE",
            "CONDITION_OCCURRENCE",
            "DEATH",
        }
        actual_tables = set(mapped_tables.keys())

        # Check that we get the expected tables (could be subset or superset)
        assert expected_tables.issubset(
            actual_tables
        ), f"Missing tables: {expected_tables - actual_tables}"

    def test_person_table_has_expected_number_of_patients(self):
        """Test that the PERSON table has the expected number of patients."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Check that PERSON table exists
        assert "PERSON" in mapped_tables, "PERSON table not found in mapped tables"

        person_table = mapped_tables["PERSON"]
        person_df = person_table.table.to_pandas()

        # Check that the number of patients matches n_patients
        assert len(person_df) == 100, f"Expected 100 patients, but got {len(person_df)}"

    def test_patient_ids_are_consistent_across_tables(self):
        """Test that PERSON_ID values in other tables are subset of those in PERSON table."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Get the set of person IDs from the PERSON table
        assert "PERSON" in mapped_tables, "PERSON table not found in mapped tables"
        person_table = mapped_tables["PERSON"]
        person_df = person_table.table.to_pandas()
        person_ids = set(person_df["PERSON_ID"].values)

        # Tables that should have PERSON_ID column
        tables_with_person_id = ["VISIT_OCCURRENCE", "CONDITION_OCCURRENCE", "DEATH"]

        for table_name in tables_with_person_id:
            if table_name in mapped_tables:
                table = mapped_tables[table_name]
                table_df = table.table.to_pandas()

                if "PERSON_ID" in table_df.columns:
                    table_person_ids = set(table_df["PERSON_ID"].values)

                    # Check that all person IDs in this table are in the PERSON table
                    assert table_person_ids.issubset(person_ids), (
                        f"Table {table_name} has PERSON_ID values not found in PERSON table: "
                        f"{table_person_ids - person_ids}"
                    )

    def test_death_dates_are_after_birth_dates(self):
        """Test that all death dates occur after birth dates."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Check that both PERSON and DEATH tables exist
        assert "PERSON" in mapped_tables, "PERSON table not found in mapped tables"
        assert "DEATH" in mapped_tables, "DEATH table not found in mapped tables"

        person_df = mapped_tables["PERSON"].table.to_pandas()
        death_df = mapped_tables["DEATH"].table.to_pandas()

        # If no deaths, test passes trivially
        if len(death_df) == 0:
            return

        # Merge person and death data on PERSON_ID
        merged_df = death_df.merge(person_df, on="PERSON_ID", how="inner")

        # Create birth dates from year, month, day columns
        import pandas as pd

        birth_date_dict = {
            "year": merged_df["YEAR_OF_BIRTH"],
            "month": merged_df["MONTH_OF_BIRTH"],
            "day": merged_df["DAY_OF_BIRTH"],
        }
        merged_df["birth_date"] = pd.to_datetime(birth_date_dict)

        # Compare death dates with birth dates
        invalid_deaths = merged_df[merged_df["DEATH_DATE"] <= merged_df["birth_date"]]

        assert len(invalid_deaths) == 0, (
            f"Found {len(invalid_deaths)} patients with death dates on or before birth dates. "
            f"Person IDs: {invalid_deaths['PERSON_ID'].tolist()}"
        )


if __name__ == "__main__":
    # Allow running the test file directly
    pytest.main([__file__])
