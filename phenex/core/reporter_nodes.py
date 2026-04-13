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
        table = ibis.memtable(self._normalize_df(df))
        return table

    @staticmethod
    def _normalize_df(df):
        """Normalize DataFrame column types for Ibis compatibility."""
        for col in df.columns:
            if df[col].dtype == "object":
                df[col] = df[col].fillna("").astype(str)
            elif df[col].dtype == "float64":
                df[col] = df[col].where(df[col].notna(), None)
            elif df[col].dtype == "int64":
                df[col] = df[col].astype("Int64")
        return df

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

    def to_json(self, path: str):
        """Export to JSON. Ensures reporter.df is populated (handles cached/lazy nodes)."""
        if self.table is not None:
            _ = self.df_report  # populates self.reporter.df from self.table
            self.reporter.to_json(path)


class Table1Node(Reporter):
    """
    A compute node that generates a Table1 (baseline characteristics) report for a cohort.

    This node depends on the cohort's characteristics being computed and produces an
    Ibis table that can be materialized to the database. The pandas DataFrame report
    can be accessed via the table1 property.

    Parameters:
        include_component_phenotypes_level: Passed through to :class:`Table1`.  When
            set, component child phenotypes are expanded inline in the report.
    """

    def __init__(
        self, name: str, cohort: "Cohort", include_component_phenotypes_level=None
    ):
        super(Table1Node, self).__init__(name=name, cohort=cohort)
        self.reporter = Table1(
            include_component_phenotypes_level=include_component_phenotypes_level
        )

        # Add dependencies on characteristics if they exist
        if cohort.characteristics:
            self.add_children(cohort.characteristics)

    def to_json(self, path: str):
        """Export Table1 to JSON, propagating section metadata from the cohort."""
        if self.table is not None:
            _ = self.df_report  # populates self.reporter.df
            # Ensure section metadata is available even for cached/lazy nodes
            self.reporter.characteristic_sections = getattr(
                self.cohort, "characteristic_sections", None
            )
            self.reporter.to_json(path)


class Table1OutcomesNode(Reporter):
    """
    A compute node that generates a Table1 report for a cohort's outcomes.

    Identical to Table1Node but operates on cohort.outcomes instead of
    cohort.characteristics.

    Parameters:
        include_component_phenotypes_level: Passed through to :class:`Table1`.  When
            set, component child phenotypes are expanded inline in the report.
    """

    def __init__(
        self, name: str, cohort: "Cohort", include_component_phenotypes_level=None
    ):
        super(Table1OutcomesNode, self).__init__(name=name, cohort=cohort)
        self.reporter = Table1(
            name="Table1Outcomes",
            include_component_phenotypes_level=include_component_phenotypes_level,
        )

        if cohort.outcomes:
            self.add_children(cohort.outcomes)

    def _execute(self, tables: Dict[str, Table]):
        logger.debug(
            f"Generating {self.name} outcomes report for cohort '{self.cohort.name}'..."
        )
        self.reporter.execute(self.cohort, phenotypes=self.cohort.outcomes)
        self.reporter.characteristic_sections = getattr(
            self.cohort, "outcome_sections", None
        )
        df = self.reporter.df
        logger.debug(
            f"{self.name} outcomes report generated for cohort '{self.cohort.name}'."
        )
        return ibis.memtable(self._normalize_df(df))

    def to_json(self, path: str):
        """Export Table1 outcomes to JSON, propagating outcome section metadata."""
        if self.table is not None:
            _ = self.df_report  # populates self.reporter.df
            self.reporter.characteristic_sections = getattr(
                self.cohort, "outcome_sections", None
            )
            self.reporter.to_json(path)


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


class CustomReporterNode(Reporter):
    """
    A compute node that wraps a custom reporter for inclusion in the cohort execution graph.

    The node depends on both characteristics and outcomes (if present), ensuring the
    reporter executes after all phenotypes are computed.
    """

    def __init__(self, name: str, cohort: "Cohort", reporter):
        super(CustomReporterNode, self).__init__(name=name, cohort=cohort)
        self.reporter = reporter

        # Add characteristics and outcomes as children so they execute first
        children = list(cohort.characteristics or []) + list(cohort.outcomes or [])
        if children:
            self.add_children(children)

    def _execute(self, tables: Dict[str, Table]):
        logger.debug(
            f"Generating custom report '{self.reporter.name}' for cohort '{self.cohort.name}'..."
        )
        self.reporter.execute(self.cohort)
        logger.debug(
            f"Custom report '{self.reporter.name}' generated for cohort '{self.cohort.name}'."
        )
        if (
            hasattr(self.reporter, "df")
            and self.reporter.df is not None
            and len(self.reporter.df) > 0
        ):
            return ibis.memtable(self._normalize_df(self.reporter.df.copy()))
        return None

    @property
    def df_report(self):
        """Get the formatted report DataFrame."""
        if self.table is not None:
            if hasattr(self.reporter, "get_pretty_display"):
                return self.reporter.get_pretty_display()
            if hasattr(self.table, "execute"):
                return self.table.execute()
            return self.table
        return None

    def _ensure_reporter_executed(self):
        """Run reporter.execute() if the reporter has not yet produced results (e.g. lazy/cached execution)."""
        if not hasattr(self.reporter, "df") or self.reporter.df is None:
            self.reporter.execute(self.cohort)

    def to_excel(self, path: str):
        """Delegate to the wrapped reporter's to_excel."""
        self._ensure_reporter_executed()
        self.reporter.to_excel(path)

    def to_json(self, path: str):
        """Delegate to the wrapped reporter's to_json."""
        self._ensure_reporter_executed()
        self.reporter.to_json(path)

    def to_html(self, path: str):
        """Delegate to the wrapped reporter's to_html, if implemented."""
        if hasattr(self.reporter, "to_html"):
            self._ensure_reporter_executed()
            self.reporter.to_html(path)

    def to_png(self, path: str):
        """Delegate to the wrapped reporter's to_png, if implemented."""
        if hasattr(self.reporter, "to_png"):
            self._ensure_reporter_executed()
            self.reporter.to_png(path)
