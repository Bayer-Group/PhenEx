"""
Test cohort node uniqueness validation
"""

import pytest
from phenex.core.cohort import Cohort
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist

MOCK_TABLES = {"PERSON": None, "DRUG_EXPOSURE": None}


class TestCohortNodeUniqueness:
    """Test class for cohort node uniqueness validation"""

    def test_cohort_same_name_in_two_sections_is_allowed(self):
        """Same name in entry and inclusions, different definitions: allowed, two tables"""

        # Create two CodelistPhenotype nodes with the same name but different parameters
        entry1 = CodelistPhenotype(
            name="test_phenotype",
            return_date="first",
            codelist=Codelist(["code1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        entry2 = CodelistPhenotype(
            name="test_phenotype",  # Same name
            return_date="last",  # Different parameter
            codelist=Codelist(["code1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        # Allowed: entry and inclusions are different sections
        cohort = Cohort(
            name="test_cohort",
            entry_criterion=entry1,
            inclusions=[entry2],  # Same name as entry, but different params
        )
        cohort.build_stages(MOCK_TABLES)
        assert entry1.get_table_name() == "TEST_COHORT__ENTRY__TEST_PHENOTYPE"
        assert entry2.get_table_name() == "TEST_COHORT__INCLUSIONS__TEST_PHENOTYPE"

    def test_cohort_node_uniqueness_success(self):
        """Test that cohort allows nodes with same name and same parameters"""

        # Create two identical CodelistPhenotype nodes
        entry1 = CodelistPhenotype(
            name="test_phenotype1",
            return_date="first",
            codelist=Codelist(["code1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        entry2 = CodelistPhenotype(
            name="test_phenotype2",  # Same name
            return_date="first",  # Same parameters
            codelist=Codelist(["code1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        # This should succeed since the nodes are identical
        cohort = Cohort(
            name="test_cohort",
            entry_criterion=entry1,
            inclusions=[entry2],  # Same name and params as entry
        )
        cohort.build_stages(MOCK_TABLES)

        assert cohort.name == "test_cohort"
        assert cohort.entry_criterion == entry1
        assert len(cohort.inclusions) == 1
        assert cohort.inclusions[0] == entry2

    def test_cohort_different_node_names_success(self):
        """Test that cohort allows nodes with different names"""

        entry = CodelistPhenotype(
            name="entry_phenotype",
            return_date="first",
            codelist=Codelist(["code1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        inclusion = CodelistPhenotype(
            name="inclusion_phenotype",  # Different name
            return_date="last",
            codelist=Codelist(["code2"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        # This should succeed since the nodes have different names
        cohort = Cohort(
            name="test_cohort",
            entry_criterion=entry,
            inclusions=[inclusion],
        )
        cohort.build_stages(MOCK_TABLES)

        assert cohort.name == "test_cohort"
        assert cohort.entry_criterion == entry
        assert len(cohort.inclusions) == 1
        assert cohort.inclusions[0] == inclusion

    def test_cohort_same_name_in_entry_and_characteristics_is_allowed(self):
        """Same name in entry and characteristics: allowed, two tables"""

        entry = CodelistPhenotype(
            name="shared_phenotype",
            return_date="first",
            codelist=Codelist(["code1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        inclusion = CodelistPhenotype(
            name="inclusion_phenotype",
            return_date="first",
            codelist=Codelist(["code2"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        # Create a characteristic with same name as entry but different params
        characteristic = CodelistPhenotype(
            name="shared_phenotype",  # Same name as entry
            return_date="last",  # Different parameter
            codelist=Codelist(["code1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        # Allowed: entry and characteristics are different sections
        Cohort(
            name="test_cohort",
            entry_criterion=entry,
            inclusions=[inclusion],
            characteristics=[characteristic],  # Same name as entry, different params
        ).build_stages(MOCK_TABLES)
        assert entry.unique_name == "ENTRY__SHARED_PHENOTYPE"
        assert characteristic.unique_name == "CHARACTERISTICS__SHARED_PHENOTYPE"
