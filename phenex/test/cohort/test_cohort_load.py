import matplotlib

matplotlib.use("Agg")

import datetime
import json
import logging
import os
import tempfile
import unittest
from unittest import mock

from phenex.codelists import Codelist
from phenex.core import Cohort
from phenex.core.database import Database
from phenex.filters import GreaterThanOrEqualTo, RelativeTimeRangeFilter
from phenex.ibis_connect import DuckDBConnector
from phenex.node import Node
from phenex.phenotypes import (
    AgePhenotype,
    CodelistPhenotype,
    SexPhenotype,
    TimeRangePhenotype,
)
from phenex.reporting import TimeToEvent
from phenex.test.cohort.test_cohort_lazy_execution import (
    _build_cohort,
    _build_test_tables,
    _ExecutionTracker,
)
from phenex.test.cohort.test_mappings import TestDomains


ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts", "load")


def write_artifact(name, payload):
    """Write one run's payload to artifacts/load/<name> for inspection."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    with open(os.path.join(ARTIFACTS_DIR, name), "w") as f:
        json.dump(payload, f, indent=2, sort_keys=True)


FROZEN_PLAN = {
    "cohort": "completeness_cohort",
    "prefix": "COMPLETENESS_COHORT",
    "found": 31,
    "total": 31,
    "steps": {
        name: "found"
        for name in [
            "AGE",
            "CHARACTERISTICS",
            "CMP_COVERAGE_180",
            "CMP_COVERAGE_30",
            "CMP_COVERAGE_365",
            "CMP_COVERAGE_90",
            "CMP_ENTRY_DRUG",
            "CMP_EXCLUSION_D_CENSOR",
            "CMP_EXCLUSION_D_OUTCOME",
            "CMP_EXCLUSION_E_EXCL",
            "CMP_OUTCOME_EVENT",
            "CUSTOM__TIMETOEVENT",
            "EXCLUSIONS",
            "INCLUSIONS",
            "INDEX",
            "OUTCOMES",
            "SEX",
            "SUBSET_ENTRY_CONDITION_OCCURRENCE",
            "SUBSET_ENTRY_DRUG_EXPOSURE",
            "SUBSET_ENTRY_OBSERVATION_PERIOD",
            "SUBSET_ENTRY_PERSON",
            "SUBSET_INDEX_CONDITION_OCCURRENCE",
            "SUBSET_INDEX_DRUG_EXPOSURE",
            "SUBSET_INDEX_OBSERVATION_PERIOD",
            "SUBSET_INDEX_PERSON",
            "TABLE1",
            "TABLE1_DETAILED",
            "TABLE1_OUTCOMES",
            "TABLE1_OUTCOMES_DETAILED",
            "WATERFALL",
            "WATERFALL_DETAILED",
        ]
    },
}

FROZEN_SHAPES = {
    "index_rows": 8,
    "n_persons_in_source_database": 10,
    "table1": [4, 12],
    "waterfall": [10, 13],
    "entry_subsets": {
        "CONDITION_OCCURRENCE": 7,
        "DRUG_EXPOSURE": 22,
        "OBSERVATION_PERIOD": 10,
        "PERSON": 10,
    },
    "index_subsets": {
        "CONDITION_OCCURRENCE": 5,
        "DRUG_EXPOSURE": 16,
        "OBSERVATION_PERIOD": 8,
        "PERSON": 8,
    },
}

FROZEN_FLAG_MATRIX = {
    "entry=True,index=True": {
        "entry": {"written": 4, "reads_from": ["stored_entry_subset"]},
        "index": {"written": 4, "reads_from": ["stored_index_subset"]},
    },
    "entry=True,index=False": {
        "entry": {"written": 4, "reads_from": ["stored_entry_subset"]},
        "index": {
            "written": 0,
            "reads_from": ["index_table", "stored_entry_subset"],
        },
    },
    "entry=False,index=True": {
        "entry": {"written": 0, "reads_from": ["entry_phenotype", "source_table"]},
        "index": {"written": 4, "reads_from": ["stored_index_subset"]},
    },
    "entry=False,index=False": {
        "entry": {"written": 0, "reads_from": ["entry_phenotype", "source_table"]},
        "index": {
            "written": 0,
            "reads_from": ["entry_phenotype", "index_table", "source_table"],
        },
    },
}

FROZEN_FLAG_ROW_COUNTS = {
    "entry": {
        "CONDITION_OCCURRENCE": 7,
        "DRUG_EXPOSURE": 22,
        "OBSERVATION_PERIOD": 10,
        "PERSON": 10,
    },
    "index": {
        "CONDITION_OCCURRENCE": 5,
        "DRUG_EXPOSURE": 16,
        "OBSERVATION_PERIOD": 8,
        "PERSON": 8,
    },
}


class TestLazyTableMechanism(unittest.TestCase):
    """The Node.table property with an attachable loader."""

    def test_assignment_clears_loader(self):
        node = Node("LOADER_CLEAR_NODE")
        calls = []

        class FakeCon:
            def get_dest_table(self, name):
                calls.append(name)
                return f"TBL:{name}"

        node.attach_lazy_table(FakeCon(), "SOME_TABLE")
        node.table = "ASSIGNED"
        self.assertEqual(node.table, "ASSIGNED")
        self.assertEqual(calls, [])

    def test_failed_loader_warns_and_stays_none(self):
        node = Node("LOADER_FAIL_NODE")
        calls = []

        class BadCon:
            def get_dest_table(self, name):
                calls.append(name)
                raise ValueError("gone")

        node.attach_lazy_table(BadCon(), "MISSING_TABLE")
        self.assertIsNone(node.table)
        self.assertIsNone(node.table)  # not retried
        self.assertEqual(calls, ["MISSING_TABLE"])


class TestCohortLoad(unittest.TestCase):
    """load() reconnects a fresh cohort object to the
    tables a previous session executed, without recomputing anything."""

    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.mkdtemp()
        cls._db_path = os.path.join(cls._tmpdir, "load_test.duckdb")
        cls._meta_db = os.path.join(cls._tmpdir, "phenex.db")
        cls._sql_dir = os.path.join(cls._tmpdir, "sql")

        # Isolate node state
        from phenex.node_manager import NodeManager

        cls._orig_node_manager = Node._node_manager
        Node._node_manager = NodeManager(db_name=cls._meta_db)

        cls.con = DuckDBConnector(DUCKDB_DEST_DATABASE=cls._db_path)
        cls.tables = _build_test_tables(cls.con)
        cohort, _ = _build_cohort(cls.tables)
        cohort.execute(
            tables=cls.tables,
            con=cls.con,
            overwrite=True,
            lazy_execution=True,
            sql_dir=cls._sql_dir,
        )
        cls.orig_n = cohort.index_table.count().execute()

        logging.getLogger("phenex").setLevel(logging.DEBUG)

    @classmethod
    def tearDownClass(cls):
        Node._node_manager = cls._orig_node_manager

    def _fresh_cohort(self, with_mapper=True):
        """A never-executed Cohort object with the exact same definition."""
        cohort, _ = _build_cohort(self.tables)
        if with_mapper:
            cohort.database = Database(connector=self.con, mapper=TestDomains)
        return cohort

    def test_load_reconnects_the_cohort(self):
        """The cohort's own connector, an explicit one, or neither, and the
        one-line summary that says what was found."""
        own = self._fresh_cohort(with_mapper=False)
        own.database = Database(connector=self.con)
        with self.assertLogs("phenex", level="INFO") as cm:
            own.load()
        self.assertIsNotNone(own.table, "the cohort's own connector is used")
        self.assertTrue(
            any("found" in m and "result tables" in m for m in cm.output),
            f"the one-line summary is logged: {cm.output}",
        )

        passed = self._fresh_cohort(with_mapper=False)
        passed.load(con=self.con)
        self.assertIsNotNone(passed.table, "an explicit con= is used")

        neither, _ = _build_cohort(self.tables)
        with self.assertRaises(ValueError):
            neither.load()

    def test_empty_destination_reads_as_none_and_says_why(self):
        empty_con = DuckDBConnector(
            DUCKDB_DEST_DATABASE=os.path.join(self._tmpdir, "empty.duckdb")
        )
        cohort, _ = _build_cohort(self.tables)
        with self.assertLogs("phenex", level="WARNING") as cm:
            cohort.load(con=empty_con)
        self.assertIsNone(cohort.table)
        self.assertIsNone(cohort.entry_criterion.table)
        self.assertTrue(
            any("found 0 of" in m for m in cm.output),
            f"nothing-found warns with a hint at the cause: {cm.output}",
        )

        with self.assertLogs("phenex.core.cohort", level="WARNING") as cm:
            self.assertIsNone(cohort.table1)
        self.assertTrue(
            any("table1 has no saved result" in m for m in cm.output),
            f"an empty report explains itself on access: {cm.output}",
        )

    def test_to_sql_after_load_reads_file(self):
        cohort = self._fresh_cohort()
        cohort.load(con=self.con)
        sql = cohort.entry_criterion.to_sql(sql_dir=self._sql_dir)
        self.assertIn("SELECT", sql.upper())

    def test_load_is_lazy_no_per_node_fetch(self):
        cohort = self._fresh_cohort()
        calls = []
        orig = DuckDBConnector.get_dest_table

        def spy(con_self, name):
            calls.append(name)
            return orig(con_self, name)

        with mock.patch.object(DuckDBConnector, "get_dest_table", spy):
            cohort.load(con=self.con)
            n_load = len(calls)
            self.assertLessEqual(n_load, 1, f"load fetched eagerly: {calls}")
            _ = cohort.entry_criterion.table
            self.assertEqual(len(calls), n_load + 1, "first access fetches")
            _ = cohort.entry_criterion.table
            self.assertEqual(len(calls), n_load + 1, "second access is cached")

    def test_lazy_execute_after_load_new_characteristic(self):
        cohort = self._fresh_cohort(with_mapper=False)
        for i in (1, 2):
            new_char = CodelistPhenotype(
                name=f"newly_added_char_{i}",
                codelist=Codelist(["cond1"]).copy(use_code_type=False),
                domain="CONDITION_OCCURRENCE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="before",
                    min_days=GreaterThanOrEqualTo(0),
                    anchor_phenotype=cohort.entry_criterion,
                ),
            )
            cohort.characteristics.append(new_char)
            cohort.phenotypes.append(new_char)

        cohort.load(con=self.con)
        self.assertIsNone(cohort.characteristics[-1].table, "new char not executed yet")
        self.assertIsNotNone(cohort.entry_criterion.table, "old nodes attached")

        with _ExecutionTracker() as tracker:
            cohort.execute(
                tables=self.tables, con=self.con, overwrite=True, lazy_execution=True
            )
        computed_lines = [
            m.upper() for m in tracker._messages() if "computing..." in m.lower()
        ]
        self.assertTrue(
            any("NEWLY_ADDED_CHAR" in m for m in computed_lines),
            f"the new characteristics compute: {computed_lines}",
        )
        self.assertFalse(
            any("'ENTRY_DRUG'" in m for m in computed_lines),
            f"upstream stages stay cached: {computed_lines}",
        )
        self.assertIsNotNone(cohort.characteristics[-1].table)


class TestLoadCompleteness(unittest.TestCase):
    """The analyst case: many inclusions and exclusions, with the subset tables
    written to the destination (the default). Everything the run produced must
    come back, and the destination must hold nothing the plan cannot name."""

    COHORT_NAME = "completeness_cohort"

    @classmethod
    def setUpClass(cls):
        from phenex.node_manager import NodeManager

        cls._tmpdir = tempfile.mkdtemp()
        cls._orig_node_manager = Node._node_manager
        Node._node_manager = NodeManager(db_name=os.path.join(cls._tmpdir, "phenex.db"))
        cls.con = DuckDBConnector(
            DUCKDB_DEST_DATABASE=os.path.join(cls._tmpdir, "completeness.duckdb")
        )
        cls.tables = _build_test_tables(cls.con)
        cls.executed = cls._build_analyst_cohort()
        cls.executed.execute(
            tables=cls.tables,
            con=cls.con,
            overwrite=True,
            lazy_execution=True,
            sql_dir=None,
        )

    @classmethod
    def tearDownClass(cls):
        Node._node_manager = cls._orig_node_manager

    @staticmethod
    def _build_analyst_cohort():
        """Four inclusions, three exclusions, characteristics, an outcome and a
        custom reporter. write_subset_tables_entry/index are left at their
        defaults, which are True."""
        entry = CodelistPhenotype(
            name="cmp_entry_drug",
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        inclusions = [
            TimeRangePhenotype(
                name=f"cmp_coverage_{days}",
                relative_time_range=RelativeTimeRangeFilter(
                    min_days=GreaterThanOrEqualTo(days), anchor_phenotype=entry
                ),
            )
            for days in (30, 90, 180, 365)
        ]
        exclusions = [
            CodelistPhenotype(
                name=f"cmp_exclusion_{code}",
                codelist=Codelist([code]).copy(use_code_type=False),
                domain="DRUG_EXPOSURE",
                relative_time_range=RelativeTimeRangeFilter(
                    when="before",
                    min_days=GreaterThanOrEqualTo(0),
                    anchor_phenotype=entry,
                ),
            )
            for code in ("e_excl", "d_censor", "d_outcome")
        ]
        outcome = CodelistPhenotype(
            name="cmp_outcome_event",
            codelist=Codelist(["d_outcome"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            return_date="first",
        )
        right_censor = CodelistPhenotype(
            name="cmp_right_censor_event",
            codelist=Codelist(["d_censor"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            return_date="first",
        )
        return Cohort(
            name=TestLoadCompleteness.COHORT_NAME,
            entry_criterion=entry,
            inclusions=inclusions,
            exclusions=exclusions,
            characteristics=[AgePhenotype(anchor_phenotype=entry), SexPhenotype()],
            outcomes=[outcome],
            custom_reporters=[
                TimeToEvent(
                    right_censor_phenotypes=[right_censor],
                    end_of_study_period=datetime.date(2021, 12, 31),
                )
            ],
        )

    def _loaded_cohort(self, with_mapper=True):
        cohort = self._build_analyst_cohort()
        if with_mapper:
            cohort.database = Database(connector=self.con, mapper=TestDomains)
        cohort.load(con=self.con)
        return cohort

    @staticmethod
    def _planned_names(cohort):
        """The destination table name every step in the plan would write to."""
        prefix = cohort._clean_prefix
        return {n.get_table_name(prefix).upper() for n in cohort._collect_all_nodes()}

    def _destination_names(self, cohort):
        """The names actually in the destination that belong to this cohort."""
        prefix = cohort._clean_prefix
        return {
            t.upper()
            for t in self.con.list_dest_tables()
            if t.upper().startswith(prefix)
        }

    def test_plan_matches_the_frozen_artifact(self):
        """Every step load planned, and whether it was found. Freezing this
        catches a step leaving the plan, a naming change, and a subset table
        that stopped being written."""
        self.maxDiff = None
        cohort = self._loaded_cohort()
        prefix = cohort._clean_prefix
        destination = self._destination_names(cohort)
        steps = {}
        for node in cohort._collect_all_nodes():
            full = node.get_table_name(prefix).upper()
            short = full[len(prefix) + 2 :] if full.startswith(prefix + "__") else full
            steps[short] = "found" if full in destination else "missing"
        payload = {
            "cohort": cohort.name,
            "prefix": prefix,
            "found": sum(v == "found" for v in steps.values()),
            "total": len(steps),
            "steps": steps,
        }
        write_artifact("plan.json", payload)
        self.assertEqual(payload, FROZEN_PLAN)

    def test_shapes_match_the_frozen_artifact(self):
        """What a loaded cohort hands back: the index, both reports, both
        subset dicts, and the source person count."""
        self.maxDiff = None
        cohort = self._loaded_cohort()
        payload = {
            "index_rows": int(cohort.index_table.count().execute()),
            "n_persons_in_source_database": int(cohort.n_persons_in_source_database),
            "table1": list(cohort.table1.shape),
            "waterfall": list(cohort.waterfall.shape),
            "entry_subsets": {
                domain: int(t.table.count().execute())
                for domain, t in cohort.subset_tables_entry.items()
            },
            "index_subsets": {
                domain: int(t.table.count().execute())
                for domain, t in cohort.subset_tables_index.items()
            },
        }
        write_artifact("shapes.json", payload)
        self.assertEqual(payload, FROZEN_SHAPES)

    def test_destination_holds_nothing_the_plan_cannot_name(self):
        cohort = self._loaded_cohort()
        orphans = sorted(self._destination_names(cohort) - self._planned_names(cohort))
        self.assertEqual(orphans, [], f"results left behind by load: {orphans}")

        cohort = self._build_analyst_cohort()  # no database, so no mapper
        with self.assertLogs("phenex.core.cohort", level="INFO") as cm:
            cohort.load(con=self.con)
        total = len(cohort._collect_all_nodes())
        self.assertTrue(
            any(f"found {total} of {total} result tables" in m for m in cm.output),
            f"the summary still reads as complete: {cm.output}",
        )
        orphans = self._destination_names(cohort) - self._planned_names(cohort)
        self.assertNotEqual(
            orphans, set(), "the orphan check is what catches a shrunken plan"
        )


class TestSubsetTableFlags(unittest.TestCase):
    """Both subset flags, in all four combinations."""

    COMBINATIONS = [(True, True), (True, False), (False, True), (False, False)]

    @classmethod
    def setUpClass(cls):
        from phenex.node_manager import NodeManager

        cls._tmpdir = tempfile.mkdtemp()
        cls._orig_node_manager = Node._node_manager
        Node._node_manager = NodeManager(db_name=os.path.join(cls._tmpdir, "phenex.db"))
        cls.con = DuckDBConnector(
            DUCKDB_DEST_DATABASE=os.path.join(cls._tmpdir, "flags.duckdb")
        )
        cls.tables = _build_test_tables(cls.con)

        cls.loaded = {}
        for flags in cls.COMBINATIONS:
            executed = cls._build(*flags)
            executed.execute(
                tables=cls.tables,
                con=cls.con,
                overwrite=True,
                lazy_execution=True,
                sql_dir=None,
            )
            fresh = cls._build(*flags)
            fresh.database = Database(connector=cls.con, mapper=TestDomains)
            fresh.load(con=cls.con)
            cls.loaded[flags] = fresh

    @classmethod
    def tearDownClass(cls):
        Node._node_manager = cls._orig_node_manager

    @staticmethod
    def _build(write_entry, write_index):
        name = (
            f"flags_{'on' if write_entry else 'off'}_{'on' if write_index else 'off'}"
        )
        entry = CodelistPhenotype(
            name=f"{name}_entry",
            return_date="first",
            codelist=Codelist(["d1"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
        )
        excl = CodelistPhenotype(
            name=f"{name}_exclusion",
            codelist=Codelist(["e_excl"]).copy(use_code_type=False),
            domain="DRUG_EXPOSURE",
            relative_time_range=RelativeTimeRangeFilter(
                when="before",
                min_days=GreaterThanOrEqualTo(0),
                anchor_phenotype=entry,
            ),
        )
        return Cohort(
            name=name,
            entry_criterion=entry,
            exclusions=[excl],
            write_subset_tables_entry=write_entry,
            write_subset_tables_index=write_index,
        )

    @staticmethod
    def _sides(cohort):
        """(label, flag, dict, nodes) for the entry and index subsets."""
        return (
            (
                "entry",
                cohort.write_subset_tables_entry,
                cohort.subset_tables_entry,
                cohort.subset_tables_entry_nodes,
            ),
            (
                "index",
                cohort.write_subset_tables_index,
                cohort.subset_tables_index,
                cohort.subset_tables_index_nodes,
            ),
        )

    @staticmethod
    def _reads_from(phenex_table):
        """The physical tables the expression actually reads."""
        import ibis.expr.operations as ops

        return {t.name.upper() for t in phenex_table.table.op().find(ops.PhysicalTable)}

    @classmethod
    def _role_of(cls, table_name, cohort):
        """What an upstream table is to this cohort, so the matrix records the
        rule rather than four repetitions of the same names."""
        prefix = cohort._clean_prefix
        name = table_name.upper()
        if name == f"{prefix}__INDEX":
            return "index_table"
        if "__SUBSET_ENTRY_" in name:
            return "stored_entry_subset"
        if "__SUBSET_INDEX_" in name:
            return "stored_index_subset"
        if name == cohort.entry_criterion.get_table_name(prefix).upper():
            return "entry_phenotype"
        return "source_table"

    def test_flag_matrix_matches_the_frozen_artifact(self):
        """All four write-flag combinations: how many subset tables reached the
        destination, and what the loaded dict reads. The row counts are the
        same everywhere, so the flags change where rows come from, never what
        they are."""
        self.maxDiff = None
        destination = {t.upper() for t in self.con.list_dest_tables()}
        matrix, counts = {}, {}
        for flags in self.COMBINATIONS:
            cohort = self.loaded[flags]
            prefix = cohort._clean_prefix
            combo = f"entry={flags[0]},index={flags[1]}"
            matrix[combo] = {}
            for label, _flag, dicts, nodes in self._sides(cohort):
                matrix[combo][label] = {
                    "written": sum(
                        n.get_table_name(prefix).upper() in destination for n in nodes
                    ),
                    "reads_from": sorted(
                        {
                            self._role_of(name, cohort)
                            for t in dicts.values()
                            for name in self._reads_from(t)
                        }
                    ),
                }
                counts.setdefault(label, {})[combo] = {
                    domain: int(t.table.count().execute())
                    for domain, t in dicts.items()
                }
        write_artifact("flag_matrix.json", {"matrix": matrix, "row_counts": counts})
        self.assertEqual(matrix, FROZEN_FLAG_MATRIX)
        for label, per_combo in counts.items():
            for combo, actual in per_combo.items():
                with self.subTest(side=label, combination=combo):
                    self.assertEqual(actual, FROZEN_FLAG_ROW_COUNTS[label])

    def test_rebuilding_an_unwritten_subset_says_so(self):
        cohort = self._build(False, False)
        cohort.database = Database(connector=self.con, mapper=TestDomains)
        cohort.load(con=self.con)
        with self.assertLogs("phenex.core.cohort", level="INFO") as cm:
            _ = cohort.subset_tables_entry
        self.assertTrue(
            any("entry subset tables were not written" in m for m in cm.output),
            f"a rebuilt subset explains itself: {cm.output}",
        )
        with self.assertLogs("phenex.core.cohort", level="INFO") as cm:
            _ = cohort.subset_tables_index
        self.assertTrue(
            any("index subset tables were not written" in m for m in cm.output),
            f"the index side says so too: {cm.output}",
        )
        self.assertFalse(
            any("entry subset tables were not written" in m for m in cm.output),
            "the entry line fires once, not again on the next read",
        )

    def test_load_without_a_reachable_source_warns(self):
        cohort = self._build(True, True)  # no database, so no mapper
        with self.assertLogs("phenex.core.cohort", level="WARNING") as cm:
            cohort.load(con=self.con)
        self.assertTrue(
            any("source tables not reachable at load" in m for m in cm.output),
            f"an unreachable source warns: {cm.output}",
        )
        self.assertEqual(cohort.subset_tables_entry, {})
        self.assertEqual(cohort.subset_tables_index, {})
