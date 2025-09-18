import pytest
import time
from unittest.mock import Mock, patch
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
            {"NODE_NAME": ["TEST", "OTHER"], "LAST_HASH": ["hash123", "hash456"]}
        )
        mock_table = Mock()
        mock_table.to_pandas.return_value = mock_table_data
        mock_connector.get_dest_table.return_value = mock_table
        mock_connector_class.return_value = mock_connector

        node = Node("test")
        result = node._get_last_hash()

        assert result == "hash123"

    @patch("phenex.node.DuckDBConnector")
    @patch("phenex.node.ibis.memtable")
    def test_update_current_hash(self, mock_memtable, mock_connector_class):
        """Test _update_current_hash"""
        mock_connector = Mock()
        mock_connector.dest_connection.list_tables.return_value = []
        mock_connector_class.return_value = mock_connector
        mock_memtable.return_value = Mock()

        node = Node("test")
        result = node._update_current_hash()

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

        node = ConcreteNode("test")
        # Mock that node hasn't been computed before
        node._get_last_hash = Mock(return_value=None)
        node._get_current_hash = Mock(return_value="hash123")
        node._update_current_hash = Mock(return_value=True)

        tables = {"domain1": MockTable()}

        node.execute(tables, con=mock_connector, overwrite=True, lazy_execution=True)

        assert node.executed
        mock_connector.create_table.assert_called_once()
        node._update_current_hash.assert_called_once()

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

        node = ConcreteNode("test")
        # Mock that node hasn't changed
        node._get_last_hash = Mock(return_value="hash123")
        node._get_current_hash = Mock(return_value="hash123")

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

    def test_execute_lazy_execution_no_connector_error(self):
        """Test that lazy execution without connector raises error"""
        node = ConcreteNode("test")
        tables = {"domain1": MockTable()}

        with pytest.raises(
            ValueError, match="A DatabaseConnector is required for lazy execution"
        ):
            node.execute(tables, lazy_execution=True, overwrite=True)

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

    def test_execute_sequential_simple(self):
        """Test sequential execution"""
        child = ConcreteNode("child")
        parent = ConcreteNode("parent")
        parent.add_children(child)

        grp = NodeGroup("test", [parent, child])
        tables = {"domain1": MockTable()}

        grp._execute_sequential(tables)

        assert child.executed
        assert parent.executed

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

        # Should be faster than sequential execution
        assert end_time - start_time < 0.5  # Much less than 0.3 + 0.1 + 0.1

        assert fast_child.executed
        assert slow_child.executed
        assert parent.executed

    def test_execute_single_thread(self):
        """Test execution with n_threads=1 falls back to sequential"""
        child = ConcreteNode("child")
        parent = ConcreteNode("parent")
        parent.add_children(child)

        grp = NodeGroup("test", [parent])
        tables = {"domain1": MockTable()}

        with patch.object(grp, "_execute_sequential") as mock_sequential:
            mock_sequential.return_value = {"PARENT": MockTable(), "CHILD": MockTable()}

            grp.execute(tables, n_threads=1)

            mock_sequential.assert_called_once()

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

        child = ConcreteNode("child")
        parent = ConcreteNode("parent")
        parent.add_children(child)

        # Mock that nodes haven't been computed before
        child._get_last_hash = Mock(return_value=None)
        child._get_current_hash = Mock(return_value=2345)
        child._update_current_hash = Mock(return_value=True)

        parent._get_last_hash = Mock(return_value=None)
        parent._get_current_hash = Mock(return_value=1234)
        parent._update_current_hash = Mock(return_value=True)

        grp = NodeGroup("test", [parent])
        tables = {"domain1": MockTable()}

        grp.execute(tables, con=mock_connector, overwrite=True, lazy_execution=True)

        assert child.executed
        assert parent.executed


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
