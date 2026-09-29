import matplotlib

matplotlib.use("Agg")

import logging
import os
import tempfile
import unittest
from unittest import mock

from phenex.codelists import Codelist
from phenex.core import Cohort, Subcohort
from phenex.core.database import Database
from phenex.core.study import Study
from phenex.ibis_connect import DuckDBConnector
from phenex.node import Node
from phenex.phenotypes import CodelistPhenotype
from phenex.reporting.reporter import Reporter
from phenex.test.cohort.test_cohort_lazy_execution import (
    _build_cohort,
    _build_subcohort,
    _build_test_tables,
    _ExecutionTracker,
)
from phenex.test.cohort.test_mappings import TestDomains


class TinyCounts(Reporter):
    """Minimal study-level reporter: one index row count, sets self.df.
    Reads only what the subcohort proxy also exposes."""

    def execute(self, cohort):
        import pandas as pd

        self.df = pd.DataFrame(
            [{"what": "index_rows", "n": int(cohort.index_table.count().execute())}]
        )
        return self.df


def _build_second_cohort():
    entry = CodelistPhenotype(
        name="c2_entry_drug",
        return_date="first",
        codelist=Codelist(["d1"]).copy(use_code_type=False),
        domain="DRUG_EXPOSURE",
    )
    return Cohort(name="second_cohort", entry_criterion=entry)


class TestStudyLoad(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.mkdtemp()
        cls._db_path = os.path.join(cls._tmpdir, "study_load.duckdb")
        cls._meta_db = os.path.join(cls._tmpdir, "phenex.db")

        from phenex.node_manager import NodeManager

        cls._orig_node_manager = Node._node_manager
        Node._node_manager = NodeManager(db_name=cls._meta_db)

        cls.con = DuckDBConnector(DUCKDB_DEST_DATABASE=cls._db_path)
        cls.tables = _build_test_tables(cls.con)
        cls.database = Database(connector=cls.con, mapper=TestDomains)

        c1, _ = _build_cohort(cls.tables)
        c1.custom_reporters = []
        sub = _build_subcohort(c1)
        c2 = _build_second_cohort()
        study = Study(
            path=os.path.join(cls._tmpdir, "results"),
            name="load_study",
            cohorts=[c1, sub, c2],
            database=cls.database,
            custom_reporters=[TinyCounts()],  # a STUDY-level reporter
        )
        study.execute(overwrite=True, lazy_execution=True)
        cls.n_c1 = c1.index_table.count().execute()
        cls.n_sub = sub.index_table.count().execute()
        cls.n_c2 = c2.index_table.count().execute()

        logging.getLogger("phenex").setLevel(logging.DEBUG)

    @classmethod
    def tearDownClass(cls):
        Node._node_manager = cls._orig_node_manager

    def _fresh_study(self):
        """A never-executed Study with identical definitions; the subcohort is
        deliberately listed BEFORE its parent."""
        c1, _ = _build_cohort(self.tables)
        c1.custom_reporters = []  # match the executed fixture
        sub = _build_subcohort(c1)
        c2 = _build_second_cohort()
        study = Study(
            path=os.path.join(self._tmpdir, "results"),
            name="load_study",
            cohorts=[sub, c1, c2],
            database=self.database,
            custom_reporters=[TinyCounts()],
        )
        return study, c1, sub, c2

    def test_study_load_sets_all_cohort_tables(self):
        study, c1, sub, c2 = self._fresh_study()
        study.load()
        self.assertIsNotNone(c1.table)
        self.assertIsNotNone(sub.table)
        self.assertIsNotNone(c2.table)
        self.assertEqual(c1.index_table.count().execute(), self.n_c1)
        self.assertEqual(sub.index_table.count().execute(), self.n_sub)
        self.assertEqual(c2.index_table.count().execute(), self.n_c2)

    def test_study_load_shares_one_listing_per_connector(self):
        study, *_ = self._fresh_study()
        calls = []
        orig = DuckDBConnector.list_dest_tables

        def spy(con_self):
            calls.append(1)
            return orig(con_self)

        with mock.patch.object(DuckDBConnector, "list_dest_tables", spy):
            study.load()
        self.assertEqual(len(calls), 1, "one destination listing for the study")

    def test_study_load_missing_destination_warns_and_sets_none(self):
        study, c1, sub, c2 = self._fresh_study()
        with mock.patch("phenex.core.cohort._list_dest_tables", return_value=None):
            with self.assertLogs("phenex", level="WARNING") as cm:
                study.load()
        self.assertIsNone(c1.table)
        self.assertIsNone(sub.table)
        self.assertIsNone(c2.table)
        self.assertTrue(
            any("found 0 of" in m for m in cm.output),
            f"every cohort warns nothing was found: {cm.output}",
        )

    def test_study_load_then_lazy_execute(self):
        study, c1, *_ = self._fresh_study()
        study.load()
        with _ExecutionTracker() as tracker:
            study.execute(overwrite=True, lazy_execution=True)
        self.assertEqual(
            tracker.count_node_computations(),
            0,
            "a loaded, unchanged study re-executes entirely from cache",
        )
        self.assertEqual(c1.index_table.count().execute(), self.n_c1)

    def test_study_level_custom_reporter_attaches_on_load(self):
        study, c1, *_ = self._fresh_study()
        study.load()
        self.assertTrue(c1.custom_reporter_nodes, "reporter node rebuilt on load")
        node = c1.custom_reporter_nodes[0]
        self.assertIsNotNone(node.table, "stored report table attached")
        self.assertFalse(node.df_report.empty)
        self.assertEqual(c1.custom_reporters, [], "merge is restored after load")

    def test_subcohort_execute_after_study_load(self):
        study, c1, sub, _ = self._fresh_study()
        study.load()
        sub.execute(
            tables=self.tables,
            con=self.con,
            overwrite=True,
            lazy_execution=True,
            sql_dir=os.path.join(self._tmpdir, "sub_sql"),
        )
        self.assertIsNotNone(sub.waterfall)
        self.assertEqual(sub.index_table.count().execute(), self.n_sub)
        self.assertEqual(c1._n_persons_in_source_database, 10)


if __name__ == "__main__":
    unittest.main()
