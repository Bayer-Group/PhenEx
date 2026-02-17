from typing import Dict
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.reporting import Table1
from phenex.util import create_logger

logger = create_logger(__name__)


class Table1Node(Node):
    """
    A compute node that generates a Table1 (baseline characteristics) report for a cohort.
    
    This node depends on the cohort's characteristics being computed and produces a 
    pandas DataFrame containing summary statistics for all baseline characteristics.
    """

    def __init__(self, name: str, cohort: "Cohort"):
        super(Table1Node, self).__init__(name=name)
        self.cohort = cohort
        self.reporter = Table1()
        self._table1_df = None
        
        # Add dependencies on characteristics if they exist
        if cohort.characteristics:
            self.add_children(cohort.characteristics)

    def _execute(self, tables: Dict[str, Table]):
        """
        Execute the Table1 report generation.
        
        Args:
            tables: Dictionary of table names to Table objects (required by Node interface)
            
        Returns:
            Table: Returns None as Table1 produces a pandas DataFrame, not an Ibis Table
        """
        logger.debug(f"Generating Table1 report for cohort '{self.cohort.name}'...")
        self.reporter.execute(self.cohort)
        self._table1_df = self.reporter.get_pretty_display()
        logger.debug(f"Table1 report generated for cohort '{self.cohort.name}'.")
        # Return None since Table1 produces a DataFrame, not an Ibis Table
        return None

    @property
    def table1(self):
        """Get the generated Table1 DataFrame."""
        return self._table1_df
