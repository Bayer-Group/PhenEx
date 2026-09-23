import json
from typing import Dict
import ibis
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.reporting import Table1, Waterfall
from phenex.util import create_logger

logger = create_logger(__name__)

# Table1's histograms are not part of its DataFrame, so they are saved as JSON
# in this extra column and read back with it.
_KDES_COLUMN = "_KDES"


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

    # def to_dict(self):
    #     """Exclude cohort from serialization to avoid hashing the entire Cohort object."""
    #     d = super().to_dict()
    #     # d.pop("cohort", None)
    #     return d

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
        return self._report_table(df)

    def _report_table(self, df):
        """The table to save: the report, plus Table1's histograms if it has any."""
        df = self._normalize_df(df)
        distributions = getattr(self.reporter, "_value_distributions", None)
        if distributions and len(df):
            df = df.copy()
            df[_KDES_COLUMN] = ""
            df.iloc[0, df.columns.get_loc(_KDES_COLUMN)] = json.dumps(distributions)
        return ibis.memtable(df)

    def _read_report_df(self):
        """The saved report. Histograms saved with it go back onto the reporter."""
        df = self.table.execute() if hasattr(self.table, "execute") else self.table
        if _KDES_COLUMN in df.columns:
            saved = next(
                (v for v in df[_KDES_COLUMN] if isinstance(v, str) and v), None
            )
            self.reporter._value_distributions = json.loads(saved) if saved else {}
            df = df.drop(columns=[_KDES_COLUMN])
        return df

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
            self.reporter.df = self._read_report_df()
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

    def to_dict(self):
        """The definition, plus which format the saved table is in. Bumping it
        rebuilds tables that were saved without histograms, once."""
        return {**super().to_dict(), "saved_format": 2}

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

    def to_dict(self):
        """The definition, plus which format the saved table is in (see Table1Node)."""
        return {**super().to_dict(), "saved_format": 2}

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
        return self._report_table(df)

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
        self._run_reporter()
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
            self._ensure_reporter_df()
            if hasattr(self.reporter, "get_pretty_display"):
                return self.reporter.get_pretty_display()
            if hasattr(self.table, "execute"):
                return self.table.execute()
            return self.table
        return None

    def _report_target(self):
        """What the reporter runs on."""
        return self.cohort

    # A study-level reporter is one object shared by every cohort, so what it
    # holds may be another cohort's results. It is stamped with the node it ran
    # for, and each node checks the stamp.

    def _run_reporter(self):
        """Run the reporter and stamp it as holding this node's results."""
        self.reporter.execute(self._report_target())
        self.reporter._phenex_results_of = id(self)

    def _holds_my_results(self) -> bool:
        return getattr(self.reporter, "_phenex_results_of", None) == id(self)

    def _ensure_reporter_df(self):
        """Give the reporter this node's df: keep it if the stamp matches, else
        read the saved table, else compute."""
        if self._holds_my_results() and getattr(self.reporter, "df", None) is not None:
            return
        if self.table is not None:
            self.reporter.df = (
                self.table.execute() if hasattr(self.table, "execute") else self.table
            )
            # the saved table has the df only, not what plots need
            self.reporter._phenex_results_of = None
        else:
            self._run_reporter()

    def _ensure_reporter_run(self):
        """Run the reporter unless it already holds this node's results. Plots
        need more than the saved table."""
        if not self._holds_my_results():
            self._run_reporter()

    def to_excel(self, path: str):
        """Delegate to the wrapped reporter's to_excel."""
        self._ensure_reporter_df()
        self.reporter.to_excel(path)

    def to_json(self, path: str):
        """Delegate to the wrapped reporter's to_json."""
        self._ensure_reporter_df()
        self.reporter.to_json(path)

    def to_html(self, path: str):
        """Delegate to the wrapped reporter's to_html, if implemented."""
        if hasattr(self.reporter, "to_html"):
            self._ensure_reporter_run()
            self.reporter.to_html(path)

    def to_png(self, path: str):
        """Delegate to the wrapped reporter's to_png, if implemented."""
        if hasattr(self.reporter, "to_png"):
            self._ensure_reporter_run()
            self.reporter.to_png(path)
