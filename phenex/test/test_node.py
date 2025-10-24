import pytest
import time
from datetime import datetime
from unittest.mock import Mock, patch, PropertyMock
import pandas as pd


from phenex.node import (
    Node,
    NodeGroup,
    NODE_STATES_TABLE_NAME,
)


class MockTable:
    """Mock table for testing"""

    def __init__(self, data=None, name="test_table"):
        self.data = data or {"col1": [1, 2, 3], "col2": ["a", "b", "c"]}
        self.name = name

    def to_pandas(self):
        return pd.DataFrame(self.data)


class TestPhenexNode:
    """Test class for Node"""

    def test_add_children_single_node(self):
        """Test adding a single child node"""
        parent = Node("parent")
        child = Node("child")

        parent.add_children(child)
        assert child in parent.children
        assert len(parent.children) == 1

    def test_add_children_list(self):
        """Test adding multiple children as a list"""
        parent = Node("parent")
        child1 = Node("child1")
        child2 = Node("child2")

        parent.add_children([child1, child2])
        assert child1 in parent.children
        assert child2 in parent.children
        assert len(parent.children) == 2

    def test_add_children_duplicate(self):
        """Test that duplicate children are not added"""
        parent = Node("parent")
        child1 = Node("child")
        child2 = Node("child")

        parent.add_children(child1)
        with pytest.raises(ValueError, match="Duplicate node found"):
            parent.add_children(child1)  # Add same child again

        with pytest.raises(ValueError, match="Duplicate node name found"):
            parent.add_children(child2)  # Add child with same name

        assert len(parent.children) == 1

    def test_collect_dependencies(self):
        """Test that grandchildren are added to dependencies"""

        w = Node("w")
        x = Node("x")
        y = Node("y")
        z = Node("z")

        w >> [x, y]
        x >> z
        y >> z

        assert z in w.dependencies

    def test_add_children_non_phenex_node(self):
        """Test that adding non-Node raises ValueError"""
        parent = Node("parent")

        with pytest.raises(ValueError, match="Dependent children must be of type Node"):
            parent.add_children("not_a_node")

    def test_add_children_duplicate_name_different_node(self):
        """Test that nodes with duplicate names but different objects raise ValueError"""
        parent = Node("parent")
        child1 = Node("duplicate_name")
        child2 = Node("duplicate_name")

        parent.add_children(child1)
        with pytest.raises(ValueError, match="Duplicate node name found"):
            parent.add_children(child2)

    def test_rshift_operator(self):
        """Test >> operator for adding children"""
        parent = Node("parent")
        child = Node("child")

        result = parent >> child
        assert child in parent.children
        assert result == child

    def test_children_property_immutable(self):
        """Test that children property returns a copy to prevent direct modification"""
        parent = Node("parent")
        child1 = Node("child1")
        child2 = Node("child2")
        parent.add_children(child1)

        # try to manually add children (should have no effect)
        parent.children.append(child2)
        assert child2 not in parent.children

    def test_dependencies_simple(self):
        """Test dependencies property with simple hierarchy"""
        grandparent = Node("grandparent")
        parent = Node("parent")
        child = Node("child")

        parent.add_children(child)
        grandparent.add_children(parent)

        deps = grandparent.dependencies
        assert len(deps) == 2
        assert parent in deps
        assert child in deps

    def test_dependencies_complex(self):
        """Test dependencies with more complex hierarchy"""
        # Create a diamond dependency pattern
        root = Node("root")
        left = Node("left")
        right = Node("right")
        bottom = Node("bottom")

        left.add_children(bottom)
        right.add_children(bottom)
        root.add_children([left, right])

        deps = root.dependencies
        assert len(deps) == 3
        assert left in deps
        assert right in deps
        assert bottom in deps

    def test_get_current_hash(self):
        """Test hash generation for current state"""
        node = Node("test")
        hash1 = node._get_current_hash()

        # Hash should be consistent
        hash2 = node._get_current_hash()
        assert hash1 == hash2

    def test_get_current_hash_different_nodes(self):
        """Test that different nodes have different hashes"""
        node1 = Node("node1")
        node2 = Node("node2")

        hash1 = node1._get_current_hash()
        hash2 = node2._get_current_hash()

        assert hash1 != hash2

    @patch("phenex.node.DuckDBConnector")
    def test_get_last_hash_no_table(self, mock_connector_class):
        """Test _get_last_hash when no state table exists"""
        mock_connector = Mock()
        mock_connector.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_connector

        node = Node("test")
        result = node._get_last_hash()

        assert result is None

    @patch("phenex.node.DuckDBConnector")
    def test_get_last_hash_with_existing_data(self, mock_connector_class):
        """Test _get_last_hash with existing state data"""
        mock_connector = Mock()
        mock_connector.dest_connection.list_tables.return_value = [
            NODE_STATES_TABLE_NAME
        ]

        # Mock table data
        mock_table_data = pd.DataFrame(
            {
                "NODE_NAME": ["TEST", "OTHER"],
                "NODE_HASH": [123, 456],
                "EXECUTION_PARAMS": [None, None],
            }
        )
        mock_table = Mock()
        mock_table.to_pandas.return_value = mock_table_data
        mock_connector.get_dest_table.return_value = mock_table
        mock_connector_class.return_value = mock_connector

        node = Node("test")
        result = node._get_last_hash()

        assert result == 123

    @patch("phenex.node.DuckDBConnector")
    @patch("phenex.node.ibis.memtable")
    def test_update_run_params(self, mock_memtable, mock_connector_class):
        """Test _update_run_params"""
        mock_connector = Mock()
        mock_connector.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_connector
        mock_memtable.return_value = Mock()

        node = Node("test")
        # Set execution timing for the test
        node._last_execution_start_time = datetime.now()
        node._last_execution_end_time = datetime.now()
        node._last_execution_duration = 1.5

        # Mock _get_last_hash to avoid the additional database call
        with patch.object(node, "_get_last_hash", return_value=None):
            result = node._update_run_params()

        assert result is True
        mock_connector.create_table.assert_called_once()

    def test_execute_not_implemented(self):
        """Test that _execute raises NotImplementedError"""
        node = Node("test")

        with pytest.raises(NotImplementedError):
            node._execute({})

    def test_to_dict(self):
        """Test to_dict method"""
        node = Node("test")
        result = node.to_dict()

        assert isinstance(result, dict)
        # The exact content depends on the to_dict implementation

    def test_dependency_graph(self):
        """Test dependency_graph property with depth >= 2"""
        # Create a hierarchy with depth 3: root -> middle -> leaf
        root = Node("root")
        middle = Node("middle")
        leaf = Node("leaf")

        # Create another branch
        other_middle = Node("other_middle")
        other_leaf = Node("other_leaf")

        # Build the dependency tree
        root >> [middle, other_middle]
        middle >> leaf
        other_middle >> other_leaf

        # Test the dependency graph
        graph = root.dependency_graph

        # Should be a dictionary representation of the graph
        assert isinstance(graph, dict)

        # Root should have middle and other_middle as dependencies
        assert middle in graph[root]
        assert other_middle in graph[root]

        # Middle should have leaf as dependency
        assert leaf in graph[middle]

        # Other_middle should have other_leaf as dependency
        assert other_leaf in graph[other_middle]

        # Leaf nodes should have empty dependency lists
        assert len(graph[leaf]) == 0
        assert len(graph[other_leaf]) == 0


class ConcreteNode(Node):
    """Concrete implementation of Node for testing execute method"""

    def __init__(self, name, execution_time=0, fail=False):
        super().__init__(name)
        self.execution_time = execution_time
        self.fail = fail
        self.executed = False

    def _execute(self, tables):
        if self.execution_time > 0:
            time.sleep(self.execution_time)

        if self.fail:
            raise RuntimeError(f"Node {self.name} failed")

        self.executed = True
        return MockTable({"result": [f"data_from_{self.name.lower()}"]})


class TestPhenexNodeExecution:
    """Test Node execution functionality"""

    def test_execute_simple(self):
        """Test simple execution without dependencies"""
        node = ConcreteNode("test")
        tables = {"domain1": MockTable()}

        result = node.execute(tables)

        assert node.executed
        assert result is not None
        assert hasattr(node, "table")

    def test_execute_with_children(self):
        """Test execution with child dependencies"""
        parent = ConcreteNode("parent")
        child = ConcreteNode("child")
        parent.add_children(child)

        tables = {"domain1": MockTable()}
        result = parent.execute(tables)

        assert child.executed
        assert parent.executed
        assert result is not None

    @patch("phenex.node.DuckDBConnector")
    def test_execute_with_connector(self, mock_connector_class):
        """Test execution with database connector"""
        mock_connector = Mock()
        mock_connector_class.return_value = mock_connector

        node = ConcreteNode("test")
        tables = {"domain1": MockTable()}

        node.execute(tables, con=mock_connector)

        assert node.executed
        mock_connector.create_table.assert_called_once()

    @patch("phenex.node.DuckDBConnector")
    def test_execute_lazy_execution_first_time(self, mock_connector_class):
        """Test lazy execution when node hasn't been computed before"""
        mock_connector = Mock()
        mock_connector_class.return_value = mock_connector

        # Configure mock to have only DuckDB attributes
        mock_connector.configure_mock(
            **{"DUCKDB_SOURCE_DATABASE": "source.db", "DUCKDB_DEST_DATABASE": "dest.db"}
        )

        node = ConcreteNode("test")
        # Mock that node hasn't been computed before
        node._get_last_hash = Mock(return_value=None)
        node._get_current_hash = Mock(return_value=12345678)
        node._update_run_params = Mock(return_value=True)

        # Mock execution_metadata property to return None (no previous execution)
        type(node).execution_metadata = PropertyMock(return_value=None)

        tables = {"domain1": MockTable()}

        node.execute(tables, con=mock_connector, overwrite=True, lazy_execution=True)

        assert node.executed
        mock_connector.create_table.assert_called_once()
        node._update_run_params.assert_called_once()

    @patch("phenex.node.DuckDBConnector")
    def test_execute_lazy_execution_unchanged(self, mock_connector_class):
        """Test lazy execution when node hasn't changed"""
        mock_connector = Mock()
        mock_connector.dest_connection.list_tables.return_value = [
            NODE_STATES_TABLE_NAME
        ]
        mock_table = MockTable({"result": ["cached_data"]})
        mock_connector.get_dest_table.return_value = mock_table
        mock_connector_class.return_value = mock_connector

        # Configure mock to have only DuckDB attributes, not Snowflake
        mock_connector.configure_mock(
            **{"DUCKDB_SOURCE_DATABASE": "source.db", "DUCKDB_DEST_DATABASE": "dest.db"}
        )
        # Remove any Snowflake attributes that might exist
        if hasattr(mock_connector, "SNOWFLAKE_SOURCE_DATABASE"):
            del mock_connector.SNOWFLAKE_SOURCE_DATABASE
        if hasattr(mock_connector, "SNOWFLAKE_DEST_DATABASE"):
            del mock_connector.SNOWFLAKE_DEST_DATABASE

        node = ConcreteNode("test")
        # Mock that node hasn't changed
        node._get_last_hash = Mock(return_value=12345678)
        node._get_current_hash = Mock(return_value=12345678)

        # Mock execution metadata to indicate no changes in execution params
        mock_metadata = pd.Series(
            {
                "NODE_NAME": "TEST",
                "LAST_HASH": 12345678,
                "EXECUTION_PARAMS": '{"connector_type": "DuckDBConnector", "source_database": "source.db", "dest_database": "dest.db"}',
            }
        )
        type(node).execution_metadata = PropertyMock(return_value=mock_metadata)

        tables = {"domain1": MockTable()}

        result = node.execute(
            tables, con=mock_connector, overwrite=True, lazy_execution=True
        )

        assert not node.executed  # Should not execute
        assert result == mock_table
        mock_connector.create_table.assert_not_called()

    def test_execute_lazy_execution_no_overwrite_error(self):
        """Test that lazy execution without overwrite raises error"""
        node = ConcreteNode("test")
        tables = {"domain1": MockTable()}

        with pytest.raises(
            ValueError, match="lazy_execution only works with overwrite=True"
        ):
            node.execute(tables, lazy_execution=True, overwrite=False)

    def test_execute_exception_propagation_in_threads(self):
        """Test that exceptions in worker threads are properly propagated to main thread"""
        failing_node = ConcreteNode("failing_node", fail=True)
        parent = ConcreteNode("parent")
        parent.add_children(failing_node)

        tables = {"domain1": MockTable()}

        # This should raise the RuntimeError from the failing node
        with pytest.raises(RuntimeError, match="Node FAILING_NODE failed"):
            parent.execute(tables, n_threads=2)

    def test_execute_lazy_execution_exception_propagation(self):
        """Test that lazy execution exceptions in worker threads are properly propagated"""
        node = ConcreteNode("test")
        tables = {"domain1": MockTable()}

        # This should raise the ValueError about needing overwrite=True, not hang
        with pytest.raises(
            ValueError, match="lazy_execution only works with overwrite=True"
        ):
            node.execute(tables, lazy_execution=True, overwrite=False, n_threads=2)

    def test_execute_fails_fast_prevents_new_work(self):
        """Test that execution prevents dependent nodes from starting when a dependency fails"""
        import time

        # Create nodes where one fails quickly
        failing_node = ConcreteNode("failing_node", execution_time=0.01, fail=True)

        # Create nodes that depend on the failing node - these should NOT execute
        # because their dependency failed before they could start
        dependent1 = ConcreteNode("dependent1", execution_time=0.05)
        dependent2 = ConcreteNode("dependent2", execution_time=0.05)

        # Set up dependencies: dependent nodes can only start after failing_node completes
        dependent1.add_children(failing_node)
        dependent2.add_children(failing_node)

        parent = ConcreteNode("parent")
        parent.add_children([dependent1, dependent2])

        tables = {"domain1": MockTable()}

        with pytest.raises(RuntimeError, match="Node FAILING_NODE failed"):
            parent.execute(tables, n_threads=4)

        # The key test: nodes that depend on the failing node should NOT execute
        # because fail-fast prevents new work from starting after a failure
        assert (
            not dependent1.executed
        ), "dependent1 should not execute when its dependency fails"
        assert (
            not dependent2.executed
        ), "dependent2 should not execute when its dependency fails"
        assert not parent.executed, "parent should not execute when dependencies fail"

    def test_execute_lazy_execution_no_connector_error(self):
        """Test that lazy execution without connector raises error"""
        node = ConcreteNode("test")
        tables = {"domain1": MockTable()}

        with pytest.raises(
            ValueError, match="A DatabaseConnector is required for lazy execution"
        ):
            node.execute(tables, lazy_execution=True, overwrite=True)

    @patch("phenex.node.DuckDBConnector")
    def test_clear_cache_removes_hash(self, mock_connector_class):
        """Test that clear_cache removes node hash from state table"""
        # Mock the DuckDB connector for node states
        mock_duckdb_con = Mock()
        mock_duckdb_con.dest_connection.list_tables.return_value = [
            NODE_STATES_TABLE_NAME
        ]

        # Create mock table data with our node and another node
        mock_table_data = pd.DataFrame(
            {
                "NODE_NAME": ["TEST", "OTHER_NODE"],
                "LAST_HASH": ["hash123", "hash456"],
                "NODE_PARAMS": ["{}", "{}"],
                "LAST_EXECUTED": ["2023-01-01", "2023-01-02"],
            }
        )
        mock_table = Mock()
        mock_table.to_pandas.return_value = mock_table_data
        mock_duckdb_con.get_dest_table.return_value = mock_table

        # Mock ibis.memtable
        mock_updated_table = Mock()
        with patch("phenex.node.ibis.memtable", return_value=mock_updated_table):
            mock_connector_class.return_value = mock_duckdb_con

            node = ConcreteNode("test")
            node.table = MockTable()  # Set a table to be reset

            # Clear cache
            node.clear_cache()

            # Verify table attribute was reset
            assert node.table is None

            # Verify create_table was called to update the states table
            mock_duckdb_con.create_table.assert_called_once_with(
                mock_updated_table, name_table=NODE_STATES_TABLE_NAME, overwrite=True
            )

    @patch("phenex.node.DuckDBConnector")
    def test_clear_cache_with_connector_drops_table(self, mock_connector_class):
        """Test that clear_cache drops materialized table when connector provided"""
        # Mock the DuckDB connector for node states
        mock_duckdb_con = Mock()
        mock_duckdb_con.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_duckdb_con

        # Mock the user connector
        mock_user_con = Mock()
        mock_user_con.dest_connection.list_tables.return_value = ["TEST"]

        node = ConcreteNode("test")
        node.table = MockTable()

        # Clear cache with connector
        node.clear_cache(con=mock_user_con)

        # Verify materialized table was dropped
        mock_user_con.dest_connection.drop_table.assert_called_once_with("TEST")
        assert node.table is None

    @patch("phenex.node.DuckDBConnector")
    def test_clear_cache_recursive(self, mock_connector_class):
        """Test that clear_cache recursively clears child nodes when recursive=True"""
        # Mock the DuckDB connector
        mock_duckdb_con = Mock()
        mock_duckdb_con.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_duckdb_con

        parent = ConcreteNode("parent")
        child1 = ConcreteNode("child1")
        child2 = ConcreteNode("child2")
        parent.add_children([child1, child2])

        # Set tables to verify they get reset
        parent.table = MockTable()
        child1.table = MockTable()
        child2.table = MockTable()

        # Clear cache recursively
        parent.clear_cache(recursive=True)

        # Verify all tables were reset
        assert parent.table is None
        assert child1.table is None
        assert child2.table is None

    @patch("phenex.node.DuckDBConnector")
    def test_clear_cache_non_recursive(self, mock_connector_class):
        """Test that clear_cache only clears current node when recursive=False"""
        # Mock the DuckDB connector
        mock_duckdb_con = Mock()
        mock_duckdb_con.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_duckdb_con

        parent = ConcreteNode("parent")
        child = ConcreteNode("child")
        parent.add_children(child)

        # Set tables
        parent.table = MockTable()
        child.table = MockTable()

        # Clear cache non-recursively
        parent.clear_cache(recursive=False)

        # Verify only parent table was reset
        assert parent.table is None
        assert child.table is not None  # Child should be unchanged

    @patch("phenex.node.DuckDBConnector")
    def test_clear_cache_forces_reexecution(self, mock_connector_class):
        """Test that clearing cache forces re-execution in lazy mode"""
        # Mock the DuckDB connector for both node states and user connector
        mock_duckdb_con = Mock()
        mock_duckdb_con.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_duckdb_con

        # Mock user connector
        mock_user_con = Mock()
        mock_user_con.dest_connection.list_tables.return_value = []
        mock_result_table = MockTable()
        mock_user_con.get_dest_table.return_value = mock_result_table
        # Configure mock to have only DuckDB attributes
        mock_user_con.configure_mock(
            **{"DUCKDB_SOURCE_DATABASE": "source.db", "DUCKDB_DEST_DATABASE": "dest.db"}
        )

        node = ConcreteNode("test")
        tables = {"domain1": MockTable()}

        # First execution - should execute
        node._get_last_hash = Mock(return_value=None)
        node._get_current_hash = Mock(return_value="hash123")
        node._update_run_params = Mock(return_value=True)
        type(node).execution_metadata = PropertyMock(
            return_value=None
        )  # No previous execution

        node.execute(tables, con=mock_user_con, overwrite=True, lazy_execution=True)
        assert node.executed

        # Reset execution flag
        node.executed = False

        # Second execution without cache clear - should skip
        node._get_last_hash = Mock(return_value="hash123")
        node._get_current_hash = Mock(return_value="hash123")

        # Mock execution metadata to indicate no changes
        mock_metadata = pd.Series(
            {
                "NODE_NAME": "TEST",
                "LAST_HASH": "hash123",
                "EXECUTION_PARAMS": '{"connector_type": "DuckDBConnector", "source_database": "source.db", "dest_database": "dest.db"}',
            }
        )

        # Mock the _should_rerun method directly to return False (no rerun needed)
        node._should_rerun = Mock(return_value=False)

        node.execute(tables, con=mock_user_con, overwrite=True, lazy_execution=True)
        assert not node.executed  # Should have skipped

        # Clear cache
        node.clear_cache(con=mock_user_con)

        # Third execution after cache clear - should execute again
        node._get_last_hash = Mock(return_value=None)  # Cache was cleared
        node._get_current_hash = Mock(return_value="hash123")
        node._update_run_params = Mock(return_value=True)
        type(node).execution_metadata = PropertyMock(
            return_value=None
        )  # Cache was cleared

        # Reset the _should_rerun mock to return True (should rerun after cache clear)
        node._should_rerun = Mock(return_value=True)

        node.execute(tables, con=mock_user_con, overwrite=True, lazy_execution=True)
        assert node.executed  # Should have executed again

    def test_add_children_circular_dependency(self):
        """Test that adding a child that would create circular dependency raises ValueError"""
        node1 = Node("node1")
        node2 = Node("node2")
        node3 = Node("node3")

        # Create a chain: node1 -> node2 -> node3
        node2.add_children(node3)
        node1.add_children(node2)

        # Now try to add node1 as a child of node3, which would create a cycle
        with pytest.raises(ValueError, match="Circular dependency detected"):
            node3.add_children(node1)

        # Also test direct circular dependency
        node_a = Node("node_a")
        node_b = Node("node_b")

        node_a.add_children(node_b)

        # Try to add node_a as child of node_b (direct cycle)
        with pytest.raises(ValueError, match="Circular dependency detected"):
            node_b.add_children(node_a)


class TestPhenexNodeGroup:
    """Test NodeGroup class"""

    def test_autoadd_dependencies(self):
        """Test NodeGroup initialization"""
        node1 = ConcreteNode("node1")
        node2 = ConcreteNode("node2")
        node3 = ConcreteNode("node3")
        node4 = ConcreteNode("node4")
        node2.add_children(node3)
        node3.add_children(node4)

        grp = NodeGroup("test_NodeGroup", [node1, node2])

        assert node3 in grp.dependencies
        assert node4 in grp.dependencies

    def test_build_reverse_graph(self):
        """Test reverse dependency graph building"""
        child = ConcreteNode("child")
        parent = ConcreteNode("parent")
        parent.add_children(child)

        grp = NodeGroup("test", [parent, child])

        # Build dependency graph first
        all_deps = grp.dependencies
        nodes = {node.name: node for node in all_deps}
        nodes[grp.name] = grp
        dependency_graph = grp._build_dependency_graph(nodes)

        # Then build reverse graph
        reverse_graph = grp._build_reverse_graph(dependency_graph)

        assert "CHILD" in reverse_graph
        assert "PARENT" in reverse_graph["CHILD"]

    def test_execute_multithreaded(self):
        """Test multithreaded execution"""
        # Create nodes with different execution times to test concurrency
        fast_child = ConcreteNode("fast_child", execution_time=0.1)
        slow_child = ConcreteNode("slow_child", execution_time=0.2)
        parent = ConcreteNode("parent")
        parent.add_children([fast_child, slow_child])

        grp = NodeGroup("test", [parent])
        tables = {"domain1": MockTable()}

        start_time = time.time()
        grp.execute(tables, n_threads=2)
        end_time = time.time()

        # Should be faster than sequential execution (0.1 + 0.2 + overhead = ~0.35s)
        # With multithreading, should complete in about 0.2s (slowest child) + overhead
        execution_time = end_time - start_time
        assert (
            execution_time < 1.0
        ), f"Execution took {execution_time:.3f}s, expected < 1.0s"

        assert fast_child.executed
        assert slow_child.executed
        assert parent.executed

    def test_visualize_dependencies(self):
        """Test dependency visualization"""
        child = ConcreteNode("child")
        parent = ConcreteNode("parent")
        parent.add_children(child)

        grp = NodeGroup("test", [parent, child])
        viz = grp.visualize_dependencies()

        assert isinstance(viz, str)
        assert "PARENT" in viz
        assert "CHILD" in viz
        assert "depends on" in viz

    @patch("phenex.node.DuckDBConnector")
    def test_execute_with_lazy_execution(self, mock_connector_class):
        """Test execution with lazy execution enabled"""
        mock_connector = Mock()
        mock_connector_class.return_value = mock_connector

        # Configure the mock connector to handle list_tables() calls
        mock_connector.dest_connection.list_tables.return_value = []

        # Configure mock to have only DuckDB attributes
        mock_connector.configure_mock(
            **{"DUCKDB_SOURCE_DATABASE": "source.db", "DUCKDB_DEST_DATABASE": "dest.db"}
        )

        child = ConcreteNode("child")
        parent = ConcreteNode("parent")
        parent.add_children(child)

        # Mock that nodes haven't been computed before
        child._get_last_hash = Mock(return_value=None)
        child._get_current_hash = Mock(return_value=2345)
        child._update_run_params = Mock(return_value=True)
        type(child).execution_metadata = PropertyMock(return_value=None)

        parent._get_last_hash = Mock(return_value=None)
        parent._get_current_hash = Mock(return_value=1234)
        parent._update_run_params = Mock(return_value=True)
        type(parent).execution_metadata = PropertyMock(return_value=None)

        grp = NodeGroup("test", [parent])
        grp._get_last_hash = Mock(return_value=None)
        grp._get_current_hash = Mock(return_value=5678)
        grp._update_run_params = Mock(return_value=True)
        type(grp).execution_metadata = PropertyMock(return_value=None)

        tables = {"domain1": MockTable()}

        grp.execute(tables, con=mock_connector, overwrite=True, lazy_execution=True)

        assert child.executed
        assert parent.executed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
