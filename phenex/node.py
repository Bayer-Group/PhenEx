import hashlib
import json
from typing import Dict, List, Set, Optional
import pandas as pd
import ibis
from ibis.expr.types.relations import Table
from datetime import datetime
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.node_manager import NodeManager
import threading
import queue
from deepdiff import DeepDiff
from collections import defaultdict

logger = create_logger(__name__)

NODE_STATES_TABLE_NAME = "__PHENEX_META__NODE_STATES"
NODE_STATES_DB_NAME = "phenex.db"


class Node:
    """
    A Node is a "unit of computation" in the execution of phenotypes and cohorts in PhenEx. Each Node outputs a single table and the output table is the smallest unit of computation in PhenEx that can be materialized to a database. Anything you want to "checkpoint-able" should be encapsulated within a Node. Smaller units of calculation are never materialized.

    A Node is defined by an arbitrary set of user-specified parameters and can have arbitrary dependencies. Abstractly, a Node represents a node in the directed acyclic graph (DAG) that determines the order of execution of dependencies for a given Phenotype (which is itself a Node). The Node class manages the execution of itself and any dependent nodes, optionally using lazy (re)execution for making incremental updates to a Node object.

    The user injects the logic for producing the output table from the input parameters and dependent nodes by subclassing Node.

    To subclass:
        1. Define the parameters required to compute the Node in the `__init__()` interface.
        2. At the top of `__init__()`, call super().__init__(). This must be called before any calls to `add_children()`.
        3. Register children nodes - Node's which must be executed before the current Node - by calling `add_children()`, allowing Node's to be executed recursively. You only need to add direct dependencies as children. Deeper dependencies (children of children) are automatically inferred.
        4. Define `self._execute()`. The `self._execute()` method is reponsible for interpreting the input parameters to the Node and returning the appropriate Table.
        5. Define tests in `phenex.test`! High test coverage gives us confidence that our answers are correct and makes it easier to make changes to the code later on.

    Parameters:
        name: A short, descriptive, and unique name for the node. The name is used as a unique identifier for the node and cannot be the same as the name of any dependent node (you cannot have two dependent nodes called "codelist_phenotype", for example). If the output table is materialized from this node, name will be used as the table name in the database.

    Attributes:
        table: The stored output from call to self.execute().

    Example:
        ```python
        class MyNode(Node):
            def __init__(self, name, other_node, threshold=10):

                # call super() at the TOP of __init__()
                super(MyNode, self).__init__(name=name)
                self.other_node = other_node
                self.threshold = threshold

                # Add any dependent nodes
                self.add_children(other_node)

            def _execute(self, tables):
                # Your computation logic here
                return some_table
        ```
    """

    # Class-level node manager for state tracking
    _node_manager = NodeManager()

    def __init__(self, name: Optional[str] = None):
        self._name = name or type(self).__name__
        self._children = []
        self.table = None  # populated upon call to execute()
        self._last_execution_start_time = None
        self._last_execution_end_time = None
        self._last_execution_duration = None

    def add_children(self, children):
        if not isinstance(children, list):
            children = [children]
        for child in children:
            if self._check_child_can_be_added(child):
                self._children.append(child)

    def __rshift__(self, right):
        self.add_children(right)
        return right

    def _check_child_can_be_added(self, child):
        """
        Checks that child node can be added to self.children. A child node must:
            1. Be of type Node
            2. Not already be in self.children
            3. Does not create a circular dependency and
            4. Have a unique name from all other dependencies
        """
        if not isinstance(child, Node):
            raise ValueError("Dependent children must be of type Node!")

        if any([c is child for c in self.children]):
            # note to use IS and not IN since IN check __eq__ and you can have
            # __eq__ nodes that are not the same. A bit pedantic of a point;
            # anyway, the check on duplicate names will raise an error but it's
            # useful for the user to know the difference, i.e., literally THIS
            # object has already been added or an otherwise identical object has
            # already been added
            raise ValueError(
                f"Duplicate node found: the node '{child.name}' has already been added to the list of children."
            )

        # Check for circular dependencies: ensure that self is not already a dependency of child
        if self in child.dependencies:
            raise ValueError(
                f"Circular dependency detected: adding '{child.name}' as a child of '{self.name}' "
                f"would create a circular dependency because '{self.name}' is already a dependency of '{child.name}'."
            )

        for dep in self.dependencies:
            if child.name == dep.name and child is not dep:
                raise ValueError(
                    f"Duplicate node name found: the name '{child.name}' is used both for this node and one of its dependencies."
                )

        return True

    @property
    def children(self):
        # implementation of children as a property to prevent direct modification
        return self._children[:]

    @property
    def dependencies(self) -> Set["Node"]:
        """
        Recursively collect all dependencies of a node (including dependencies of dependencies).

        Returns:
            List[Node]: A list of Node objects on which this Node depends.
        """
        # always recompute the dependencies because you don't know if a child has invalidated the dependency list
        return list(self._collect_all_dependencies().values())

    @property
    def dependency_graph(self) -> Dict["Node", Set["Node"]]:
        """
        Build a dependency graph where each node maps to its direct dependencies (children).

        Returns:
            Dict[Node, Set[Node]: A mapping of Node's to their children Node's.
        """
        graph = defaultdict(set)
        graph[self] = self.children

        for node in self.dependencies:
            graph[node] = node.children
        return dict(graph)

    @property
    def reverse_dependency_graph(self) -> Dict["Node", Set["Node"]]:
        """
        Build a reverse dependency graph where each node maps to nodes that depend on it (parents).

        Returns:
            Dict[Node, List[Node]: A mapping of Node's to their parent Node's.
        """
        reverse_graph = defaultdict(set)
        for parent, children in self.dependency_graph.items():
            for child in children:
                reverse_graph[child].add(parent)
        return dict(reverse_graph)

    def _collect_all_dependencies(self, visited: Set[str] = None) -> Dict[str, "Node"]:
        if visited is None:
            visited = set()

        all_deps = {}

        # Avoid infinite loops with circular dependencies
        if self.name in visited:
            return all_deps
        visited.add(self.name)

        # Add direct children (dependencies)
        for child in self.children:
            if child.name not in all_deps:
                all_deps[child.name] = child
                # Recursively collect dependencies of this child
                child_deps = child._collect_all_dependencies(visited.copy())
                all_deps.update(child_deps)

        return all_deps

    @property
    def name(self):
        return self._name.upper()

    @name.setter
    def name(self, name):
        self._name = name

    @property
    def execution_metadata(self):
        """
        Retrieve the full execution metadata row for this node from the local DuckDB database.

        Returns:
            pandas.DataFrame: A table containing NODE_NAME, NODE_HASH, NODE_PARAMS, EXECUTION_PARAMS, EXECUTION_START_TIME, EXECUTION_END_TIME, and EXECUTION_DURATION for execution of this node, or None if the node has never been executed.
        """
        return Node._node_manager.get_run_params(self)

    def _get_current_hash(self):
        """
        Computes a hash of the node's defining parameters for quickly identifying Node's that differ.

        Returns:
            int: An integer hash of the node's attributes.
        """
        as_dict = self.to_dict()
        # to make sure that difference classes that take the same parameters return different hashes!
        as_dict["class"] = self.__class__.__name__
        dhash = hashlib.md5()
        # Use json.dumps to get a string, enforce sorted keys for deterministic ordering
        encoded = json.dumps(as_dict, sort_keys=True).encode()
        dhash.update(encoded)
        # must return an integer to be used with __hash__()
        return int(dhash.hexdigest()[:8], 16)

    def __hash__(self):
        # For python built-in function hash().
        # Convert hex string to integer for consistent hashing
        return self._get_current_hash()

    def clear_cache(self, con: Optional[object] = None, recursive: bool = False):
        """
        Clear the cached state for this node, forcing re-execution on the next call to execute().

        This method removes the node's hash from the node states table and optionally drops the materialized table from the database. After calling this method, the node will be treated as if it has never been executed before.

        Parameters:
            con: Database connector. If provided, clears only runs with matching execution context and drops the materialized table. If None, clears all runs for the node.
            recursive: If True, also clear the cache for all child nodes recursively. Defaults to False.

        Example:
            ```python
            # Clear all cached runs for a single node
            my_node.clear_cache()

            # Clear runs with specific execution context and drop materialized table
            my_node.clear_cache(con=my_connector)

            # Clear cache for node and all its dependencies
            my_node.clear_cache(recursive=True)
            ```
        """
        # Delegate all logic to NodeManager
        return Node._node_manager.clear_cache(self, con=con, recursive=recursive)

    def execute(
        self,
        tables: Dict[str, Table] = None,
        con: Optional[object] = None,
        overwrite: bool = False,
        lazy_execution: bool = False,
        n_threads: int = 1,
    ) -> Table:
        """
        Executes the Node computation for the current node and its dependencies.

        Lazy Execution:
            When lazy_execution=True, nodes are only recomputed if changes are detected. The system tracks:
            1. Node definition changes: Detected by hashing the node's parameters (from to_dict()) and class name
            2. Execution environment changes: Detected by tracking source/destination database configurations

            A node will be rerun if either:
            - The node's defining parameters have changed (different hash than last execution)
            - The database connector's source or destination databases have changed
            - The node has never been executed before

            If no changes are detected, the node uses its cached result from the database instead of recomputing.

            Requirements for lazy execution:
            - A database connector (con) must be provided to store and retrieve cached results
            - overwrite=True must be set to allow updating existing cached tables

            State tracking is maintained in a local DuckDB database (__PHENEX_META__NODE_STATES table) that stores:
            - Node hashes, parameters, and execution metadata
            - Database connector configuration used during execution
            - Execution timing information

        Parameters:
            tables: A dictionary mapping domains to Table objects.
            con: Connection to database for materializing outputs. If provided, outputs from the node and all children nodes will be materialized (written) to the database using the connector. Required for lazy_execution.
            overwrite: If True, will overwrite any existing tables found in the database while writing. If False, will throw an error when an existing table is found. Has no effect if con is not passed. Must be True when using lazy_execution.
            lazy_execution: If True, only re-executes nodes when changes are detected in either the node definition or execution environment. Defaults to False. Requires con to be provided.
            n_threads: Max number of Node's to execute simultaneously when this node has multiple children.

        Returns:
            Table: The resulting table for this node. Also accessible through self.table after calling self.execute().

        Raises:
            ValueError: If lazy_execution=True but overwrite=False or con=None.
        """
        # Handle None tables
        if tables is None:
            tables = {}

        # Build dependency graph for all dependencies
        all_deps = self.dependencies
        nodes = {node.name: node for node in all_deps}
        nodes[self.name] = self  # Add self to the nodes

        # Build dependency and reverse graphs
        dependency_graph = self._build_dependency_graph(nodes)
        reverse_graph = self._build_reverse_graph(dependency_graph)

        # Track completion status and results
        completed = set()
        completion_lock = threading.Lock()
        worker_exceptions = []  # Track exceptions from worker threads
        stop_all_workers = (
            threading.Event()
        )  # Signal to stop all workers on first error

        # Track in-degree for scheduling
        in_degree = {}
        for node_name, dependencies in dependency_graph.items():
            in_degree[node_name] = len(dependencies)
        for node_name in nodes:
            if node_name not in in_degree:
                in_degree[node_name] = 0

        # Queue for nodes ready to execute
        ready_queue = queue.Queue()

        # Add nodes with no dependencies to ready queue
        for node_name, degree in in_degree.items():
            if degree == 0:
                ready_queue.put(node_name)

        def worker():
            """Worker function for thread pool"""
            while not stop_all_workers.is_set():
                try:
                    node_name = ready_queue.get(timeout=1)
                    # timeout forces to wait 1 second to avoid busy waiting
                    if node_name is None:  # Sentinel value to stop worker
                        break
                except queue.Empty:
                    continue

                try:
                    logger.info(
                        f"Thread {threading.current_thread().name}: executing node '{node_name}'"
                    )
                    node = nodes[node_name]

                    # Execute the node (without recursive child execution since we handle dependencies here)
                    if lazy_execution:
                        if not overwrite:
                            raise ValueError(
                                "lazy_execution only works with overwrite=True."
                            )
                        if con is None:
                            raise ValueError(
                                "A DatabaseConnector is required for lazy execution."
                            )

                        if Node._node_manager.should_rerun(node, con):
                            # Time the execution
                            node._last_execution_start_time = datetime.now()
                            table = node._execute(tables)

                            if (
                                table is not None
                            ):  # Only create table if _execute returns something
                                con.create_table(table, node_name, overwrite=overwrite)
                                table = con.get_dest_table(node_name)

                            node._last_execution_end_time = datetime.now()
                            node._last_execution_duration = (
                                node._last_execution_end_time
                                - node._last_execution_start_time
                            ).total_seconds()

                            Node._node_manager.update_run_params(node, con)
                        else:
                            table = con.get_dest_table(node_name)
                    else:
                        # Time the execution
                        node._last_execution_start_time = datetime.now()
                        table = node._execute(tables)

                        if (
                            con and table is not None
                        ):  # Only create table if _execute returns something
                            con.create_table(table, node_name, overwrite=overwrite)
                            table = con.get_dest_table(node_name)

                        node._last_execution_end_time = datetime.now()
                        node._last_execution_duration = (
                            node._last_execution_end_time
                            - node._last_execution_start_time
                        ).total_seconds()

                    node.table = table

                    with completion_lock:
                        completed.add(node_name)

                        # Update in-degree for dependent nodes and add ready ones to queue
                        for dependent in reverse_graph.get(node_name, set()):
                            in_degree[dependent] -= 1
                            if in_degree[dependent] == 0:
                                # Check if all dependencies are completed
                                deps_completed = all(
                                    dep in completed
                                    for dep in dependency_graph.get(dependent, set())
                                )
                                if deps_completed:
                                    ready_queue.put(dependent)

                    # Log completion with timing info
                    if node._last_execution_duration is not None:
                        logger.info(
                            f"Thread {threading.current_thread().name}: completed node '{node_name}' "
                            f"in {node._last_execution_duration:.3f} seconds"
                        )
                    else:
                        logger.info(
                            f"Thread {threading.current_thread().name}: completed node '{node_name}' (cached)"
                        )

                except Exception as e:
                    logger.error(f"Error executing node '{node_name}': {str(e)}")
                    with completion_lock:
                        # Store exception for main thread
                        worker_exceptions.append(e)
                        # Signal all workers to stop immediately and exit worker loop
                        stop_all_workers.set()
                        break
                finally:
                    ready_queue.task_done()

        # Start worker threads
        threads = []
        for i in range(min(n_threads, len(nodes))):
            thread = threading.Thread(target=worker, name=f"PhenexWorker-{i}")
            thread.daemon = True
            thread.start()
            threads.append(thread)

        # Wait for all nodes to complete or for an error to occur
        while (
            len(completed) < len(nodes)
            and not worker_exceptions
            and not stop_all_workers.is_set()
        ):
            threading.Event().wait(0.1)  # Small delay to prevent busy waiting

        if not stop_all_workers.is_set():
            # Time to stop workers and cleanup
            stop_all_workers.set()

        # Check if any worker thread had an exception
        if worker_exceptions:
            # Signal workers to stop
            for _ in threads:
                ready_queue.put(None)
            # Wait for threads to finish
            for thread in threads:
                thread.join(timeout=1)
            # Re-raise the first exception
            raise worker_exceptions[0]

        # Signal workers to stop and wait for them
        for _ in threads:
            ready_queue.put(None)  # Sentinel value to stop workers

        for thread in threads:
            thread.join(timeout=1)

        logger.info(
            f"Node '{self.name}': completed multithreaded execution of {len(nodes)} nodes"
        )
        return self.table

    def _build_dependency_graph(self, nodes: Dict[str, "Node"]) -> Dict[str, Set[str]]:
        """
        Build a dependency graph where each node maps to its direct dependencies (children).
        """
        graph = defaultdict(set)
        for node_name, node in nodes.items():
            for child in node.children:
                if child.name in nodes:
                    graph[node_name].add(child.name)
        return dict(graph)

    def _build_reverse_graph(
        self, dependency_graph: Dict[str, Set[str]]
    ) -> Dict[str, Set[str]]:
        """
        Build a reverse dependency graph where each node maps to nodes that depend on it (parents).
        """
        reverse_graph = defaultdict(set)
        for node_name, dependencies in dependency_graph.items():
            for dep in dependencies:
                reverse_graph[dep].add(node_name)
        return dict(reverse_graph)

    def _execute(self, tables: Dict[str, Table] = None) -> Table:
        """
        Implements the processing logic for this node. Should be implemented by subclasses to define specific computation logic.

        Parameters:
            tables (Dict[str, Table]): A dictionary where the keys are table domains and the values are Table objects.

        Raises:
            NotImplementedError: This method should be implemented by subclasses.
        """
        raise NotImplementedError()

    def __eq__(self, other: "Node") -> bool:
        return hash(self) == hash(other)

    def diff(self, other: "Node"):
        return DeepDiff(self.to_dict(), other.to_dict(), ignore_order=True)

    def to_dict(self):
        """
        Return a dictionary representation of the Node. The dictionary must contain all dependencies of the Node such that if anything in self.to_dict() changes, the Node must be recomputed.
        """
        return to_dict(self)

    def __repr__(self):
        return f"Node('{self.name}')"

    def visualize_dependencies(self) -> str:
        """
        Create a text visualization of the dependency graph for this node and its dependencies.

        Returns:
            str: A text representation of the dependency graph
        """
        lines = [f"Dependencies for Node '{self.name}':"]

        # Get all dependencies
        all_deps = self.dependencies
        nodes = {node.name: node for node in all_deps}
        nodes[self.name] = self  # Add self to the nodes

        # Build dependency graph
        dependency_graph = self._build_dependency_graph(nodes)

        for node_name in sorted(nodes.keys()):
            dependencies = dependency_graph.get(node_name, set())
            if dependencies:
                deps_str = ", ".join(sorted(dependencies))
                lines.append(f"  {node_name} depends on: {deps_str}")
            else:
                lines.append(f"  {node_name} (no dependencies)")

        return "\n".join(lines)


class NodeGroup(Node):
    """
    A NodeGroup is a simple grouping mechanism for nodes that should run together. It is a no-op node that returns no table and is simply used to enforce dependencies and organize related nodes.

    The NodeGroup acts as a container that ensures all its child nodes are executed when the group is executed. It does not perform any computation itself and returns None from its _execute method.

    Parameters:
        name: A short and descriptive name for the NodeGroup.
        nodes: A list of Node objects to be grouped together. When the NodeGroup is executed, all these nodes (and their dependencies) will be executed.
    """

    def __init__(self, name: str, nodes: List[Node]):
        super(NodeGroup, self).__init__(name=name)
        self.add_children(nodes)

    def _execute(self, tables: Dict[str, Table] = None) -> Table:
        """
        Execute all children nodes and return a table with information about dependencies.
        The execution logic is handled by the parent Node class.
        """
        # Create a table with NODE_NAME and NODE_PARAMS for each dependency
        data = []
        for node in self.dependencies:
            data.append(
                {"NODE_NAME": node.name, "NODE_PARAMS": json.dumps(node.to_dict())}
            )

        # Create a pandas DataFrame and convert to ibis memtable
        df = pd.DataFrame(data)
        return ibis.memtable(df)
