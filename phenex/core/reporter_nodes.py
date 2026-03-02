from typing import Dict
import ibis
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.reporting import Table1, Waterfall
from phenex.util import create_logger

logger = create_logger(__name__)


class Reporter(Node):
    """
    A compute node that generates a Table1 (baseline characteristics) report for a cohort.

    This node depends on the cohort's characteristics being computed and produces an
    Ibis table that can be materialized to the database. The pandas DataFrame report
    can be accessed via the table1 property.
    """

    def __init__(self, name: str, cohort: "Cohort"):
        super(Reporter, self).__init__(name=name)
        self.cohort = cohort

    def _execute(self, tables: Dict[str, Table]):
        """
        Execute the Table1 report generation.

        Args:
            tables: Dictionary of table names to Table objects (required by Node interface)

        Returns:
            Table: Ibis table containing the Table1 report data (for materialization)
        """
        logger.debug(
            f"Generating {self.name} report for cohort '{self.cohort.name}'..."
        )
        self.reporter.execute(self.cohort)
        df = self.reporter.df
        logger.debug(f"{self.name} report generated for cohort '{self.cohort.name}'.")

        # Ensure all columns have explicit types for Ibis conversion
        # Convert object columns to strings and handle NaN values
        for col in df.columns:
            if df[col].dtype == "object":
                df[col] = df[col].fillna("").astype(str)
            elif df[col].dtype == "float64":
                # Keep as float but replace NaN with None for Ibis
                df[col] = df[col].where(df[col].notna(), None)
            elif df[col].dtype == "int64":
                # Convert to nullable Int64 to handle NaN
                df[col] = df[col].astype("Int64")

        table = ibis.memtable(df)
        return table

    @property
    def df_report(self):
        """Get the generated Table1 DataFrame with pretty formatting."""
        if self.table is not None:
            # If table is an Ibis table, convert to pandas
            if hasattr(self.table, "execute"):
                df = self.table.execute()
            else:
                # Already a pandas DataFrame
                df = self.table

            # Apply pretty formatting
            self.reporter.df = df
            return self.reporter.get_pretty_display()
        return None

    def to_excel(self, path: str):
        """Export to Excel. Ensures reporter.df is populated (handles cached/lazy nodes)."""
        if self.table is not None:
            _ = self.df_report  # populates self.reporter.df from self.table
            self.reporter.to_excel(path)


class Table1Node(Reporter):
    """
    A compute node that generates a Table1 (baseline characteristics) report for a cohort.

    This node depends on the cohort's characteristics being computed and produces an
    Ibis table that can be materialized to the database. The pandas DataFrame report
    can be accessed via the table1 property.
    """

    def __init__(self, name: str, cohort: "Cohort"):
        super(Table1Node, self).__init__(name=name, cohort=cohort)
        self.reporter = Table1()

        # Add dependencies on characteristics if they exist
        if cohort.characteristics:
            self.add_children(cohort.characteristics)


class WaterfallNode(Reporter):
    """
    A compute node that generates a Waterfall (attrition) report for a cohort.

    This node depends on the cohort's entry criterion, inclusions, and exclusions
    being computed and produces an Ibis table that can be materialized to the database.
    The pandas DataFrame report can be accessed via the waterfall property.
    """

    def __init__(
        self,
        name: str,
        cohort: "Cohort",
        index_table_node: "Node",
        include_component_phenotypes_level: int = None,
    ):
        super(WaterfallNode, self).__init__(name=name, cohort=cohort)
        self.reporter = Waterfall(
            include_component_phenotypes_level=include_component_phenotypes_level
        )

        # Add dependency on index_table_node to ensure it executes first
        self.add_children([index_table_node])

    @property
    def df_report(self):
        """Get the formatted waterfall DataFrame (without color column)."""
        if self.table is not None:
            if hasattr(self.table, "execute"):
                df = self.table.execute()
            else:
                df = self.table
            self.reporter.df = df
            result = self.reporter.get_pretty_display(color=False)
            return result.drop(columns=["_color"], errors="ignore")
        return None
