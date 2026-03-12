from typing import List, Optional
import os
from phenex.phenotypes.phenotype import Phenotype
from phenex.core.cohort import Cohort
from phenex.reporting import Table1


class _FilteredPhenotypeView:
    """
    Wraps a phenotype and presents a filtered view of its table restricted to
    patients present in a given index table. All other attributes are delegated
    to the underlying phenotype unchanged.
    """

    def __init__(self, phenotype: Phenotype, index_patient_ids):
        self._phenotype = phenotype
        self._index_patient_ids = index_patient_ids

    @property
    def table(self):
        return self._phenotype.table.semi_join(self._index_patient_ids, "PERSON_ID")

    def __getattr__(self, name: str):
        return getattr(self._phenotype, name)


class _CohortViewForTable1:
    """
    A lightweight cohort-like proxy used to compute Table1 for a subset of
    patients from a parent cohort. Provides the interface expected by Table1:
    ``characteristics``, ``index_table``, and ``characteristics_table``.
    """

    def __init__(self, parent_cohort: "Cohort", index_table):
        self.index_table = index_table
        # Restrict each characteristic's table to the subcohort patients
        index_patient_ids = index_table.filter(index_table.BOOLEAN == True).select(
            "PERSON_ID"
        )
        self.characteristics = [
            _FilteredPhenotypeView(p, index_patient_ids)
            for p in parent_cohort.characteristics
        ]
        self.characteristics_table = None  # accessed but unused by Table1


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
            name=name,
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

    def _make_table1_reporter(self) -> Optional["Table1"]:
        """Build and execute a Table1 reporter for the subcohort population."""
        if not self.cohort.characteristics:
            return None
        reporter = Table1()
        proxy = _CohortViewForTable1(self.cohort, self.index_table)
        reporter.execute(proxy)
        return reporter

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
        """Write all available reports to Excel. Table1 is computed from the
        parent cohort's characteristics subset to this subcohort's patients."""
        reporter = self._make_table1_reporter()
        if reporter:
            reporter.to_excel(os.path.join(path, "table1.xlsx"))
        if self.waterfall_node:
            self.waterfall_node.to_excel(os.path.join(path, "waterfall.xlsx"))
        if self.waterfall_detailed_node:
            self.waterfall_detailed_node.to_excel(
                os.path.join(path, "waterfall_detailed.xlsx")
            )
        for custom_reporter in self.custom_reporters:
            report_filename = custom_reporter.__class__.__name__
            custom_reporter.to_excel(os.path.join(path, report_filename + ".xlsx"))

    def write_reports_to_json(self, path: str):
        """Write all available reports as JSON files. Table1 is computed from
        the parent cohort's characteristics subset to this subcohort's patients."""
        reporter = self._make_table1_reporter()
        if reporter:
            reporter.characteristic_sections = getattr(
                self.cohort, "characteristic_sections", None
            )
            reporter.to_json(os.path.join(path, "table1.json"))
        if self.waterfall_node:
            self.waterfall_node.to_json(os.path.join(path, "waterfall.json"))
        if self.waterfall_detailed_node:
            self.waterfall_detailed_node.to_json(
                os.path.join(path, "waterfall_detailed.json")
            )
        for custom_reporter in self.custom_reporters:
            report_filename = custom_reporter.__class__.__name__
            custom_reporter.to_json(os.path.join(path, report_filename + ".json"))
