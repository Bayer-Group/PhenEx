from typing import List, Optional
import pandas as pd
import numpy as np
from phenex.phenotypes.phenotype import Phenotype
from phenex.node import Node, NodeGroup
from phenex.core.cohort import Cohort
from phenex.core.reporter_nodes import (
    CustomReporterNode,
    Reporter,
    Table1Node,
    Table1OutcomesNode,
    WaterfallNode,
)
from phenex.reporting import Table1, Waterfall
from phenex.util import create_logger
from phenex.util.progress import resolve_display, stage_node_total

logger = create_logger(__name__)


class _FilteredPhenotypeView:
    """
    Wraps a phenotype and presents a filtered view of its table restricted to
    patients present in a given index table. All other attributes are delegated
    to the underlying phenotype unchanged.  ``children`` are themselves wrapped
    in :class:`_FilteredPhenotypeView` so that component-phenotype counts in a
    detailed Table1 are also scoped to the subcohort population.
    """

    def __init__(self, phenotype: Phenotype, index_patient_ids):
        self._phenotype = phenotype
        self._index_patient_ids = index_patient_ids

    @property
    def table(self):
        join_keys = [
            k
            for k in ["PERSON_ID", "INDEX_DATE"]
            if k in self._phenotype.table.columns
            and k in self._index_patient_ids.columns
        ]
        return self._phenotype.table.semi_join(self._index_patient_ids, join_keys)

    @property
    def children(self):
        raw_children = getattr(self._phenotype, "children", None) or []
        return [
            _FilteredPhenotypeView(c, self._index_patient_ids) for c in raw_children
        ]

    def __getattr__(self, name: str):
        return getattr(self._phenotype, name)


class _SubcohortProxy:
    """
    A lightweight cohort-like proxy used to compute Table1 /
    Table1Outcomes reports for a subset of patients from a parent cohort.
    Provides the interface expected by Table1: ``characteristics``,
    ``outcomes``, ``index_table``, and ``characteristic_sections``.

    Each phenotype is wrapped in a :class:`_FilteredPhenotypeView` so all
    counts are scoped to the subcohort's patient population without
    re-querying domain tables.
    """

    def __init__(
        self,
        parent_cohort: "Cohort",
        index_table,
        outcomes: list = None,
        outcome_sections: dict = None,
    ):
        self.index_table = index_table
        _id_cols = ["PERSON_ID"] + (
            ["INDEX_DATE"] if "INDEX_DATE" in index_table.columns else []
        )
        index_patient_ids = index_table.filter(index_table.BOOLEAN == True).select(
            *_id_cols
        )
        self.characteristics = [
            _FilteredPhenotypeView(p, index_patient_ids)
            for p in parent_cohort.characteristics
        ]
        self.outcomes = [
            _FilteredPhenotypeView(p, index_patient_ids) for p in (outcomes or [])
        ]
        self.outcome_sections = outcome_sections
        self.characteristics_table = None
        self.characteristic_sections = getattr(
            parent_cohort, "characteristic_sections", None
        )
        parent_subset = getattr(parent_cohort, "subset_tables_index", None)
        if parent_subset is not None:
            self.subset_tables_index = {}
            for domain, ptable in parent_subset.items():
                if "PERSON_ID" in ptable._table.columns:
                    _sj_keys = [k for k in _id_cols if k in ptable._table.columns]
                    self.subset_tables_index[domain] = type(ptable)(
                        ptable._table.semi_join(index_patient_ids, _sj_keys)
                    )
                else:
                    self.subset_tables_index[domain] = ptable
        else:
            self.subset_tables_index = None


# The subcohort's reports are saved steps, like the parent cohort's: read back when nothing changed.


class _SubcohortTable1Node(Table1Node):
    """The subcohort's Table1: the parent's characteristics, restricted to the
    subcohort's patients."""

    def __init__(
        self, name: str, cohort: "Subcohort", include_component_phenotypes_level=None
    ):
        Reporter.__init__(self, name=name, cohort=cohort)
        self.reporter = Table1(
            include_component_phenotypes_level=include_component_phenotypes_level
        )

    def _execute(self, tables=None):
        self.reporter.execute(self.cohort._report_proxy())
        return self._report_table(self.reporter.df)

    def to_json(self, path: str):
        """Sections come from the parent, which owns the characteristics."""
        if self.table is not None:
            _ = self.df_report
            self.reporter.characteristic_sections = getattr(
                self.cohort.cohort, "characteristic_sections", None
            )
            self.reporter.to_json(path)


class _SubcohortTable1OutcomesNode(Table1OutcomesNode):
    """The subcohort's outcomes Table1: its outcomes (the parent's plus its
    own), restricted to the subcohort's patients."""

    def __init__(
        self, name: str, cohort: "Subcohort", include_component_phenotypes_level=None
    ):
        Reporter.__init__(self, name=name, cohort=cohort)
        self.reporter = Table1(
            name="Table1Outcomes",
            include_component_phenotypes_level=include_component_phenotypes_level,
        )

    def _execute(self, tables=None):
        proxy = self.cohort._report_proxy(
            outcomes=self.cohort.outcomes,
            outcome_sections=self.cohort.outcome_sections,
        )
        self.reporter.execute(proxy, phenotypes=proxy.outcomes)
        self.reporter.characteristic_sections = proxy.outcome_sections
        return self._report_table(self.reporter.df)


class _SubcohortWaterfallNode(WaterfallNode):
    """The subcohort's waterfall: the parent's rows, plus a row for each of the
    subcohort's extra criteria."""

    def __init__(
        self, name: str, cohort: "Subcohort", include_component_phenotypes_level=None
    ):
        Reporter.__init__(self, name=name, cohort=cohort)
        self.include_component_phenotypes_level = include_component_phenotypes_level
        self.reporter = Waterfall(
            include_component_phenotypes_level=include_component_phenotypes_level
        )

    def _execute(self, tables=None):
        df = self.cohort._build_waterfall(self.reporter)
        return None if df is None else self._report_table(df)


class _SubcohortCustomReporterNode(CustomReporterNode):
    """A custom reporter run on the subcohort's patients."""

    def __init__(self, name: str, cohort: "Subcohort", reporter):
        Reporter.__init__(self, name=name, cohort=cohort)
        self.reporter = reporter

    def _report_target(self):
        return self.cohort._report_proxy(outcomes=self.cohort.outcomes)


class _SubcohortIndexNode(Node):
    """The subcohort's index query as a real `Node`, so it resolves through the same
    `Node.to_sql()` path as every other node.

    Built inline and never cached, with no dependencies, so only the live expression
    or the saved `.sql` resolves it and `_execute` raises.
    """

    def __init__(self, table_name: str, expression):
        super().__init__(name=table_name)
        self._expression = expression

    def get_table_name(self, table_name_prefix: Optional[str] = None) -> str:
        """Return the node name, which is already the fully qualified table name."""
        return self.name  # already fully qualified

    def _execute(self, tables=None):
        """Recompile layer, raises because this node has nothing to rebuild from."""
        # Reached only if the live expression (layer 1) and the saved file
        # (layer 2) both missed. This node was never cached (layer 3) and has no
        # dependencies to recompile from (layer 4).
        raise RuntimeError(
            f"Cannot resolve SQL for subcohort index '{self.name}'. It is not "
            f"cached and has no dependencies to recompile from, its SQL comes "
            f"only from the live session or the saved '{self.name}.sql'. Re-run "
            f"subcohort.execute(), or pass sql_dir= pointing at the run's sql folder."
        )


class Subcohort(Cohort):
    """
    A Subcohort derives from a parent cohort and applies additional inclusion /
    exclusion criteria. The subcohort inherits the entry criterion, inclusions,
    exclusions, and outcomes from the parent cohort but can add additional
    filtering criteria and outcomes.

    Like ``Cohort``, a ``Subcohort`` exposes a ``table1`` property that reports
    baseline characteristics for the subcohort population. The characteristics
    are taken from the parent cohort and their data are subset to the patients
    that satisfy the subcohort's criteria.

    Parameters:
        name: A descriptive name for the subcohort.
        cohort: The parent cohort from which this subcohort derives.
        inclusions: Additional phenotypes that must evaluate to True for
            patients to be included in the subcohort.
        exclusions: Additional phenotypes that must evaluate to False for
            patients to be included in the subcohort.
        additional_outcomes: Additional outcome phenotypes beyond those
            inherited from the parent cohort.
        custom_reporters: Reporter instances to run on this subcohort only,
            in addition to the default Waterfall and Table1 reporters.
    """

    def __init__(
        self,
        name: str,
        cohort: "Cohort",
        inclusions: Optional[List[Phenotype]] = None,
        exclusions: Optional[List[Phenotype]] = None,
        outcomes: Optional[List[Phenotype]] = None,
        custom_reporters: Optional[List] = None,
    ):
        self.additional_inclusions = inclusions or []
        self.additional_exclusions = exclusions or []

        # outcomes may be a flat list or a dict of {section_name: [phenotypes]}
        if isinstance(outcomes, dict):
            self._additional_outcome_sections = {
                section: [p.display_name for p in phenos]
                for section, phenos in outcomes.items()
            }
            self.additional_outcomes = [
                p for phenos in outcomes.values() for p in phenos
            ]
        else:
            self._additional_outcome_sections = None
            self.additional_outcomes = outcomes or []

        parent_sections = getattr(cohort, "outcome_sections", None) or {}

        super(Subcohort, self).__init__(
            name=f"{cohort.name}__{name}",
            entry_criterion=cohort.entry_criterion,
            inclusions=cohort.inclusions + self.additional_inclusions,
            exclusions=cohort.exclusions + self.additional_exclusions,
            outcomes=cohort.outcomes + self.additional_outcomes,
            derived_tables=cohort.derived_tables,
            derived_tables_post_entry=cohort.derived_tables_post_entry,
            database=cohort.database,
            custom_reporters=custom_reporters,
        )
        self.cohort = cohort

        # super().__init__() overwrites _table_name_prefix on shared phenotype objects;
        # restore the parent cohort's prefix on its phenotypes.
        cohort._apply_table_name_prefix(cohort.phenotypes)

        additional_sections = self._additional_outcome_sections or {}
        merged = {**parent_sections, **additional_sections}
        self.outcome_sections = merged if merged else None

    def execute(
        self,
        tables=None,
        con=None,
        overwrite=False,
        n_threads=1,
        lazy_execution=False,
        sql_dir="./sql",
        verbosity=None,
    ):
        """
        Execute the subcohort by applying additional criteria on top of the
        parent cohort's final index table.

        The parent cohort must be executed first. No entry stage, subset tables,
        or shared phenotype nodes are re-executed. Only additional
        inclusions/exclusions/outcomes contributed by this subcohort are
        executed against the parent's ``subset_tables_index``.

        The subcohort's index table is derived by filtering the parent's
        ``index_table`` with the additional inclusion/exclusion criteria.
        No subset tables are built or materialised for the subcohort.

        The reports are saved like the parent cohort's: with
        ``lazy_execution=True`` an unchanged report is read back, not rebuilt.
        """
        if self.cohort.subset_tables_entry is None:
            raise RuntimeError(
                f"Parent cohort '{self.cohort.name}' must be executed before "
                f"subcohort '{self.name}'."
            )

        display = resolve_display(verbosity)
        with display.cohort_session(self.name, kind="Subcohort"):
            logger.info(
                f"Cohort '{self.name}' initialized with entry criterion "
                f"'{self.entry_criterion.name}'"
            )
            display.set_idle("Getting ready: reusing the parent cohort's tables ...")
            con = self._prepare_database_connector_for_execution(con)

            # Reuse parent state — same entry criterion, same entry-level filtering.
            self.n_persons_in_source_database = self.cohort.n_persons_in_source_database
            self.subset_tables_entry = self.cohort.subset_tables_entry
            self.subset_tables_index = self.cohort.subset_tables_index

            # --------------------------------------------------------------
            # Execute ONLY additional phenotypes against the parent's
            # index-subset tables (post-inclusion/exclusion filtered domain data).
            # --------------------------------------------------------------
            extra_criteria = (
                self.additional_inclusions
                + self.additional_exclusions
                + self.additional_outcomes
            )
            if extra_criteria:
                display.task_started("Extra criteria", len(extra_criteria))
            for phenotype in extra_criteria:
                with display.task_item(phenotype.name):
                    if phenotype.table is None:
                        phenotype.execute(
                            tables=self.cohort.subset_tables_index,
                            con=con,
                            overwrite=overwrite,
                            n_threads=n_threads,
                            lazy_execution=lazy_execution,
                            table_name_prefix=self._table_prefix,
                        )
            if extra_criteria:
                display.task_completed()

            # --------------------------------------------------------------
            # Build subcohort index table: start from parent's index table and
            # apply only the additional criteria.
            # --------------------------------------------------------------
            display.set_idle("Building the subcohort index table ...")
            index_table = self.cohort.index_table
            _ij_keys = ["PERSON_ID"] + (
                ["INDEX_DATE"] if "INDEX_DATE" in index_table.columns else []
            )

            for inclusion in self.additional_inclusions:
                include_pids = inclusion.table.filter(
                    inclusion.table["BOOLEAN"] == True
                ).select(*_ij_keys)
                index_table = index_table.inner_join(include_pids, _ij_keys)

            for exclusion in self.additional_exclusions:
                exclude_pids = exclusion.table.select(*_ij_keys)
                index_table = index_table.anti_join(exclude_pids, _ij_keys)

            self.table = index_table

            # Capture the index query BEFORE materialising it, so its SQL can be
            # written out (materialising overwrites self.table with a plain table
            # reference, losing the join expression).
            index_db_name = f"{self.name}__INDEX".upper()
            self._subcohort_index_node = _SubcohortIndexNode(
                table_name=index_db_name, expression=index_table
            )

            # Materialise the index table if a connector is provided.
            if con and self.table is not None:
                con.create_table(self.table, index_db_name, overwrite=overwrite)
                self.table = con.get_dest_table(index_db_name)

            # --------------------------------------------------------------
            # Reports as saved steps: unchanged ones are read back, the rest
            # are built in parallel on n_threads.
            # --------------------------------------------------------------
            self.reporting_stage = NodeGroup(
                name="subcohort_reporting_stage", nodes=self._build_report_nodes()
            )
            display.stage_started(
                "Reporting stage", stage_node_total(self.reporting_stage)
            )
            self.reporting_stage.execute(
                con=con,
                overwrite=overwrite,
                n_threads=n_threads,
                lazy_execution=lazy_execution,
                table_name_prefix=self._table_prefix,
            )
            display.stage_completed()

            # Write the subcohort's own SQL: its extra criteria and its index query.
            # Parent nodes are written by the parent cohort's execute().
            display.set_idle("Writing sql files ...")
            self._write_node_sql_files(sql_dir, con, overwrite)

            return self.index_table

    # ------------------------------------------------------------------
    # Reports
    # ------------------------------------------------------------------

    def _build_report_nodes(self) -> List[Node]:
        """The subcohort's reports as nodes, named like the parent cohort's
        (`<NAME>__TABLE1` and so on)."""
        name = self.name.upper()
        self.waterfall_node = _SubcohortWaterfallNode(f"{name}__WATERFALL", self)
        self.waterfall_detailed_node = _SubcohortWaterfallNode(
            f"{name}__WATERFALL_DETAILED", self, include_component_phenotypes_level=100
        )
        nodes = [self.waterfall_node, self.waterfall_detailed_node]

        self.table1_node = self.table1_detailed_node = None
        if self.cohort.characteristics:
            self.table1_node = _SubcohortTable1Node(f"{name}__TABLE1", self)
            self.table1_detailed_node = _SubcohortTable1Node(
                f"{name}__TABLE1_DETAILED", self, include_component_phenotypes_level=100
            )
            nodes += [self.table1_node, self.table1_detailed_node]

        self.table1_outcomes_node = self.table1_outcomes_detailed_node = None
        if self.outcomes:
            self.table1_outcomes_node = _SubcohortTable1OutcomesNode(
                f"{name}__TABLE1_OUTCOMES", self
            )
            self.table1_outcomes_detailed_node = _SubcohortTable1OutcomesNode(
                f"{name}__TABLE1_OUTCOMES_DETAILED",
                self,
                include_component_phenotypes_level=100,
            )
            nodes += [self.table1_outcomes_node, self.table1_outcomes_detailed_node]

        self.custom_reporter_nodes = [
            _SubcohortCustomReporterNode(
                f"{name}__CUSTOM__{reporter.name}".upper(), self, reporter
            )
            for reporter in self.custom_reporters
        ]
        return nodes + self.custom_reporter_nodes

    def _report_proxy(self, **kwargs) -> _SubcohortProxy:
        """The parent's phenotypes, cut down to this subcohort's patients."""
        return _SubcohortProxy(self.cohort, self.index_table, **kwargs)

    def _build_waterfall(self, waterfall: Waterfall) -> Optional[pd.DataFrame]:
        """Fill `waterfall` with the parent's saved rows plus one row per extra
        criterion, and return its DataFrame. None if the parent has none."""
        is_detailed = waterfall.include_component_phenotypes_level is not None

        # Pick the right parent waterfall reporter
        parent_reporter = (
            self.cohort.waterfall_detailed_node
            if is_detailed
            else self.cohort.waterfall_node
        )
        if parent_reporter is None or parent_reporter.table is None:
            return None

        # Get the parent waterfall dataframe (the raw df, not pretty-printed)
        parent_df = parent_reporter.table
        if hasattr(parent_df, "execute"):
            parent_df = parent_df.execute()

        # The parent df has rows: [N persons in DB, entry, ...inclusions, ...exclusions, Final Cohort Size]
        # Drop the "Final Cohort Size" row — we'll regenerate it.
        parent_rows = parent_df[parent_df["Type"] != "info"].to_dict("records")

        # Extract N_entry from the parent's waterfall entry row.
        # We cannot use self.cohort.entry_criterion.table because the
        # parent's reporting stage may have re-executed it (e.g. as a
        # dependency of an outcome phenotype with a RelativeTimeRangeFilter),
        # overwriting it with index-filtered data.
        entry_rows = parent_df[parent_df["Type"] == "entry"]
        N_entry = int(entry_rows["N"].iloc[0])
        N_events_entry = (
            int(entry_rows["N_events"].iloc[0])
            if "N_events" in entry_rows.columns
            else N_entry
        )

        # Start the running table from the parent's index table (the
        # patients that survived ALL parent inclusion/exclusion criteria).
        # This avoids replaying parent criteria from a potentially
        # corrupted entry_criterion.table.
        index_keys = ["PERSON_ID"] + (
            ["INDEX_DATE"] if "INDEX_DATE" in self.cohort.index_table.columns else []
        )
        running_table = self.cohort.index_table.select(index_keys)

        waterfall.cohort = self
        waterfall.ds = list(parent_rows)

        # Append additional criteria
        index = len([r for r in parent_rows if r["Type"] != "component"])
        for inclusion in self.additional_inclusions:
            index += 1
            running_table = waterfall.append_phenotype_to_waterfall(
                running_table,
                inclusion,
                "inclusion",
                level=0,
                index=index,
            )
            if is_detailed:
                waterfall._append_components_recursively(
                    inclusion, running_table, parent_index=str(index)
                )

        for exclusion in self.additional_exclusions:
            index += 1
            running_table = waterfall.append_phenotype_to_waterfall(
                running_table,
                exclusion,
                "exclusion",
                level=0,
                index=index,
            )
            if is_detailed:
                waterfall._append_components_recursively(
                    exclusion, running_table, parent_index=str(index)
                )

        # Now build the dataframe the same way Waterfall.execute does
        waterfall.ds = waterfall.append_delta(waterfall.ds)
        waterfall.df = pd.DataFrame(waterfall.ds)

        final_filtered = self.index_table.filter(self.index_table.BOOLEAN == True)
        N = final_filtered.select("PERSON_ID").distinct().count().execute()
        N_events = waterfall._count_events(final_filtered)

        waterfall.df["Pct_Remaining"] = waterfall.df["Remaining"] / N_entry * 100
        waterfall.df["Pct_N"] = waterfall.df["N"] / N_entry * 100
        waterfall.df["Pct_N_events"] = waterfall.df["N_events"] / N_events_entry * 100
        waterfall.df["Pct_events_remaining"] = (
            waterfall.df["N_events_remaining"] / N_events_entry * 100
        )

        float_cols = waterfall.df.select_dtypes(include="float").columns
        waterfall.df[float_cols] = waterfall.df[float_cols].round(
            waterfall.decimal_places
        )

        first_row = pd.DataFrame(
            [
                {
                    "Type": "info",
                    "Name": "N persons in database",
                    "N": self.n_persons_in_source_database,
                    "Level": 0,
                    "Index": "",
                }
            ]
        )
        last_row = pd.DataFrame(
            [
                {
                    "Type": "info",
                    "Name": "Final Cohort Size",
                    "Remaining": N,
                    "Pct_Remaining": round(100 * N / N_entry, waterfall.decimal_places),
                    "N_events_remaining": N_events,
                    "Pct_events_remaining": round(
                        100 * N_events / N_events_entry, waterfall.decimal_places
                    ),
                    "Level": 0,
                    "Index": "",
                }
            ]
        )
        waterfall.df = pd.concat([first_row, waterfall.df, last_row], ignore_index=True)

        entry_pct = round(
            N_entry / self.n_persons_in_source_database * 100, waterfall.decimal_places
        )
        final_pct = round(
            N / self.n_persons_in_source_database * 100, waterfall.decimal_places
        )
        waterfall.df["Pct_Source_Database"] = (
            [np.nan, entry_pct] + [np.nan] * (waterfall.df.shape[0] - 3) + [final_pct]
        )

        columns_to_select = [
            "Type",
            "Index",
            "Name",
            "Level",
            "N",
            "Pct_N",
            "N_events",
            "Pct_N_events",
            "Remaining",
            "Pct_Remaining",
            "N_events_remaining",
            "Pct_events_remaining",
            "Delta",
            "Pct_Source_Database",
        ]
        waterfall.df = waterfall.df[columns_to_select]

        # Ensure Index column is uniformly typed (string) so ibis.memtable
        # doesn't choke on mixed int / str values.
        waterfall.df["Index"] = waterfall.df["Index"].astype(str)
        return waterfall.df

    # ------------------------------------------------------------------
    # Property overrides
    # ------------------------------------------------------------------

    @property
    def index_table(self):
        """Return the subcohort's index table directly (no index_table_node)."""
        return self.table

    def _collect_all_nodes(self):
        """The subcohort's own nodes only, its extra criteria plus their dependencies
        and its index query. The parent's `execute()` already writes the inherited
        nodes, so repeating them would copy the parent's SQL into every subcohort
        folder."""
        seen = set()
        ordered = []
        roots = (
            self.additional_inclusions
            + self.additional_exclusions
            + self.additional_outcomes
        )
        for root in roots:
            if root is None:
                continue
            for node in [*root.dependencies, root]:
                if id(node) not in seen:
                    seen.add(id(node))
                    ordered.append(node)
        index_node = getattr(self, "_subcohort_index_node", None)
        if index_node is not None and id(index_node) not in seen:
            ordered.append(index_node)
        return ordered

    def to_sql(self, sql_dir=None, connector=None):
        """Lazy, dict-like view of the subcohort's own SQL, its extra criteria plus its
        index query, keyed by node table name. The inherited parent SQL is in the
        parent's `to_sql()`. Nodes come from `execute()`, so run the parent then the
        subcohort first.

        Parameters:
            sql_dir: Directory of saved `.sql` files, defaults to the last `execute()` run.
            connector: Pins the SQL dialect, defaults to the subcohort's database connector.
        """
        from phenex.core.sql_view import announce_sql_source, build_sql_view

        connector = connector or (
            self.database.connector if self.database is not None else None
        )
        sql_dir = sql_dir or getattr(self, "_last_sql_dir", None)
        # Complete but scoped to this subcohort, so say where the parent's SQL is.
        logger.info(
            f"Subcohort '{self.name}': its own SQL only (extra criteria and index), "
            f"the inherited parent SQL is in {self.cohort.name}.to_sql()."
        )
        # Say up front where the SQL is read from, so a short list is traceable.
        announce_sql_source(
            f"Subcohort '{self.name}'", sql_dir, "in-memory nodes only, no sidecars"
        )
        return build_sql_view(self._collect_all_nodes(), sql_dir, connector)

    # ------------------------------------------------------------------
    # On-demand reporters: a fresh Table1 that is not saved. The saved reports
    # come from the report nodes.
    # ------------------------------------------------------------------

    def _make_table1_reporter(
        self, include_component_phenotypes_level=None
    ) -> Optional["Table1"]:
        """Build and execute a Table1 reporter for the subcohort's characteristics."""
        if not self.cohort.characteristics:
            return None
        reporter = Table1(
            include_component_phenotypes_level=include_component_phenotypes_level
        )
        reporter.execute(self._report_proxy())
        return reporter

    def _make_table1_outcomes_reporter(
        self, include_component_phenotypes_level=None
    ) -> Optional["Table1"]:
        """Build and execute a Table1 reporter for the subcohort's outcomes."""
        if not self.outcomes:
            return None
        reporter = Table1(
            include_component_phenotypes_level=include_component_phenotypes_level
        )
        proxy = self._report_proxy(
            outcomes=self.outcomes, outcome_sections=self.outcome_sections
        )
        reporter.execute(proxy, phenotypes=proxy.outcomes)
        reporter.characteristic_sections = proxy.outcome_sections
        return reporter

    # table1, waterfall and the report files come from Cohort: they read the
    # report nodes, which a subcohort names and fills like a cohort.
