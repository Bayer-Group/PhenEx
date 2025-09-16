import pytest
from phenex.sim import DomainsMocker
from phenex.mappers import OMOPDomains


class TestDomainsMocker:
    """Test class for DomainsMocker functionality."""

    def setup_method(self):
        """Set up test fixtures before each test method."""
        # Set global random seed for reproducible tests
        import numpy as np
        import random

        np.random.seed(42)
        random.seed(42)

        # Use real OMOPDomains for testing
        self.domains_dict = OMOPDomains

        # Initialize DomainsMocker with larger number of patients for thorough testing
        self.mocker = DomainsMocker(
            domains_dict=self.domains_dict, n_patients=500, random_seed=42
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
        assert (
            len(person_df) == self.mocker.n_patients
        ), f"Expected {self.mocker.n_patients} patients, but got {len(person_df)}"

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

    def test_condition_start_dates_are_within_patient_lifespan(self):
        """Test that all condition start dates occur after birth dates and before death dates (if applicable)."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Check that required tables exist
        assert "PERSON" in mapped_tables, "PERSON table not found in mapped tables"
        assert (
            "CONDITION_OCCURRENCE" in mapped_tables
        ), "CONDITION_OCCURRENCE table not found in mapped tables"

        person_df = mapped_tables["PERSON"].table.to_pandas()
        condition_df = mapped_tables["CONDITION_OCCURRENCE"].table.to_pandas()

        # If no conditions, test passes trivially
        if len(condition_df) == 0:
            return

        # Merge condition and person data on PERSON_ID
        merged_df = condition_df.merge(person_df, on="PERSON_ID", how="inner")

        # Create birth dates from year, month, day columns
        import pandas as pd

        birth_date_dict = {
            "year": merged_df["YEAR_OF_BIRTH"],
            "month": merged_df["MONTH_OF_BIRTH"],
            "day": merged_df["DAY_OF_BIRTH"],
        }
        merged_df["birth_date"] = pd.to_datetime(birth_date_dict)

        # Check conditions that occur on or before birth date
        invalid_conditions = merged_df[
            merged_df["CONDITION_START_DATE"] <= merged_df["birth_date"]
        ]

        assert len(invalid_conditions) == 0, (
            f"Found {len(invalid_conditions)} conditions with start dates on or before birth dates. "
            f"Person IDs: {invalid_conditions['PERSON_ID'].tolist()}"
        )

        # Also check against death dates if DEATH table exists
        if "DEATH" in mapped_tables:
            death_df = mapped_tables["DEATH"].table.to_pandas()

            # If there are deaths, merge with condition data
            if len(death_df) > 0:
                # Merge with death data (inner join - only check conditions for patients who died)
                merged_with_death = merged_df.merge(
                    death_df, on="PERSON_ID", how="inner"
                )

                if len(merged_with_death) > 0:
                    # Check conditions that occur after death date
                    invalid_post_death = merged_with_death[
                        merged_with_death["CONDITION_START_DATE"]
                        > merged_with_death["DEATH_DATE"]
                    ]

                    assert len(invalid_post_death) == 0, (
                        f"Found {len(invalid_post_death)} conditions with start dates after death dates. "
                        f"Person IDs: {invalid_post_death['PERSON_ID'].tolist()}"
                    )

    def test_visit_start_dates_are_within_patient_lifespan(self):
        """Test that all visit start dates occur after birth dates and before death dates (if applicable)."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Check that required tables exist
        assert "PERSON" in mapped_tables, "PERSON table not found in mapped tables"
        assert (
            "VISIT_OCCURRENCE" in mapped_tables
        ), "VISIT_OCCURRENCE table not found in mapped tables"

        person_df = mapped_tables["PERSON"].table.to_pandas()
        visit_df = mapped_tables["VISIT_OCCURRENCE"].table.to_pandas()

        # If no visits, test passes trivially
        if len(visit_df) == 0:
            return

        # Merge visit and person data on PERSON_ID
        merged_df = visit_df.merge(person_df, on="PERSON_ID", how="inner")

        # Create birth dates from year, month, day columns
        import pandas as pd

        birth_date_dict = {
            "year": merged_df["YEAR_OF_BIRTH"],
            "month": merged_df["MONTH_OF_BIRTH"],
            "day": merged_df["DAY_OF_BIRTH"],
        }
        merged_df["birth_date"] = pd.to_datetime(birth_date_dict)

        # Check visits that occur on or before birth date
        invalid_visits = merged_df[
            merged_df["VISIT_START_DATE"] <= merged_df["birth_date"]
        ]

        assert len(invalid_visits) == 0, (
            f"Found {len(invalid_visits)} visits with start dates on or before birth dates. "
            f"Person IDs: {invalid_visits['PERSON_ID'].tolist()}"
        )

        # Also check against death dates if DEATH table exists
        if "DEATH" in mapped_tables:
            death_df = mapped_tables["DEATH"].table.to_pandas()

            if len(death_df) > 0:
                merged_with_death = merged_df.merge(
                    death_df, on="PERSON_ID", how="inner"
                )

                if len(merged_with_death) > 0:
                    invalid_post_death = merged_with_death[
                        merged_with_death["VISIT_START_DATE"]
                        > merged_with_death["DEATH_DATE"]
                    ]

                    assert len(invalid_post_death) == 0, (
                        f"Found {len(invalid_post_death)} visits with start dates after death dates. "
                        f"Person IDs: {invalid_post_death['PERSON_ID'].tolist()}"
                    )

    def test_drug_exposure_start_dates_are_within_patient_lifespan(self):
        """Test that all drug exposure start dates occur after birth dates and before death dates (if applicable)."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Check that required tables exist
        assert "PERSON" in mapped_tables, "PERSON table not found in mapped tables"
        assert (
            "DRUG_EXPOSURE" in mapped_tables
        ), "DRUG_EXPOSURE table not found in mapped tables"

        person_df = mapped_tables["PERSON"].table.to_pandas()
        drug_df = mapped_tables["DRUG_EXPOSURE"].table.to_pandas()

        # If no drugs, test passes trivially
        if len(drug_df) == 0:
            return

        # Merge drug and person data on PERSON_ID
        merged_df = drug_df.merge(person_df, on="PERSON_ID", how="inner")

        # Create birth dates from year, month, day columns
        import pandas as pd

        birth_date_dict = {
            "year": merged_df["YEAR_OF_BIRTH"],
            "month": merged_df["MONTH_OF_BIRTH"],
            "day": merged_df["DAY_OF_BIRTH"],
        }
        merged_df["birth_date"] = pd.to_datetime(birth_date_dict)

        # Check drugs that occur on or before birth date
        invalid_drugs = merged_df[
            merged_df["DRUG_EXPOSURE_START_DATE"] <= merged_df["birth_date"]
        ]

        assert len(invalid_drugs) == 0, (
            f"Found {len(invalid_drugs)} drug exposures with start dates on or before birth dates. "
            f"Person IDs: {invalid_drugs['PERSON_ID'].tolist()}"
        )

        # Also check against death dates if DEATH table exists
        if "DEATH" in mapped_tables:
            death_df = mapped_tables["DEATH"].table.to_pandas()

            if len(death_df) > 0:
                merged_with_death = merged_df.merge(
                    death_df, on="PERSON_ID", how="inner"
                )

                if len(merged_with_death) > 0:
                    invalid_post_death = merged_with_death[
                        merged_with_death["DRUG_EXPOSURE_START_DATE"]
                        > merged_with_death["DEATH_DATE"]
                    ]

                    assert len(invalid_post_death) == 0, (
                        f"Found {len(invalid_post_death)} drug exposures with start dates after death dates. "
                        f"Person IDs: {invalid_post_death['PERSON_ID'].tolist()}"
                    )

    def test_procedure_dates_are_within_patient_lifespan(self):
        """Test that all procedure dates occur after birth dates and before death dates (if applicable)."""
        mapped_tables = self.mocker.get_mapped_tables()

        # Check that required tables exist
        assert "PERSON" in mapped_tables, "PERSON table not found in mapped tables"
        assert (
            "PROCEDURE_OCCURRENCE" in mapped_tables
        ), "PROCEDURE_OCCURRENCE table not found in mapped tables"

        person_df = mapped_tables["PERSON"].table.to_pandas()
        procedure_df = mapped_tables["PROCEDURE_OCCURRENCE"].table.to_pandas()

        # If no procedures, test passes trivially
        if len(procedure_df) == 0:
            return

        # Merge procedure and person data on PERSON_ID
        merged_df = procedure_df.merge(person_df, on="PERSON_ID", how="inner")

        # Create birth dates from year, month, day columns
        import pandas as pd

        birth_date_dict = {
            "year": merged_df["YEAR_OF_BIRTH"],
            "month": merged_df["MONTH_OF_BIRTH"],
            "day": merged_df["DAY_OF_BIRTH"],
        }
        merged_df["birth_date"] = pd.to_datetime(birth_date_dict)

        # Check procedures that occur on or before birth date
        invalid_procedures = merged_df[
            merged_df["PROCEDURE_DATE"] <= merged_df["birth_date"]
        ]

        assert len(invalid_procedures) == 0, (
            f"Found {len(invalid_procedures)} procedures with dates on or before birth dates. "
            f"Person IDs: {invalid_procedures['PERSON_ID'].tolist()}"
        )

        # Also check against death dates if DEATH table exists
        if "DEATH" in mapped_tables:
            death_df = mapped_tables["DEATH"].table.to_pandas()

            if len(death_df) > 0:
                merged_with_death = merged_df.merge(
                    death_df, on="PERSON_ID", how="inner"
                )

                if len(merged_with_death) > 0:
                    invalid_post_death = merged_with_death[
                        merged_with_death["PROCEDURE_DATE"]
                        > merged_with_death["DEATH_DATE"]
                    ]

                    assert len(invalid_post_death) == 0, (
                        f"Found {len(invalid_post_death)} procedures with dates after death dates. "
                        f"Person IDs: {invalid_post_death['PERSON_ID'].tolist()}"
                    )


if __name__ == "__main__":
    # Allow running the test file directly
    pytest.main([__file__])
