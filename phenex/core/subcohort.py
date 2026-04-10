from typing import List, Optional
import os
import pandas as pd
import numpy as np
import ibis
from phenex.phenotypes.phenotype import Phenotype
from phenex.core.cohort import Cohort
from phenex.reporting import Table1, Waterfall
from phenex.util import create_logger

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
        outcome_sections: dict = None,
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
        self.outcome_sections = outcome_sections
        self.characteristics_table = None
        self.characteristic_sections = getattr(
            parent_cohort, "characteristic_sections", None
        )


class _PseudoReporterNode:
    """Lightweight stand-in for a WaterfallNode / Table1Node so that
    ``write_reports_to_excel`` / ``write_reports_to_json`` can call
    ``node.to_excel()`` and ``node.to_json()`` uniformly."""

    def __init__(self, name: str, reporter, table):
        self.name = name
        self.reporter = reporter
        self.table = table

    @property
    def df_report(self):
        if self.table is not None:
            if hasattr(self.table, "execute"):
                df = self.table.execute()
            else:
                df = self.table
            self.reporter.df = df
            result = self.reporter.get_pretty_display(color=False)
            return result.drop(columns=["_color"], errors="ignore")
        return None

    def to_excel(self, path: str):
        if self.table is not None:
            _ = self.df_report
            self.reporter.to_excel(path)

    def to_json(self, path: str):
        if self.table is not None:
            _ = self.df_report
            self.reporter.to_json(path)


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

        # Merge parent outcome_sections with additional outcome_sections
        parent_sections = getattr(cohort, "outcome_sections", None) or {}
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
        """
        if self.cohort.subset_tables_entry is None:
            raise RuntimeError(
                f"Parent cohort '{self.cohort.name}' must be executed before "
                f"subcohort '{self.name}'."
            )

        con = self._prepare_database_connector_for_execution(con)

        # Reuse parent state — same entry criterion, same entry-level filtering.
        self.n_persons_in_source_database = self.cohort.n_persons_in_source_database
        self.subset_tables_entry = self.cohort.subset_tables_entry
        self.subset_tables_index = self.cohort.subset_tables_index

        # ------------------------------------------------------------------
        # Execute ONLY additional phenotypes against the parent's index-subset
        # tables (post-inclusion/exclusion filtered domain data).
        # ------------------------------------------------------------------
        for phenotype in (
            self.additional_inclusions
            + self.additional_exclusions
            + self.additional_outcomes
        ):
            if phenotype.table is None:
                phenotype.execute(
                    tables=self.cohort.subset_tables_index,
                    con=con,
                    overwrite=overwrite,
                    n_threads=n_threads,
                    lazy_execution=lazy_execution,
                    table_name_prefix=self.name,
                )

        # ------------------------------------------------------------------
        # Build subcohort index table: start from parent's index table and
        # apply only the additional criteria.
        # ------------------------------------------------------------------
        index_table = self.cohort.index_table

        for inclusion in self.additional_inclusions:
            include_pids = inclusion.table.filter(
                inclusion.table["BOOLEAN"] == True
            ).select("PERSON_ID")
            index_table = index_table.inner_join(include_pids, "PERSON_ID")

        for exclusion in self.additional_exclusions:
            exclude_pids = exclusion.table.select("PERSON_ID")
            index_table = index_table.filter(
                ~index_table["PERSON_ID"].isin(exclude_pids["PERSON_ID"])
            )

        self.table = index_table

        # Materialise the index table if a connector is provided.
        index_db_name = f"{self.name}__INDEX".upper()
        if con and self.table is not None:
            con.create_table(self.table, index_db_name, overwrite=overwrite)
            self.table = con.get_dest_table(index_db_name)

        # ------------------------------------------------------------------
        # Build waterfall reports.  We construct the Waterfall manually so
        # that parent criteria are read from the parent's already-computed
        # waterfall data and only additional criteria are freshly appended.
        # This avoids reading phenotype.table on parent phenotypes whose
        # .table may have been overwritten by the parent's reporting stage.
        # ------------------------------------------------------------------
        self._build_waterfall(include_component_phenotypes_level=None)
        self._build_waterfall(include_component_phenotypes_level=100)

        # Execute custom reporters
        for reporter in self.custom_reporters:
            reporter.execute(self)

        return self.index_table

    # ------------------------------------------------------------------
    # Waterfall construction
    # ------------------------------------------------------------------

    def _build_waterfall(self, include_component_phenotypes_level=None):
        """Build a waterfall by copying the parent's waterfall rows and
        appending rows for the additional subcohort criteria."""
        import numpy as np

        is_detailed = include_component_phenotypes_level is not None

        # Pick the right parent waterfall reporter
        parent_reporter = (
            self.cohort.waterfall_detailed_node
            if is_detailed
            else self.cohort.waterfall_node
        )
        if parent_reporter is None or parent_reporter.table is None:
            return

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

        # Start the running table from the parent's index table (the
        # patients that survived ALL parent inclusion/exclusion criteria).
        # This avoids replaying parent criteria from a potentially
        # corrupted entry_criterion.table.
        running_table = self.cohort.index_table.select("PERSON_ID")

        waterfall = Waterfall(
            include_component_phenotypes_level=include_component_phenotypes_level
        )
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
            if include_component_phenotypes_level is not None:
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
            if include_component_phenotypes_level is not None:
                waterfall._append_components_recursively(
                    exclusion, running_table, parent_index=str(index)
                )

        # Now build the dataframe the same way Waterfall.execute does
        waterfall.ds = waterfall.append_delta(waterfall.ds)
        waterfall.df = pd.DataFrame(waterfall.ds)

        N = (
            self.index_table.filter(self.index_table.BOOLEAN == True)
            .select("PERSON_ID")
            .distinct()
            .count()
            .execute()
        )

        waterfall.df["Pct_Remaining"] = waterfall.df["Remaining"] / N_entry * 100
        waterfall.df["Pct_N"] = waterfall.df["N"] / N_entry * 100

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
            "Remaining",
            "Pct_Remaining",
            "Delta",
            "Pct_Source_Database",
        ]
        waterfall.df = waterfall.df[columns_to_select]

        # Ensure Index column is uniformly typed (string) so ibis.memtable
        # doesn't choke on mixed int / str values.
        waterfall.df["Index"] = waterfall.df["Index"].astype(str)

        # Wrap in a pseudo-node so write_reports_to_excel/json works
        table = ibis.memtable(waterfall.df)
        if is_detailed:
            self.waterfall_detailed_node = _PseudoReporterNode(
                name=f"{self.name}__waterfall_detailed".upper(),
                reporter=waterfall,
                table=table,
            )
        else:
            self.waterfall_node = _PseudoReporterNode(
                name=f"{self.name}__waterfall".upper(),
                reporter=waterfall,
                table=table,
            )

    # ------------------------------------------------------------------
    # Property overrides
    # ------------------------------------------------------------------

    @property
    def index_table(self):
        """Return the subcohort's index table directly (no index_table_node)."""
        return self.table

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
        proxy = _SubcohortProxy(
            self.cohort,
            self.index_table,
            outcomes=self.outcomes,
            outcome_sections=self.outcome_sections,
        )
        reporter.execute(proxy, phenotypes=proxy.outcomes)
        reporter.characteristic_sections = proxy.outcome_sections
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
