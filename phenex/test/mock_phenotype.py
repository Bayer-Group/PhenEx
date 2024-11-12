from typing import Dict
from ibis.expr.types.relations import Table
from phenex.phenotypes.phenotype import Phenotype
from phenex.tables import PhenotypeTable, is_phenex_phenotype_table


class MockPhenotype(Phenotype):
    """
    Used to mock the execution of a Phenotype for testing purposes.
    """

    def __init__(self, table):
        self.children = []
        assert is_phenex_phenotype_table(table)
        super(MockPhenotype, self).__init__()
        self.table = table

    def _execute(self, tables: Dict[str, Table]):
        """
        Executes the phenotype processing logic.

        Args:
            tables (Dict[str, Table]): A dictionary where the keys are table names and the values are Table objects.

        Raises:
            NotImplementedError: This method should be implemented by subclasses.
        """
        return self.table
