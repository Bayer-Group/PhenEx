import datetime
import pandas as pd
import ibis
from phenex.phenotypes.cohort import HStackNode
from phenex.phenotypes import CodelistPhenotype, AgePhenotype
from phenex.codelists import Codelist
from phenex.test.phenotype_test_generator import PhenotypeTestGenerator


class HStackNodeTestGenerator(PhenotypeTestGenerator):
    """Test generator for HStackNode functionality."""

    name_space = "hstack_node"

    def define_input_tables(self):
        """Define input tables for the test."""
        # Create drug exposure data
        drug_exposure_data = pd.DataFrame(
            {
                "PERSON_ID": ["P1", "P2", "P3", "P1", "P2"],
                "EVENT_DATE": [
                    datetime.date(2020, 1, 1),
                    datetime.date(2020, 1, 2),
                    datetime.date(2020, 1, 3),
                    datetime.date(2020, 2, 1),
                    datetime.date(2020, 2, 2),
                ],
                "CODE": ["d1", "d1", "d1", "d2", "d2"],
                "CODE_TYPE": ["ICD10CM"] * 5,
                "VALUE": [1, 1, 1, 1, 1],
            }
        )

        # Create person data
        person_data = pd.DataFrame(
            {
                "PERSON_ID": ["P1", "P2", "P3"],
                "DATE_OF_BIRTH": [
                    datetime.date(1980, 1, 1),
                    datetime.date(1985, 1, 1),
                    datetime.date(1990, 1, 1),
                ],
                "INDEX_DATE": [
                    datetime.date(2020, 1, 1),
                    datetime.date(2020, 1, 2),
                    datetime.date(2020, 1, 3),
                ],
            }
        )

        return [
            {"name": "DRUG_EXPOSURE", "df": drug_exposure_data},
            {"name": "PERSON", "df": person_data},
        ]

    def define_phenotype_tests(self):
        """Define the phenotype tests for HStackNode."""
        # Create test phenotypes
        drug_phenotype = CodelistPhenotype(
            name="test_drug",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )

        age_phenotype = AgePhenotype(name="test_age", domain="PERSON")

        phenotypes = [drug_phenotype, age_phenotype]

        # Create a join table (simulating the index table from a cohort)
        join_table_data = pd.DataFrame(
            {
                "PERSON_ID": ["P1", "P2", "P3"],
                "INDEX_DATE": [
                    datetime.date(2020, 1, 1),
                    datetime.date(2020, 1, 2),
                    datetime.date(2020, 1, 3),
                ],
            }
        )
        join_table = ibis.memtable(join_table_data)

        # Create HStackNode
        hstack_node = HStackNode(
            name="test_hstack", phenotypes=phenotypes, join_table=join_table
        )

        # Define expected results
        # P1: has drug d1, age 40 (born 1980, index 2020)
        # P2: has drug d1, age 35 (born 1985, index 2020)
        # P3: has drug d1, age 30 (born 1990, index 2020)
        test_info = {
            "name": "hstack_basic_test",
            "persons": ["P1", "P2", "P3"],
            "phenotype": hstack_node,
        }

        return [test_info]


def test_hstack_node():
    """Run the HStackNode test generator."""
    hsg = HStackNodeTestGenerator()
    hsg.run_tests()


if __name__ == "__main__":
    test_hstack_node()
