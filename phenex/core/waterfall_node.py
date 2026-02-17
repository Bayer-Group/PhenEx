from typing import Dict
import ibis
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.reporting import Waterfall
from phenex.util import create_logger

logger = create_logger(__name__)


class WaterfallNode(Node):
    """
    A compute node that generates a Waterfall (attrition) report for a cohort.
    
    This node depends on the cohort's entry criterion, inclusions, and exclusions
    being computed and produces an Ibis table that can be materialized to the database.
    The pandas DataFrame report can be accessed via the waterfall property.
    """

    def __init__(self, name: str, cohort: "Cohort"):
        super(WaterfallNode, self).__init__(name=name)
        self.cohort = cohort
        self.reporter = Waterfall()
        
        # Add dependencies on entry, inclusions, and exclusions
        dependencies = [cohort.entry_criterion] + cohort.inclusions + cohort.exclusions
        if dependencies:
            self.add_children(dependencies)

    def _execute(self, tables: Dict[str, Table]):
        """
        Execute the Waterfall report generation.
        
        Args:
            tables: Dictionary of table names to Table objects (required by Node interface)
            
        Returns:
            Table: Ibis table containing the Waterfall report data (for materialization)
        """
        logger.debug(f"Generating Waterfall report for cohort '{self.cohort.name}'...")
        df = self.reporter.execute(self.cohort)
        logger.debug(f"Waterfall report generated for cohort '{self.cohort.name}'.")
        
        # Ensure all columns have explicit types for Ibis conversion
        # Convert object columns to strings and handle NaN values
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].fillna('').astype(str)
            elif df[col].dtype == 'float64':
                # Keep as float but replace NaN with None for Ibis
                df[col] = df[col].where(df[col].notna(), None)
            elif df[col].dtype == 'int64':
                # Convert to nullable Int64 to handle NaN
                df[col] = df[col].astype('Int64')
        
        # Create Ibis memtable
        table = ibis.memtable(df)
        return table

    @property
    def waterfall(self):
        """Get the generated Waterfall DataFrame with pretty formatting."""
        if self.table is not None:
            # If table is an Ibis table, convert to pandas
            if hasattr(self.table, 'execute'):
                df = self.table.execute()
            else:
                # Already a pandas DataFrame
                df = self.table
            
            # Apply pretty formatting
            self.reporter.df = df
            return self.reporter.get_pretty_display()
        return None
