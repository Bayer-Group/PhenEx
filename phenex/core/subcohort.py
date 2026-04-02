from typing import List, Optional
import os
from phenex.phenotypes.phenotype import Phenotype
from phenex.core.cohort import Cohort
from phenex.reporting import Table1


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
        return self._phenotype.table.semi_join(self._index_patient_ids, "PERSON_ID")

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
    ):
        self.index_table = index_table
        index_patient_ids = index_table.filter(index_table.BOOLEAN == True).select(
            "PERSON_ID"
        )
        self.characteristics = [
            _FilteredPhenotypeView(p, index_patient_ids)
            for p in parent_cohort.characteristics
        ]
        self.outcomes = [
            _FilteredPhenotypeView(p, index_patient_ids) for p in (outcomes or [])
        ]
        self.characteristics_table = None
        self.characteristic_sections = getattr(
            parent_cohort, "characteristic_sections", None
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
        additional_inclusions = inclusions or []
        additional_exclusions = exclusions or []
        additional_outcomes = outcomes or []

        super(Subcohort, self).__init__(
            name=f"{cohort.name}__{name}",
            entry_criterion=cohort.entry_criterion,
            inclusions=cohort.inclusions + additional_inclusions,
            exclusions=cohort.exclusions + additional_exclusions,
            outcomes=cohort.outcomes + additional_outcomes,
            derived_tables=cohort.derived_tables,
            derived_tables_post_entry=cohort.derived_tables_post_entry,
            database=cohort.database,
            custom_reporters=custom_reporters,
        )
        self.cohort = cohort

    def execute(
        self,
        tables=None,
        con=None,
        overwrite=False,
        n_threads=1,
        lazy_execution=False,
    ):
        """
        Execute the subcohort without rebuilding subset tables.

        The parent cohort must be executed first. The entry stage (subset_tables_entry)
        is reused from the parent directly. Index-stage nodes (inclusions, exclusions,
        index table, waterfall) are executed by calling ``_execute()`` directly in
        dependency order, bypassing the recursive Node execution machinery so that
        already-computed shared phenotype nodes are never re-run.

        Subset index tables are never built or materialised for a subcohort. Reporting
        (Table1, Table1Outcomes) is always generated lazily via the ``_make_*_reporter``
        helpers which use :class:`_FilteredPhenotypeView` to scope counts to the
        subcohort population.
        """
        if self.cohort.subset_tables_entry is None:
            raise RuntimeError(
                f"Parent cohort '{self.cohort.name}' must be executed before "
                f"subcohort '{self.name}'."
            )

        con = self._prepare_database_connector_for_execution(con)

        # Reuse parent's entry-level state directly — same entry criterion means
        # the entry-subset tables are identical.
        self.n_persons_in_source_database = self.cohort.n_persons_in_source_database
        self.subset_tables_entry = self.cohort.subset_tables_entry

        # Build node objects (we selectively execute only the ones we need).
        self.build_stages(self.cohort.subset_tables_entry)

        # Execute any phenotypes not yet run by the parent (i.e. additional
        # inclusions/exclusions/outcomes contributed by this subcohort).
        # Inclusions/exclusions execute against entry-subset domain tables;
        # outcomes execute against the parent's index-subset domain tables.
        for phenotype in self.inclusions + self.exclusions:
            if phenotype.table is None:
                phenotype.execute(
                    tables=self.cohort.subset_tables_entry,
                    con=con,
                    overwrite=overwrite,
                    n_threads=n_threads,
                    lazy_execution=lazy_execution,
                    table_name_prefix=self.name,
                )
        for phenotype in self.outcomes:
            if phenotype.table is None:
                phenotype.execute(
                    tables=self.cohort.subset_tables_index,
                    con=con,
                    overwrite=overwrite,
                    n_threads=n_threads,
                    lazy_execution=lazy_execution,
                    table_name_prefix=self.name,
                )

        # Execute index-stage nodes in dependency order by calling _execute()
        # directly.  All of these nodes read from phenotype.table attributes
        # (already populated) rather than from the tables dict, so no domain
        # table access occurs and no subset tables are built.
        for node in [
            self.inclusions_table_node,
            self.exclusions_table_node,
            self.index_table_node,
            self.waterfall_node,
            self.waterfall_detailed_node,
        ]:
            if node is None:
                continue
            node.table = node._execute(self.cohort.subset_tables_entry)
            if con and node.table is not None:
                con.create_table(node.table, node.name, overwrite=overwrite)
                node.table = con.get_dest_table(node.name)

        self.table = self.index_table_node.table

        # Execute custom reporters (they receive the subcohort object and may
        # access domain tables from the parent's index-subset tables).
        for node in self.custom_reporter_nodes:
            node.table = node._execute(self.cohort.subset_tables_index)
            if con and node.table is not None:
                con.create_table(node.table, node.name, overwrite=overwrite)
                node.table = con.get_dest_table(node.name)

        return self.index_table

    # ------------------------------------------------------------------
    # Report helpers — build reporters lazily using _FilteredPhenotypeView
    # so all counts are automatically scoped to the subcohort population.
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
        proxy = _SubcohortProxy(self.cohort, self.index_table)
        reporter.execute(proxy)
        return reporter

    def _make_table1_detailed_reporter(self) -> Optional["Table1"]:
        """Build and execute a detailed Table1 reporter (component phenotypes expanded)."""
        return self._make_table1_reporter(include_component_phenotypes_level=100)

    def _make_table1_outcomes_reporter(
        self, include_component_phenotypes_level=None
    ) -> Optional["Table1"]:
        """Build and execute a Table1 reporter for the subcohort's outcomes."""
        if not self.outcomes:
            return None
        reporter = Table1(
            include_component_phenotypes_level=include_component_phenotypes_level
        )
        proxy = _SubcohortProxy(self.cohort, self.index_table, outcomes=self.outcomes)
        reporter.execute(proxy, phenotypes=proxy.outcomes)
        return reporter

    def _make_table1_outcomes_detailed_reporter(self) -> Optional["Table1"]:
        """Build and execute a detailed outcomes Table1 reporter."""
        return self._make_table1_outcomes_reporter(
            include_component_phenotypes_level=100
        )

    @property
    def table1(self) -> Optional["pd.DataFrame"]:
        """
        Baseline characteristics Table1 for the subcohort population.

        Takes the parent cohort's characteristics (already computed), filters
        each phenotype's results to the patients in this subcohort, and returns
        a formatted Table1 DataFrame. Returns ``None`` if the parent cohort has
        no characteristics or if the subcohort has not yet been executed.
        """
        reporter = self._make_table1_reporter()
        return reporter.get_pretty_display() if reporter else None

    def write_reports_to_excel(self, path: str):
        """Write all available reports to Excel. Characteristics and outcomes
        Table1 reports are computed from filtered views of the parent cohort's
        already-executed phenotype tables."""
        reporter = self._make_table1_reporter()
        if reporter:
            reporter.to_excel(os.path.join(path, "table1.xlsx"))
        detailed_reporter = self._make_table1_detailed_reporter()
        if detailed_reporter:
            detailed_reporter.to_excel(os.path.join(path, "table1_detailed.xlsx"))
        outcomes_reporter = self._make_table1_outcomes_reporter()
        if outcomes_reporter:
            outcomes_reporter.to_excel(os.path.join(path, "table1_outcomes.xlsx"))
        outcomes_detailed_reporter = self._make_table1_outcomes_detailed_reporter()
        if outcomes_detailed_reporter:
            outcomes_detailed_reporter.to_excel(
                os.path.join(path, "table1_outcomes_detailed.xlsx")
            )
        if self.waterfall_node:
            self.waterfall_node.to_excel(os.path.join(path, "waterfall.xlsx"))
        if self.waterfall_detailed_node:
            self.waterfall_detailed_node.to_excel(
                os.path.join(path, "waterfall_detailed.xlsx")
            )
        for custom_reporter_node in self.custom_reporter_nodes:
            report_filename = custom_reporter_node.reporter.name
            custom_reporter_node.to_excel(os.path.join(path, report_filename + ".xlsx"))

    def write_reports_to_json(self, path: str):
        """Write all available reports as JSON files. Characteristics and outcomes
        Table1 reports are computed from filtered views of the parent cohort's
        already-executed phenotype tables."""
        reporter = self._make_table1_reporter()
        if reporter:
            reporter.characteristic_sections = getattr(
                self.cohort, "characteristic_sections", None
            )
            reporter.to_json(os.path.join(path, "table1.json"))
        detailed_reporter = self._make_table1_detailed_reporter()
        if detailed_reporter:
            detailed_reporter.characteristic_sections = getattr(
                self.cohort, "characteristic_sections", None
            )
            detailed_reporter.to_json(os.path.join(path, "table1_detailed.json"))
        outcomes_reporter = self._make_table1_outcomes_reporter()
        if outcomes_reporter:
            outcomes_reporter.to_json(os.path.join(path, "table1_outcomes.json"))
        outcomes_detailed_reporter = self._make_table1_outcomes_detailed_reporter()
        if outcomes_detailed_reporter:
            outcomes_detailed_reporter.to_json(
                os.path.join(path, "table1_outcomes_detailed.json")
            )
        if self.waterfall_node:
            self.waterfall_node.to_json(os.path.join(path, "waterfall.json"))
        if self.waterfall_detailed_node:
            self.waterfall_detailed_node.to_json(
                os.path.join(path, "waterfall_detailed.json")
            )
        for custom_reporter_node in self.custom_reporter_nodes:
            report_filename = custom_reporter_node.reporter.name
            custom_reporter_node.to_json(os.path.join(path, report_filename + ".json"))
