import glob
import os
import shutil
import unittest

from phenex.codelists import Codelist
from phenex.core import Cohort, Subcohort
from phenex.core.study import Study
from phenex.core.sql_view import SQLView, referenced_sidecars
from phenex.core.subcohort import _SubcohortIndexNode
from phenex.node import Node
from phenex.node_manager import NodeManager
from phenex.phenotypes import CodelistPhenotype
from phenex.sim import DatabaseMocker

CODE = 4119602  # a code present in DatabaseMocker's CONDITION_OCCURRENCE


class _ToSqlViewBase(unittest.TestCase):
    """Shared fixture for the SQLView tests. The essential set lives here; the
    exhaustive edge-case set is in test_to_sql_view_local.py (kept local)."""

    def setUp(self):
        self.workdir = os.path.join(
            os.path.dirname(__file__), "artifacts", self._testMethodName
        )
        if os.path.exists(self.workdir):
            shutil.rmtree(self.workdir)
        os.makedirs(self.workdir)
        self.results = os.path.join(self.workdir, "results")
        self.db = DatabaseMocker(n_patients=50).get_database()
        # Isolate the global node-state cache so other tests can't affect these.
        self._prev = Node._node_manager
        Node._node_manager = NodeManager(
            db_name=os.path.join(self.workdir, "phenex.db")
        )

    def tearDown(self):
        Node._node_manager = self._prev

    def _cohort(self, name="cohort"):
        entry = CodelistPhenotype(
            name=f"{name}_entry",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist([CODE]).copy(use_code_type=False),
        )
        incl = CodelistPhenotype(
            name=f"{name}_incl",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist([CODE]).copy(use_code_type=False),
        )
        return Cohort(
            name=name, entry_criterion=entry, inclusions=[incl], database=self.db
        )

    def _run(self, *cohorts, lazy=False):
        study = Study(name="s", cohorts=list(cohorts), path=self.results)
        study.execute(overwrite=True, lazy_execution=lazy)
        return study

    def _sql_dir(self, cohort_name):
        return glob.glob(
            os.path.join(self.results, "**", cohort_name, "sql"), recursive=True
        )[0]

    # SQLView is lazy, dict-like


class TestToSqlView(_ToSqlViewBase):
    def test_construction_compiles_nothing(self):
        # Building a view and inspecting keys/len/membership must never resolve.
        calls = []
        v = SQLView(
            {"a": 1, "b": 2},
            lambda item: calls.append(item) or f"sql{item}",
            noun="node",
        )
        self.assertEqual(v.keys(), ["a", "b"])
        self.assertEqual(len(v), 2)
        self.assertIn("a", v)
        self.assertEqual(calls, [])  # nothing resolved yet
        self.assertEqual(v["a"], "sql1")  # resolves only on access
        self.assertEqual(calls, [1])

    # invariant: view[name] == saved .sql
    def test_view_matches_saved_sql_files(self):
        c = self._cohort()
        self._run(c)
        sql_dir = self._sql_dir(c.name)
        v = c.to_sql()
        self.assertTrue(len(v) >= 3)
        for name, sql in v.items():
            fp = os.path.join(sql_dir, f"{name}.sql")
            self.assertTrue(os.path.exists(fp), f"missing file for node {name}")
            self.assertEqual(sql.strip(), open(fp).read().strip())

    # fresh (un-executed) object: roll-ups re-created with NO db query
    def test_to_sql_rebuilds_rollups_when_missing(self):
        c = self._cohort()
        self._run(c, lazy=True)  # lazy run populates the phenex.db SQL cache
        fresh = self._cohort()  # same definition, this object never executed
        self.assertIsNone(fresh.index_table_node)
        v = (
            fresh.to_sql()
        )  # re-creates the roll-up nodes (no query), resolves via cache
        self.assertIsNotNone(fresh.index_table_node)
        idx = [k for k in v.keys() if k.endswith("INDEX")]
        self.assertTrue(idx, "index node missing after roll-up rebuild")
        self.assertTrue(v[idx[0]].strip())  # resolves from cache

    def test_unresolvable_node_returns_none_not_raise(self):
        # Fresh cohort, never executed, no cache/files: resolving must not crash.
        c = self._cohort()
        v = c.to_sql()  # roll-ups re-created (no db query); nothing is resolvable yet
        idx = [k for k in v.keys() if k.endswith("INDEX")][0]
        self.assertIsNone(v[idx])  # graceful None + warning, not a RuntimeError

    # sql_dir lists every saved file, including ones with no node object
    def test_sql_dir_lists_all_saved_files(self):
        # Subset and reporter nodes exist only after execute(). A fresh object never
        # executed has none, so listing must come off the folder to stay complete.
        c = self._cohort("all")
        self._run(c)
        sql_dir = self._sql_dir("all")
        on_disk = {f[:-4] for f in os.listdir(sql_dir) if f.endswith(".sql")}

        fresh = self._cohort("all")  # same definition, this object never executed
        v = fresh.to_sql(sql_dir=sql_dir)
        self.assertEqual(set(v.keys()), on_disk, "view must list every saved .sql")
        for name in v.keys():
            self.assertEqual(
                v[name].strip(),
                open(os.path.join(sql_dir, f"{name}.sql")).read().strip(),
            )

    def test_sql_dir_lists_codelist_sidecars(self):
        # Sidecars are real SQL you need to run the query, so they are listed too.
        c = self._cohort("side_listed")
        self._run(c)
        sql_dir = self._sql_dir("side_listed")
        keys = self._cohort("side_listed").to_sql(sql_dir=sql_dir).keys()
        self.assertTrue(
            [k for k in keys if k.startswith("ibis_pandas_memtable")],
            "codelist sidecars must appear in the view",
        )

    # a partial list warns, a complete one stays quiet
    def test_zero_arg_partial_list_warns(self):
        c = self._cohort("warnzero")
        self._run(c, lazy=True)
        fresh = self._cohort("warnzero")  # fresh session, no _last_sql_dir
        with self.assertLogs("phenex", level="WARNING") as cm:
            fresh.to_sql()
        msg = "\n".join(cm.output)
        self.assertIn("partial", msg)
        self.assertIn("sql_dir", msg)  # and it says how to get all of it

    def test_referenced_sidecars(self):
        # The shared primitive both the write gap-check and the read incompleteness
        # warning use, pinned on its own so the memtable pattern has one source of truth.
        sql = (
            'SELECT * FROM "ibis_pandas_memtable_abc123" '
            'JOIN "ibis_pandas_memtable_def456" USING (code)'
        )
        self.assertEqual(
            referenced_sidecars(sql),
            {"ibis_pandas_memtable_abc123", "ibis_pandas_memtable_def456"},
        )
        self.assertEqual(referenced_sidecars("SELECT 1"), set())  # no codelists
        self.assertEqual(referenced_sidecars(None), set())  # tolerates None
        self.assertEqual(referenced_sidecars(""), set())

    def test_to_sql_bad_path_errors(self):
        # A typo'd sql_dir must not be reported as read from, it errors and falls back.
        c = self._cohort("typo")
        self._run(c)
        with self.assertLogs("phenex", level="ERROR") as cm:
            c.to_sql(sql_dir="/no/such/folder/sql")
        msg = "\n".join(cm.output)
        self.assertIn("is not a folder", msg)
        self.assertNotIn("reading saved SQL from '/no/such/folder", msg)

    def test_reading_incomplete_folder_warns(self):
        # A folder whose SQL references a codelist file it does not contain must warn
        # on read, not just at write time, so a copied or reopened folder is not silent.
        c = self._cohort("incomplete")
        self._run(c, lazy=True)
        sql_dir = self._sql_dir("incomplete")
        sidecars = glob.glob(os.path.join(sql_dir, "ibis_pandas_memtable*.sql"))
        self.assertTrue(sidecars, "precondition: a codelist sidecar must exist")
        os.remove(sidecars[0])  # simulate the cache-hit gap: a referenced file is gone

        with self.assertLogs("phenex", level="INFO") as cm:
            self._cohort("incomplete").to_sql(sql_dir=sql_dir)
        msg = "\n".join(cm.output)
        self.assertIn("reused from a previous execution", msg)
        self.assertIn("codelist file", msg)

    # saved .sql is utf-8 on every platform, and older cp1252 folders still read
    def test_cp1252_saved_file_still_reads(self):
        # A folder written by an older Windows run holds cp1252 bytes (0xa0, the
        # non-breaking space codelist text carries). Reading it must still work.
        c = self._cohort("cp1252")
        self._run(c)
        sql_dir = self._sql_dir("cp1252")
        with open(os.path.join(sql_dir, "LEGACY.sql"), "wb") as f:
            f.write("SELECT '\xa0\xa0Hf hospi' AS x".encode("cp1252"))

        v = self._cohort("cp1252").to_sql(sql_dir=sql_dir)
        self.assertIn("LEGACY", v.keys())
        self.assertIn("Hf hospi", v["LEGACY"])  # decoded, not None and not a crash

    def test_saved_sql_files_are_utf8(self):
        # Non-ascii in a node name must land in the file as utf-8, so the folder
        # reads on any machine rather than only the one that wrote it.
        entry = CodelistPhenotype(
            name="ANGINE_DE_POITRINE_é",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist([CODE]).copy(use_code_type=False),
        )
        c = Cohort(name="utf8", entry_criterion=entry, database=self.db)
        self._run(c)
        sql_dir = self._sql_dir("utf8")
        for f in os.listdir(sql_dir):
            if f.endswith(".sql"):  # strict utf-8, no fallback, must not raise
                open(os.path.join(sql_dir, f), encoding="utf-8").read()

    # cache-hit sidecar gap is warned, not silent
    def test_cache_hit_missing_sidecar_warns(self):
        # A codelist-backed cohort. The first lazy run writes the memtable sidecar
        # and fills phenex.db. A second lazy run of the SAME definition into a NEW
        # folder hits the cache: it restores the node SQL but NOT the sidecar, and
        # must warn about the gap (rather than leaving the folder silently broken).
        c1 = self._cohort("side")
        self._run(c1, lazy=True)  # fresh: sidecar written + cache populated
        dir1 = self._sql_dir("side")
        self.assertTrue(
            glob.glob(os.path.join(dir1, "ibis_pandas_memtable*.sql")),
            "precondition: a fresh lazy run should write a codelist sidecar",
        )

        # second run, same definition (cache hit), into a DIFFERENT results folder
        c2 = self._cohort("side")
        results2 = os.path.join(self.workdir, "results2")
        study2 = Study(name="s", cohorts=[c2], path=results2)
        with self.assertLogs("phenex", level="INFO") as cm:
            study2.execute(overwrite=True, lazy_execution=True)
        msg = "\n".join(cm.output)
        self.assertIn("reused from a previous execution", msg)
        self.assertIn("codelist file", msg)
        # one summary message, not one per node
        self.assertEqual(
            sum("reused from a previous execution" in line for line in cm.output),
            1,
            "the cache-hit gap must inform once for the cohort, not per node",
        )

        # and the sidecar really is absent in the second folder (the gap we warn about)
        dir2 = glob.glob(os.path.join(results2, "**", "side", "sql"), recursive=True)[0]
        self.assertFalse(
            glob.glob(os.path.join(dir2, "ibis_pandas_memtable*.sql")),
            "cache-hit run must not have rewritten the sidecar",
        )

    # Subcohort view: own nodes only
    def test_subcohort_to_sql_own_nodes_only(self):
        parent = self._cohort("parent")
        extra = CodelistPhenotype(
            name="extra_incl",
            domain="CONDITION_OCCURRENCE",
            codelist=Codelist([CODE]).copy(use_code_type=False),
        )
        sub = Subcohort(name="refined", cohort=parent, inclusions=[extra])
        self._run(parent, sub)
        v = sub.to_sql()
        keys = v.keys()
        # its own index is present and resolves
        idx = [k for k in keys if k.endswith("INDEX")]
        self.assertTrue(idx)
        self.assertTrue(v[idx[0]].strip())
        # the parent's entry criterion must NOT appear (own nodes only)
        self.assertFalse(any("PARENT_ENTRY" in k for k in keys))


if __name__ == "__main__":
    unittest.main()
