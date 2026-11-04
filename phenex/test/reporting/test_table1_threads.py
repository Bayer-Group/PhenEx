import os
import tempfile
import unittest

import pandas as pd

from phenex.ibis_connect import DuckDBConnector
from phenex.node import Node
from phenex.node_manager import NodeManager
from phenex.reporting import Table1
from phenex.test.cohort.test_cohort_lazy_execution import (
    _build_cohort,
    _build_test_tables,
)


class TestTable1Threads(unittest.TestCase):
    """Computing the rows on several threads gives the same table."""

    @classmethod
    def setUpClass(cls):
        tmpdir = tempfile.mkdtemp()
        cls._orig_node_manager = Node._node_manager
        Node._node_manager = NodeManager(db_name=os.path.join(tmpdir, "phenex.db"))
        con = DuckDBConnector(
            DUCKDB_DEST_DATABASE=os.path.join(tmpdir, "table1_threads.duckdb")
        )
        tables = _build_test_tables(con)
        cls.cohort, _ = _build_cohort(tables)
        cls.cohort.execute(
            tables=tables,
            con=con,
            overwrite=True,
            sql_dir=os.path.join(tmpdir, "sql"),
        )

    @classmethod
    def tearDownClass(cls):
        Node._node_manager = cls._orig_node_manager

    def test_threaded_table1_equals_sequential(self):
        for level in [None, 100]:
            sequential = Table1(include_component_phenotypes_level=level).execute(
                self.cohort
            )
            threaded = Table1(
                include_component_phenotypes_level=level, n_threads=4
            ).execute(self.cohort)
            self.assertGreater(len(sequential), 1)
            pd.testing.assert_frame_equal(sequential, threaded)

    def test_detailed_table1_has_no_duplicate_rows(self):
        df = Table1(include_component_phenotypes_level=100, n_threads=4).execute(
            self.cohort
        )
        self.assertFalse(df["Name"].duplicated().any())

    def test_treatment_pattern_phenotypes_are_left_out(self):
        tpa_phenotype = self.cohort.characteristics[0]
        tpa_phenotype._tpa_name = "TPA"
        try:
            reporter = Table1()
            df = reporter.execute(
                self.cohort, {"Section": self.cohort.characteristics}
            )
        finally:
            del tpa_phenotype._tpa_name
        self.assertNotIn(tpa_phenotype.display_name, set(df["Name"]))
        self.assertNotIn(
            tpa_phenotype.display_name, reporter.characteristic_sections["Section"]
        )
        self.assertGreater(len(df), 1)


if __name__ == "__main__":
    unittest.main()
