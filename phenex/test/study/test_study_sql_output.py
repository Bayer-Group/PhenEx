import glob
import os
import shutil
import unittest

from phenex.codelists import Codelist
from phenex.core import Cohort, Subcohort
from phenex.core.study import Study
from phenex.node import Node
from phenex.node_manager import NodeManager
from phenex.phenotypes import CodelistPhenotype
from phenex.sim import DatabaseMocker


class TestStudySqlOutput(unittest.TestCase):
    def setUp(self):
        self.workdir = os.path.join(
            os.path.dirname(__file__), "artifacts", self._testMethodName
        )
        if os.path.exists(self.workdir):
            shutil.rmtree(self.workdir)
        os.makedirs(self.workdir)
        self.results = os.path.join(self.workdir, "results")
        self.db = DatabaseMocker(n_patients=50).get_database()
        # Isolate the global node-state cache so other tests' lazy state can't suppress recompute here.
        self._prev_node_manager = Node._node_manager
        Node._node_manager = NodeManager(
            db_name=os.path.join(self.workdir, "phenex.db")
        )

    def tearDown(self):
        Node._node_manager = self._prev_node_manager

    def _cohort(self, name):
        entry = CodelistPhenotype(
            name=f"{name}_entry",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist([4119602]).copy(use_code_type=False),
        )
        return Cohort(name=name, entry_criterion=entry, database=self.db)

    def _cohort_sql_dir(self, cohort_name):
        """The single .../<study>/<run>/<cohort>/sql directory, or None if absent."""
        matches = glob.glob(
            os.path.join(self.results, "**", cohort_name, "sql"), recursive=True
        )
        return matches[0] if len(matches) == 1 else None

    def test_each_cohort_gets_its_own_sql_folder(self):
        cohorts = [self._cohort("cohort_a"), self._cohort("cohort_b")]
        study = Study(name="sqltest", cohorts=cohorts, path=self.results)
        # Non-lazy so every node computes and writes its SQL deterministically.
        study.execute(overwrite=True, lazy_execution=False)

        sql_dir_a = self._cohort_sql_dir("cohort_a")
        sql_dir_b = self._cohort_sql_dir("cohort_b")

        # Each cohort has exactly one sql/ folder under its own execution dir.
        self.assertIsNotNone(sql_dir_a, "cohort_a has no sql/ folder")
        self.assertIsNotNone(sql_dir_b, "cohort_b has no sql/ folder")

        # The folders are distinct (not a shared flat directory).
        self.assertNotEqual(sql_dir_a, sql_dir_b)

        # Each folder actually contains per-node .sql files.
        self.assertTrue(
            glob.glob(os.path.join(sql_dir_a, "*.sql")), "cohort_a wrote no SQL"
        )
        self.assertTrue(
            glob.glob(os.path.join(sql_dir_b, "*.sql")), "cohort_b wrote no SQL"
        )

        # The sql/ folder sits inside the study output tree, beside the cohort's reports.
        self.assertTrue(sql_dir_a.startswith(self.results))
        self.assertTrue(sql_dir_b.startswith(self.results))

        # Exactly one .sql file per collected node, named for that node.
        for cohort, sql_dir in ((cohorts[0], sql_dir_a), (cohorts[1], sql_dir_b)):
            expected = {
                f"{n.get_table_name()}.sql" for n in cohort._collect_all_nodes()
            }
            actual = {
                os.path.basename(p)
                for p in glob.glob(os.path.join(sql_dir, "*.sql"))
                # exclude codelist sidecars (ibis_pandas_memtable_*.sql), not node files
                if not os.path.basename(p).startswith("ibis_pandas_memtable")
            }
            self.assertEqual(
                actual, expected, f"{cohort.name}: sql files != nodes (missing/extra)"
            )

    def test_study_with_subcohort_writes_subcohort_sql(self):
        """A Study containing a Subcohort executes (Study passes sql_dir to every
        cohort, including Subcohorts) and the subcohort writes its OWN SQL: its
        extra criteria and its index query, without duplicating the parent's nodes."""
        parent = self._cohort("parent_c")
        extra_incl = CodelistPhenotype(
            name="extra_incl",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist([4119602]).copy(use_code_type=False),
        )
        sub = Subcohort(name="refined", cohort=parent, inclusions=[extra_incl])

        study = Study(name="subsqltest", cohorts=[parent, sub], path=self.results)
        # Regression guard: before Subcohort.execute accepted sql_dir, this raised
        # TypeError (Study passes sql_dir to every cohort). Must not raise.
        study.execute(overwrite=True, lazy_execution=False)

        sub_dir = self._cohort_sql_dir(sub.name)
        self.assertIsNotNone(sub_dir, "subcohort has no sql/ folder")

        sub_files = {
            os.path.basename(p)
            for p in glob.glob(os.path.join(sub_dir, "*.sql"))
            if not os.path.basename(p).startswith("ibis_pandas_memtable")
        }

        # The subcohort's index query is written, named for its materialized table.
        index_file = f"{sub.name}__INDEX".upper() + ".sql"
        self.assertIn(index_file, sub_files, "subcohort index SQL not written")

        # The subcohort's extra criterion is written.
        self.assertTrue(
            any("EXTRA_INCL" in f for f in sub_files),
            "subcohort extra inclusion SQL not written",
        )

        # Parent nodes are NOT duplicated into the subcohort folder (they live in
        # the parent cohort's own sql/ dir).
        self.assertFalse(
            any("PARENT_C_ENTRY" in f for f in sub_files),
            "parent nodes leaked into the subcohort's SQL folder",
        )

        # The saved index SQL runs and reproduces the materialized index table.
        idx_sql = open(os.path.join(sub_dir, index_file)).read()
        n_sql = self.db.connector.dest_connection.sql(idx_sql).count().execute()
        n_tbl = sub.index_table.count().execute()
        self.assertEqual(n_sql, n_tbl, "subcohort index SQL does not round-trip")


if __name__ == "__main__":
    unittest.main()
