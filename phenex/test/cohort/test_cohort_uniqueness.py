"""
Test cohort node uniqueness validation
"""

import pytest
from phenex.phenotypes.cohort import Cohort
from phenex.phenotypes.codelist_phenotype import CodelistPhenotype
from phenex.codelists import Codelist


class TestCohortNodeUniqueness:
    """Test class for cohort node uniqueness validation"""

    def test_cohort_node_uniqueness_violation(self):
        """Test that cohort raises error when nodes have same name but different parameters"""

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

        # This should fail due to node uniqueness violation
        with pytest.raises(ValueError, match="Duplicate node name found"):
            Cohort(
                name="test_cohort",
                entry_criterion=entry1,
                inclusions=[entry2],  # Same name as entry, but different params
            )

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

        assert cohort.name == "test_cohort"
        assert cohort.entry_criterion == entry
        assert len(cohort.inclusions) == 1
        assert cohort.inclusions[0] == inclusion

    def test_cohort_multiple_stages_uniqueness_violation(self):
        """Test uniqueness validation across multiple cohort stages"""

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

        # This should fail due to node uniqueness violation
        with pytest.raises(ValueError, match="Duplicate node name found"):
            Cohort(
                name="test_cohort",
                entry_criterion=entry,
                inclusions=[inclusion],
                characteristics=[
                    characteristic
                ],  # Same name as entry, different params
            )
