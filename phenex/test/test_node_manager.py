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


if __name__ == "__main__":
    unittest.main()
