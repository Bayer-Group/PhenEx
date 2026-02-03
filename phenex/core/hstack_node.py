from typing import List, Dict, Optional
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.phenotypes.phenotype import Phenotype
from phenex.phenotypes.functions import hstack


class HStackNode(Node):
    """
    A compute node that horizontally stacks (joins) multiple phenotypes into a single table. Used for computing characteristics and outcomes tables in cohorts.
    """

    def __init__(
        self, name: str, phenotypes: List[Phenotype], join_table: Optional[Table] = None
    ):
        super(HStackNode, self).__init__(name=name)
        self.add_children(phenotypes)
        self.phenotypes = phenotypes
        self.join_table = join_table

    def _execute(self, tables: Dict[str, Table]) -> Table:
        """
        Execute all phenotypes and horizontally stack their results.

        Args:
            tables: Dictionary of table names to Table objects

        Returns:
            Table: Horizontally stacked table with all phenotype results
        """
        # Stack the phenotype tables horizontally
        return hstack(self.phenotypes, join_table=self.join_table)
