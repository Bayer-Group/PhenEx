"""
Tests for lazy execution of cohorts with reporters and subcohorts.

Verifies that when lazy_execution=True and nothing has changed, reporters
(Table1, Waterfall, TimeToEvent) and phenotypes are NOT re-executed.
"""

import matplotlib

matplotlib.use("Agg")

import datetime
import logging
import os
import tempfile
import unittest

import pandas as pd

from phenex.codelists import Codelist
from phenex.core import Cohort, Subcohort
from phenex.core.database import Database
from phenex.filters import (
    GreaterThanOrEqualTo,
    RelativeTimeRangeFilter,
    ValueFilter,
)
from phenex.ibis_connect import DuckDBConnector
from phenex.phenotypes import (
    AgePhenotype,
    CodelistPhenotype,
    SexPhenotype,
    MeasurementPhenotype,
)
from phenex.reporting import TimeToEvent
from phenex.test.cohort.test_mappings import (
    ConditionOccurenceTableForTests,
    DrugExposureTableForTests,
    ObservationPeriodTableForTests,
    PersonTableForTests,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_test_tables(con):
    """Create minimal but realistic test tables in the DuckDB connector."""
    n_patients = 10
    patids = [f"P{i}" for i in range(n_patients)]

    # PERSON
    df_person = pd.DataFrame(
        {
            "PATID": patids,
            "YOB": [1970 + i for i in range(n_patients)],
            "GENDER": [2 if i % 2 == 0 else 1 for i in range(n_patients)],
        }
    )
    person_table = PersonTableForTests(
        con.dest_connection.create_table(
            "PERSON",
            df_person,
            schema={"PATID": str, "YOB": int, "GENDER": int},
        )
    )

    # DRUG_EXPOSURE (entry: d1 for all patients, outcome: d_outcome for some)
    rows = []
    for i, pid in enumerate(patids):
        rows.append(
            {"PATID": pid, "PRODCODEID": "d1", "ISSUEDATE": datetime.date(2020, 1, 1)}
        )
        # Patients P0-P4 also have an outcome drug event 90 days later
        if i < 5:
            rows.append(
                {
                    "PATID": pid,
                    "PRODCODEID": "d_outcome",
                    "ISSUEDATE": datetime.date(2020, 4, 1),
                }
            )
        # Patients P0, P1 have an exclusion drug
        if i < 2:
            rows.append(
                {
                    "PATID": pid,
                    "PRODCODEID": "e_excl",
                    "ISSUEDATE": datetime.date(2019, 6, 1),
                }
            )
        # Right-censor event for P5-P9
        if i >= 5:
            rows.append(
                {
                    "PATID": pid,
                    "PRODCODEID": "d_censor",
                    "ISSUEDATE": datetime.date(2020, 7, 1),
                }
            )
    df_drug = pd.DataFrame(rows)
    drug_table = DrugExposureTableForTests(
        con.dest_connection.create_table(
            "DRUG_EXPOSURE",
            df_drug,
            schema={"PATID": str, "PRODCODEID": str, "ISSUEDATE": datetime.date},
        )
    )

    # CONDITION_OCCURRENCE (some patients have a condition)
    rows_cond = []
    for i, pid in enumerate(patids):
        if i < 7:
            rows_cond.append(
                {
                    "PATID": pid,
                    "MEDCODEID": "cond1",
                    "OBSDATE": datetime.date(2019, 6, 1),
                }
            )
    df_cond = pd.DataFrame(rows_cond)
    cond_table = ConditionOccurenceTableForTests(
        con.dest_connection.create_table(
            "CONDITION_OCCURRENCE",
            df_cond,
            schema={"PATID": str, "MEDCODEID": str, "OBSDATE": datetime.date},
        )
    )

    # OBSERVATION_PERIOD
    df_obs = pd.DataFrame(
        {
            "PATID": patids,
            "REGSTARTDATE": [datetime.date(2018, 1, 1)] * n_patients,
            "REGENDDATE": [datetime.date(2021, 12, 31)] * n_patients,
        }
    )
    obs_table = ObservationPeriodTableForTests(
        con.dest_connection.create_table(
            "OBSERVATION_PERIOD",
            df_obs,
            schema={
                "PATID": str,
                "REGSTARTDATE": datetime.date,
                "REGENDDATE": datetime.date,
            },
        )
    )

    return {
        "PERSON": person_table,
        "DRUG_EXPOSURE": drug_table,
        "CONDITION_OCCURRENCE": cond_table,
        "OBSERVATION_PERIOD": obs_table,
    }


def _build_cohort(tables):
    """Build a cohort with entry, inclusion, exclusion, characteristics, outcomes, and a TTE reporter."""
    entry = CodelistPhenotype(
        name="entry_drug",
        return_date="first",
        codelist=Codelist(["d1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )

    # Inclusion: continuous coverage >= 365 days
    from phenex.phenotypes import TimeRangePhenotype

    cc = TimeRangePhenotype(
        name="continuous_coverage",
        relative_time_range=RelativeTimeRangeFilter(
            min_days=GreaterThanOrEqualTo(365),
            anchor_phenotype=entry,
        ),
    )

    # Exclusion: prior use of e_excl
    excl = CodelistPhenotype(
        name="prior_exclusion_drug",
        codelist=Codelist(["e_excl"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
        relative_time_range=RelativeTimeRangeFilter(
            when="before",
            min_days=GreaterThanOrEqualTo(0),
            anchor_phenotype=entry,
        ),
    )

    # Characteristic: age
    age = AgePhenotype(
        anchor_phenotype=entry,
    )

    # Characteristic: sex
    sex = SexPhenotype()

    # Outcome: occurrence of d_outcome
    outcome = CodelistPhenotype(
        name="outcome_event",
        codelist=Codelist(["d_outcome"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
        return_date="first",
    )

    # Right censor phenotype for TTE
    right_censor = CodelistPhenotype(
        name="right_censor_event",
        codelist=Codelist(["d_censor"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
        return_date="first",
    )

    tte = TimeToEvent(
        right_censor_phenotypes=[right_censor],
        end_of_study_period=datetime.date(2021, 12, 31),
    )

    cohort = Cohort(
        name="lazy_test_cohort",
        entry_criterion=entry,
        inclusions=[cc],
        exclusions=[excl],
        characteristics=[age, sex],
        outcomes=[outcome],
        custom_reporters=[tte],
    )

    return cohort, right_censor


def _build_subcohort(cohort):
    """Build a subcohort with an additional exclusion criterion."""
    additional_excl = CodelistPhenotype(
        name="subcohort_additional_exclusion",
        codelist=Codelist(["cond1"]).copy(use_code_type=False),
        domain="CONDITION_OCCURRENCE",
        relative_time_range=RelativeTimeRangeFilter(
            when="before",
            min_days=GreaterThanOrEqualTo(0),
        ),
    )
    return Subcohort(
        name="sub1",
        cohort=cohort,
        exclusions=[additional_excl],
    )


class _ExecutionTracker:
    """Context manager that captures log messages to detect re-execution of reporters."""

    def __init__(self):
        self.records = []
        self._handler = None

    def __enter__(self):
        self._handler = logging.Handler()
        self._handler.emit = lambda record: self.records.append(record)
        self._handler.setLevel(logging.DEBUG)
        # Attach to root logger to capture everything
        logging.getLogger().addHandler(self._handler)
        return self

    def __exit__(self, *args):
        logging.getLogger().removeHandler(self._handler)

    def _messages(self):
        return [r.getMessage() for r in self.records]

    def count_reporter_executions(self, reporter_name: str) -> int:
        """Count how many times a reporter's _execute was triggered."""
        return sum(
            1
            for msg in self._messages()
            if reporter_name.lower() in msg.lower()
            and ("generating" in msg.lower() or "report" in msg.lower())
        )

    def count_node_computations(self) -> int:
        """Count how many nodes were computed (not cached)."""
        return sum(1 for msg in self._messages() if "computing..." in msg.lower())

    def count_node_cache_hits(self) -> int:
        """Count how many nodes used cached results."""
        return sum(
            1
            for msg in self._messages()
            if "unchanged, using cached result" in msg.lower()
        )

    def has_table1_execution(self) -> bool:
        """Check if Table1 reporter was executed."""
        return any(
            "starting with" in msg.lower() and "columns for table1" in msg.lower()
            for msg in self._messages()
        )

    def has_tte_execution(self) -> bool:
        """Check if TimeToEvent reporter was executed."""
        return any(
            "time to event finished execution" in msg.lower()
            for msg in self._messages()
        )

    def has_waterfall_execution(self) -> bool:
        """Check if any waterfall was computed."""
        return any(
            "waterfall" in msg.lower()
            and ("generating" in msg.lower() or "computing..." in msg.lower())
            for msg in self._messages()
        )

    def print_summary(self, label: str = ""):
        """Print a summary of execution activity for debugging."""
        print(f"\n{'=' * 60}")
        print(f"Execution Summary: {label}")
        print(f"{'=' * 60}")
        print(f"  Nodes computed:     {self.count_node_computations()}")
        print(f"  Nodes cached:       {self.count_node_cache_hits()}")
        print(f"  Table1 executed:    {self.has_table1_execution()}")
        print(f"  TTE executed:       {self.has_tte_execution()}")
        print(f"  Waterfall executed: {self.has_waterfall_execution()}")
        print(f"{'=' * 60}\n")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestCohortLazyExecution(unittest.TestCase):
    """Test that lazy execution correctly skips unchanged nodes and reporters."""

    @classmethod
    def setUpClass(cls):
        """Set up test data and run the initial execution."""
        # Use a temp directory for the DuckDB destination database so lazy
        # execution has a persistent store for materialized tables and metadata.
        cls._tmpdir = tempfile.mkdtemp()
        cls._db_path = os.path.join(cls._tmpdir, "test_lazy.duckdb")
        cls._meta_db = os.path.join(cls._tmpdir, "phenex.db")

        cls.con = DuckDBConnector(DUCKDB_DEST_DATABASE=cls._db_path)
        cls.tables = _build_test_tables(cls.con)
        cls.cohort, cls.right_censor = _build_cohort(cls.tables)
        cls.subcohort = _build_subcohort(cls.cohort)

        # Enable debug logging so we can track execution
        logging.getLogger("phenex").setLevel(logging.DEBUG)

    def test_01_first_execution_computes_everything(self):
        """First execution with lazy_execution=True should compute all nodes."""
        with _ExecutionTracker() as tracker:
            self.cohort.execute(
                tables=self.tables,
                con=self.con,
                overwrite=True,
                lazy_execution=True,
            )
            tracker.print_summary("First execution")

        # Everything should have been computed
        n_computed = tracker.count_node_computations()
        self.assertGreater(
            n_computed,
            0,
            "First execution should compute nodes, but none were computed.",
        )
        self.assertTrue(
            tracker.has_table1_execution(),
            "First execution should run Table1 reporter.",
        )
        self.assertTrue(
            tracker.has_tte_execution(),
            "First execution should run TimeToEvent reporter.",
        )

        # Verify cohort produced valid results
        self.assertIsNotNone(self.cohort.index_table)
        self.assertIsNotNone(self.cohort.table1)
        self.assertIsNotNone(self.cohort.waterfall)

    def test_02_second_execution_uses_cache(self):
        """Second execution with same parameters should skip all nodes (use cache)."""
        with _ExecutionTracker() as tracker:
            self.cohort.execute(
                tables=self.tables,
                con=self.con,
                overwrite=True,
                lazy_execution=True,
            )
            tracker.print_summary("Second execution (should be cached)")

        # Nothing should have been re-computed
        n_computed = tracker.count_node_computations()
        n_cached = tracker.count_node_cache_hits()

        self.assertEqual(
            n_computed,
            0,
            f"Second execution should compute 0 nodes, but {n_computed} were computed.",
        )
        self.assertGreater(
            n_cached,
            0,
            "Second execution should have cache hits, but none were found.",
        )
        self.assertFalse(
            tracker.has_table1_execution(),
            "Second execution should NOT re-run Table1 reporter.",
        )
        self.assertFalse(
            tracker.has_tte_execution(),
            "Second execution should NOT re-run TimeToEvent reporter.",
        )

    def test_03_third_execution_still_cached(self):
        """Third execution confirms cache is stable across multiple runs."""
        with _ExecutionTracker() as tracker:
            self.cohort.execute(
                tables=self.tables,
                con=self.con,
                overwrite=True,
                lazy_execution=True,
            )
            tracker.print_summary("Third execution (should still be cached)")

        n_computed = tracker.count_node_computations()
        self.assertEqual(
            n_computed,
            0,
            f"Third execution should compute 0 nodes, but {n_computed} were computed.",
        )
        self.assertFalse(
            tracker.has_table1_execution(),
            "Third execution should NOT re-run Table1 reporter.",
        )
        self.assertFalse(
            tracker.has_tte_execution(),
            "Third execution should NOT re-run TimeToEvent reporter.",
        )

    def test_04_reports_accessible_after_cached_execution(self):
        """Reports should be accessible even when loaded from cache."""
        self.cohort.execute(
            tables=self.tables,
            con=self.con,
            overwrite=True,
            lazy_execution=True,
        )

        # Table1 should be accessible
        t1 = self.cohort.table1
        self.assertIsNotNone(t1, "Table1 should be accessible after cached execution.")
        self.assertGreater(len(t1), 0, "Table1 should have rows.")

        # Waterfall should be accessible
        wf = self.cohort.waterfall
        self.assertIsNotNone(
            wf, "Waterfall should be accessible after cached execution."
        )
        self.assertGreater(len(wf), 0, "Waterfall should have rows.")

    def test_05_write_reports_after_cached_execution(self):
        """Reports should be exportable to JSON/Excel after cached execution."""
        self.cohort.execute(
            tables=self.tables,
            con=self.con,
            overwrite=True,
            lazy_execution=True,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            self.cohort.write_reports_to_json(tmpdir)
            # Check that expected files were created
            expected_files = [
                "table1.json",
                "waterfall.json",
                "waterfall_detailed.json",
            ]
            for fname in expected_files:
                fpath = os.path.join(tmpdir, fname)
                self.assertTrue(
                    os.path.exists(fpath),
                    f"Expected report file {fname} not found after cached execution.",
                )


class TestSubcohortLazyExecution(unittest.TestCase):
    """Test that subcohort execution works correctly with lazy execution."""

    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.mkdtemp()
        cls._db_path = os.path.join(cls._tmpdir, "test_lazy_subcohort.duckdb")

        cls.con = DuckDBConnector(DUCKDB_DEST_DATABASE=cls._db_path)
        cls.tables = _build_test_tables(cls.con)
        cls.cohort, cls.right_censor = _build_cohort(cls.tables)
        cls.subcohort = _build_subcohort(cls.cohort)

        logging.getLogger("phenex").setLevel(logging.DEBUG)

    def test_01_parent_then_subcohort_first_run(self):
        """First run: parent cohort and subcohort should both fully execute."""
        with _ExecutionTracker() as tracker:
            self.cohort.execute(
                tables=self.tables,
                con=self.con,
                overwrite=True,
                lazy_execution=True,
            )
            tracker.print_summary("Parent cohort - first run")

        parent_computed = tracker.count_node_computations()
        self.assertGreater(
            parent_computed, 0, "Parent cohort should compute nodes on first run."
        )

        # Execute subcohort
        with _ExecutionTracker() as tracker:
            self.subcohort.execute(
                tables=self.tables,
                con=self.con,
                overwrite=True,
                lazy_execution=True,
            )
            tracker.print_summary("Subcohort - first run")

        self.assertIsNotNone(self.subcohort.index_table)

    def test_02_parent_cached_subcohort_cached(self):
        """Second run: both parent and subcohort should use cache."""
        with _ExecutionTracker() as tracker:
            self.cohort.execute(
                tables=self.tables,
                con=self.con,
                overwrite=True,
                lazy_execution=True,
            )
            tracker.print_summary("Parent cohort - second run (cached)")

        n_computed = tracker.count_node_computations()
        self.assertEqual(
            n_computed,
            0,
            f"Parent cohort should use cache on second run, but {n_computed} nodes were computed.",
        )
        self.assertFalse(
            tracker.has_table1_execution(),
            "Parent Table1 should NOT re-execute on second run.",
        )

        with _ExecutionTracker() as tracker:
            self.subcohort.execute(
                tables=self.tables,
                con=self.con,
                overwrite=True,
                lazy_execution=True,
            )
            tracker.print_summary("Subcohort - second run (cached)")

        self.assertIsNotNone(self.subcohort.index_table)


if __name__ == "__main__":
    unittest.main()
