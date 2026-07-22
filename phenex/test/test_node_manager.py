import unittest
import tempfile
import os
from unittest.mock import Mock, patch
from datetime import datetime
import pandas as pd
import json

from phenex.node_manager import NodeManager
from phenex.node import Node


class MockNode(Node):
    """Mock node for testing"""

    def __init__(self, name, param1=None):
        super().__init__(name=name)
        self.param1 = param1

    def _execute(self, tables=None):
        import ibis

        df = pd.DataFrame({"result": [f"output from {self.name}"]})
        return ibis.memtable(df)


class TestNodeManager(unittest.TestCase):
    def setUp(self):
        # Create a temporary database for each test
        self.temp_db = tempfile.mktemp(suffix=".db")
        self.node_manager = NodeManager(db_name=self.temp_db)

    def tearDown(self):
        # Clean up temporary database
        try:
            os.unlink(self.temp_db)
        except:
            pass

    def test_should_rerun_never_executed(self):
        """Test should_rerun returns True for never executed nodes"""
        node = MockNode("test_node", param1="value1")
        mock_con = Mock()
        mock_con.__class__.__name__ = "DuckDBConnector"
        mock_con.DUCKDB_SOURCE_DATABASE = "source.db"
        mock_con.DUCKDB_DEST_DATABASE = "dest.db"

        result = self.node_manager.should_rerun(node, mock_con)
        self.assertTrue(result)

    def test_should_rerun_node_unchanged(self):
        """Test should_rerun returns False when node hasn't changed"""
        node = MockNode("test_node", param1="value1")
        mock_con = Mock()
        mock_con.__class__.__name__ = "DuckDBConnector"
        mock_con.DUCKDB_SOURCE_DATABASE = "source.db"
        mock_con.DUCKDB_DEST_DATABASE = "dest.db"

        # Set up timing info for the node
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 1.0

        # First execution - should run
        result1 = self.node_manager.should_rerun(node, mock_con)
        self.assertTrue(result1)

        # Update run params
        self.node_manager.update_run_params(node, mock_con)

        # Second execution with same node and context - should not run
        result2 = self.node_manager.should_rerun(node, mock_con)
        self.assertFalse(result2)

    def test_should_rerun_node_changed(self):
        """Test should_rerun returns True when node parameters change"""
        node = MockNode("test_node", param1="value1")
        mock_con = Mock()
        mock_con.__class__.__name__ = "DuckDBConnector"
        mock_con.DUCKDB_SOURCE_DATABASE = "source.db"
        mock_con.DUCKDB_DEST_DATABASE = "dest.db"

        # Set up timing info
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 1.0

        # First execution
        result1 = self.node_manager.should_rerun(node, mock_con)
        self.assertTrue(result1)
        self.node_manager.update_run_params(node, mock_con)

        # Change node parameters
        node.param1 = "value2"

        # Should rerun because node changed
        result2 = self.node_manager.should_rerun(node, mock_con)
        self.assertTrue(result2)

    def test_should_rerun_context_changed(self):
        """Test should_rerun returns True when execution context changes"""
        node = MockNode("test_node", param1="value1")

        # First context
        mock_con1 = Mock()
        mock_con1.__class__.__name__ = "DuckDBConnector"
        mock_con1.DUCKDB_SOURCE_DATABASE = "source1.db"
        mock_con1.DUCKDB_DEST_DATABASE = "dest1.db"

        # Second context
        mock_con2 = Mock()
        mock_con2.__class__.__name__ = "DuckDBConnector"
        mock_con2.DUCKDB_SOURCE_DATABASE = "source2.db"  # Different source
        mock_con2.DUCKDB_DEST_DATABASE = "dest1.db"

        # Set up timing info
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 1.0

        # First execution with context 1
        result1 = self.node_manager.should_rerun(node, mock_con1)
        self.assertTrue(result1)
        self.node_manager.update_run_params(node, mock_con1)

        # Second execution with context 1 - should not rerun
        result2 = self.node_manager.should_rerun(node, mock_con1)
        self.assertFalse(result2)

        # Third execution with context 2 - should rerun (different context)
        result3 = self.node_manager.should_rerun(node, mock_con2)
        self.assertTrue(result3)

    def test_get_run_params_no_executions(self):
        """Test get_run_params returns None when no executions exist"""
        node = MockNode("test_node", param1="value1")
        mock_con = Mock()

        result = self.node_manager.get_run_params(node, mock_con)
        self.assertIsNone(result)

    def test_get_run_params_with_executions(self):
        """Test get_run_params returns execution data when executions exist"""
        node = MockNode("test_node", param1="value1")
        mock_con = Mock()
        mock_con.__class__.__name__ = "DuckDBConnector"
        mock_con.DUCKDB_SOURCE_DATABASE = "source.db"
        mock_con.DUCKDB_DEST_DATABASE = "dest.db"

        # Set up timing info
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 1.0

        # Execute and update params
        self.node_manager.update_run_params(node, mock_con)

        # Get run params
        result = self.node_manager.get_run_params(node, mock_con)
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 1)
        self.assertEqual(result.iloc[0]["NODE_NAME"], "TEST_NODE")

    def test_clear_cache(self):
        """Test clear_cache removes all entries for a node"""
        node = MockNode("test_node", param1="value1")
        mock_con = Mock()
        mock_con.__class__.__name__ = "DuckDBConnector"
        mock_con.DUCKDB_SOURCE_DATABASE = "source.db"
        mock_con.DUCKDB_DEST_DATABASE = "dest.db"

        # Set up timing info
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 1.0

        # Execute and update params
        self.node_manager.update_run_params(node, mock_con)

        # Verify entry exists
        result_before = self.node_manager.get_run_params(node)
        self.assertIsNotNone(result_before)

        # Clear cache
        self.node_manager.clear_cache(node)

        # Verify entry is gone
        result_after = self.node_manager.get_run_params(node)
        self.assertIsNone(result_after)

    def test_multiple_entries_same_node_different_contexts(self):
        """Test that multiple entries can exist for same node with different contexts"""
        node = MockNode("test_node", param1="value1")

        # Two different contexts
        mock_con1 = Mock()
        mock_con1.__class__.__name__ = "DuckDBConnector"
        mock_con1.DUCKDB_SOURCE_DATABASE = "source1.db"
        mock_con1.DUCKDB_DEST_DATABASE = "dest.db"

        mock_con2 = Mock()
        mock_con2.__class__.__name__ = "DuckDBConnector"
        mock_con2.DUCKDB_SOURCE_DATABASE = "source2.db"
        mock_con2.DUCKDB_DEST_DATABASE = "dest.db"

        # Set up timing info
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 1.0

        # Execute with both contexts
        self.node_manager.update_run_params(node, mock_con1)
        self.node_manager.update_run_params(node, mock_con2)

        # Should have entries for both contexts
        result1 = self.node_manager.get_run_params(node, mock_con1)
        result2 = self.node_manager.get_run_params(node, mock_con2)
        result_all = self.node_manager.get_run_params(node)

        self.assertIsNotNone(result1)
        self.assertIsNotNone(result2)
        self.assertIsNotNone(result_all)
        self.assertEqual(len(result1), 1)
        self.assertEqual(len(result2), 1)
        self.assertEqual(len(result_all), 2)  # Should have both entries

    @patch("phenex.node_manager.DuckDBConnector")
    def test_handles_mock_connectors(self, mock_connector_class):
        """Test that NodeManager handles mocked connectors properly"""
        node = MockNode("test_node", param1="value1")

        # Create a mock connector
        mock_connector = Mock()
        mock_connector.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_connector

        # Mock connector attributes
        mock_con = Mock()
        mock_con.__class__.__name__ = "Mock"
        mock_con.DUCKDB_SOURCE_DATABASE = "source.db"
        mock_con.DUCKDB_DEST_DATABASE = "dest.db"

        # Should not crash with mock connectors
        result = self.node_manager.should_rerun(node, mock_con)
        self.assertTrue(result)  # Should return True for never executed

    # NODE_SQL column and get_sql()

    def _make_mock_con(self):
        con = Mock()
        con.__class__.__name__ = "DuckDBConnector"
        con.DUCKDB_SOURCE_DATABASE = "source.db"
        con.DUCKDB_DEST_DATABASE = "dest.db"
        return con

    def _node_with_expression(self, name="test_node", **kwargs):
        """MockNode with _expression set and timing populated."""
        node = MockNode(name, **kwargs)
        node._expression = node._execute()
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 0.01
        return node

    def test_update_run_params_stores_node_sql(self):
        """NODE_SQL is written to the DB when node._expression is set."""
        node = self._node_with_expression()
        self.node_manager.update_run_params(node, self._make_mock_con())

        result = self.node_manager.get_run_params(node)
        self.assertIsNotNone(result)
        sql_val = result.iloc[0]["NODE_SQL"]
        self.assertIsNotNone(sql_val)
        self.assertIsInstance(sql_val, str)
        self.assertIn("SELECT", sql_val.upper())

    def test_get_sql_returns_none_when_no_db(self):
        """phenex.db has never been written -> get_sql returns None."""
        node = MockNode("test_node")
        result = self.node_manager.get_sql(node)
        self.assertIsNone(result)

    def test_get_sql_returns_none_when_hash_mismatch(self):
        """Name matches but hash changed (param changed) -> get_sql returns None."""
        node = self._node_with_expression("test_node", param1="v1")
        self.node_manager.update_run_params(node, self._make_mock_con())

        node.param1 = "v2"  # changes the hash
        result = self.node_manager.get_sql(node)
        self.assertIsNone(result)

    def test_get_sql_returns_sql_on_hash_match(self):
        """Name + hash match -> get_sql returns the stored SQL string."""
        node = self._node_with_expression("test_node", param1="v1")
        self.node_manager.update_run_params(node, self._make_mock_con())

        result = self.node_manager.get_sql(node)
        self.assertIsNotNone(result)
        self.assertIsInstance(result, str)
        self.assertIn("SELECT", result.upper())

    def test_lazy_hit_preserves_existing_sql(self):
        """update_run_params with _expression=None must not overwrite stored NODE_SQL."""
        node = self._node_with_expression("test_node")
        mock_con = self._make_mock_con()
        self.node_manager.update_run_params(node, mock_con)
        original_sql = self.node_manager.get_sql(node)
        self.assertIsNotNone(original_sql)

        # Simulate lazy cache hit: expression is cleared (node was skipped)
        node._expression = None
        self.node_manager.update_run_params(node, mock_con)

        preserved_sql = self.node_manager.get_sql(node)
        self.assertEqual(preserved_sql, original_sql)

    def test_cache_write_stamps_connector_dialect_even_when_expr_unbindable(self):
        """Cached SQL is compiled and stamped for the connector's dialect even when the expression can't self-identify a backend."""
        import ibis

        from phenex.ibis_connect import ibis_dialect_of_expr, read_dialect_stamp

        node = MockNode("unbindable_node")
        node._expression = ibis.table(
            {"X": "int"}, name="T"
        )  # unbound: can't self-identify
        node.lastexecution_start_time = datetime.now()
        node.lastexecution_end_time = datetime.now()
        node.lastexecution_duration = 0.01
        # precondition: dialect inference fails for this expression
        self.assertIsNone(ibis_dialect_of_expr(node._expression))

        con = self._make_mock_con()
        con.dest_connection.name = "snowflake"  # the connector knows its one backend

        self.node_manager.update_run_params(node, con)

        stored = self.node_manager.get_sql(node)
        self.assertIsNotNone(
            stored, "SQL must be cached in the connector's dialect, not blanked"
        )
        self.assertEqual(
            read_dialect_stamp(stored),
            "snowflake",
            f"cached SQL must carry the connector's dialect stamp; got head={stored[:60]!r}",
        )


if __name__ == "__main__":
    unittest.main()
