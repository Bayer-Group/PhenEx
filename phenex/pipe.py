import hashlib
import json
from typing import Dict, List, Set, Optional
import pandas as pd
import ibis
from ibis.expr.types.relations import Table
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.ibis_connect import DuckDBConnector
import threading
import queue
from collections import defaultdict, deque


logger = create_logger(__name__)

NODE_STATES_TABLE_NAME = "__PHENEX_META__NODE_STATES"
NODE_STATES_DB_NAME = "phenex.db"


class PhenexComputeNode:
    """
    A PhenexComputeNode is a "unit of computation" in the execution of phenotypes / cohorts. Its output is always a single table. PhenexComputeNode manages the execution of itself and any children (dependent) nodes, optionally using lazy (re)execution for making incremental updates to a node defintion.

    To subclass:
        1. Define the parameters required to compute the Node in the `__init__()` interface.
        2. At the top of `__init__()`, call super().__init__().
        3. Add all prerequisite nodes - Node's which must be executed before the current Node - by calling `add_children()`, allowing Node's to be chained and executed recursively.
        4. Define `self._execute()`. The `self._execute()` method is reponsible for interpreting the input parameters to the Node and returning the appropriate Table.
        5. Define tests in `phenex.test`! We demand a high level of test coverage for our code. High test coverage gives us confidence that our answers are correct and makes it easier to make changes to the code later on.

    Parameters:
        name: A short but descriptive name for the node. The name is used as a unique identifier for the node and must be unique across all nodes used in the graph (you cannot have two nodes called "age_phenotype", for example, as they will conflict with each other). If the output table is materialized from this node, name will be used as the table name in the database.

    Attributes:
        table: The stored output from call to self.execute().

    """

    def __init__(self, name: Optional[str] = None):
        self._name = name or type(self).__name__
        self._children = []

    def add_children(self, children):
        if not isinstance(children, list):
            children = [children]
        for child in children:
            if not child in self.children:
                self._check_child(child)
                self.children.append(child)

    def __rshift__(self, right):
        self.add_children(right)
        return right

    def _check_child(self, child):
        """
        Checks that child node can be added to self.children. A child node must:
            1. Be of type PhenexComputeNode
            2. Not already be in self.children and
            3. Have a unique name.
        """
        if not isinstance(child, PhenexComputeNode):
            raise ValueError("Dependent children must be of type PhenexComputeNode!")
        # if child in self.children:
        #     raise ValueError(
        #         f"Duplicate node found: '{child.name}' has already been added to list of children."
        #     )
        child_names = [child.name for child in self.children]
        if child.name in child_names:
            raise ValueError(
                f"Duplicate node name found: the name '{child.name}' is used both for this node and one of its children."
            )
        return True

    @property
    def children(self):
        # implementation of children as a property to prevent direct modification
        return self._children

    @property
    def name(self):
        if self._name is not None:
            return self._name.upper()
        return "PHENOTYPE"  # TODO replace with phenotype id when phenotype id is implemented

    @name.setter
    def name(self, name):
        self._name = name

    def _get_last_hash(self):
        """
        Retrieve the hash of the node's defining parameters from the last time it was computed. This hash is stored in a local DuckDB database.

        Returns:
            str: The MD5 hash of the node's attributes as a hexadecimal string.
        """
        con = DuckDBConnector(DUCKDB_DEST_DATABASE=NODE_STATES_DB_NAME)
        if NODE_STATES_TABLE_NAME in con.dest_connection.list_tables():
            table = con.get_dest_table(NODE_STATES_TABLE_NAME).to_pandas()
            table = table[table.NODE_NAME == self.name]
            if len(table):
                return table[table.NODE_NAME == self.name].iloc[0].LAST_HASH

    def _get_current_hash(self):
        """
        Computes the hash of the node's defining parameters for change detection in lazy execution.

        Returns:
            str: The MD5 hash of the node's attributes as a hexadecimal string.
        """
        as_dict = self.to_dict()
        # to make sure that difference classes that take the same parameters return different hashes!
        as_dict["class"] = self.__class__.__name__
        dhash = hashlib.md5()
        # Use json.dumps to get a string, enforce sorted keys for deterministic ordering
        encoded = json.dumps(as_dict, sort_keys=True).encode()
        dhash.update(encoded)
        return dhash.hexdigest()

    def _update_current_hash(self):

        con = DuckDBConnector(DUCKDB_DEST_DATABASE=NODE_STATES_DB_NAME)

        df = pd.DataFrame.from_dict(
            {
                "NODE_NAME": [self.name],
                "LAST_HASH": [self._get_current_hash()],
                "NODE_PARAMS": [json.dumps(self.to_dict())],
            }
        )

        if NODE_STATES_TABLE_NAME in con.dest_connection.list_tables():
            table = con.get_dest_table(NODE_STATES_TABLE_NAME).to_pandas()
            table = table[table.NODE_NAME != self.name]
            df = pd.concat([table, df])

        table = ibis.memtable(df)
        con.create_table(table, name_table=NODE_STATES_TABLE_NAME, overwrite=True)

        return True

    def execute(
        self,
        tables: Dict[str, Table] = None,
        con: Optional[object] = None,
        overwrite: bool = False,
        lazy_execution: bool = False,
    ) -> Table:
        """
        Executes the phenotype computation for the current node and its children. Recursively executes all child nodes. Supports lazy execution using hash-based change detection.

        Parameters:
            tables: A dictionary mapping domains to Table objects.
            con: Connection to database for materializing outputs. If provided, outputs from the node and all children nodes will be materialized (written) to the database using the connector.
            overwrite: If True, will overwrite any existing tables found in the database while writing. If False, will throw an error when an existing table is found. Has no effect if con is not passed.
            lazy_execution: If True, only re-executes if the node's definition has changed. Defaults to False. You should pass overwrite=True with lazy_execution as lazy_execution is intended precisely for iterative updates to a node definition. You must pass a connector (to cache results) for lazy_execution to work.

        Returns:
            Table: The resulting table for this node. Also accessible through self.talbe after calling self.execute().
        """

        # First recursively execute all children nodes
        logger.info(f"Node '{self.name}': executing ...")
        for child in self.children:
            logger.info(f"Node '{self.name}': executing child node {child.name} ...")
            child.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                lazy_execution=lazy_execution,
            )

        # Execute current node
        if lazy_execution:
            if not overwrite:
                raise ValueError("lazy_execution only works with overwrite=True.")
            if con is None:
                raise ValueError(
                    "A DatabaseConnector is required for lazy execution. Comupted tables will be materialized and only recomputed as needed."
                )

            # first time computing, _get_current_hash() will be None and execution will still be triggered
            if self._get_current_hash() != self._get_last_hash():
                logger.info(
                    f"Node '{self.name}': not yet computed or changed since last computation -- recomputing ..."
                )
                self.table = self._execute(tables)
                logger.info(f"Node '{self.name}': writing table to {self.name} ...")
                con.create_table(
                    self.table,
                    self.name,
                    overwrite=overwrite,
                )
                self._update_current_hash()
            else:
                logger.info(
                    f"Node '{self.name}': unchanged since last computation -- skipping!"
                )
                self.table = con.get_dest_table(self.name)

        else:
            self.table = self._execute(tables)
            if con:
                logger.info(f"Node '{self.name}': writing table to {self.name} ...")
                con.create_table(
                    self.table,
                    self.name,
                    overwrite=overwrite,
                )

        logger.info(f"Node '{self.name}': execution completed.")
        return self.table

    def _execute(self, tables: Dict[str, Table]) -> Table:
        """
        Implements the processing logic for this node. Should be implemented by subclasses to define specific computation logic.

        Parameters:
            tables (Dict[str, Table]): A dictionary where the keys are table domains and the values are Table objects.

        Raises:
            NotImplementedError: This method should be implemented by subclasses.
        """
        raise NotImplementedError()

    def to_dict(self):
        """
        Return a dictionary representation of the Node. The dictionary must contain all dependencies of the Node such that if anything in self.to_dict() changes, the Node must be recomputed.
        """
        return to_dict(self)

    def __repr__(self):
        return f"node={self.name}"


class PhenexWorkflow:
    """
    A PhenexComputeGraph manages the execution of multiple PhenexComputeNodes in the correct dependency order,
    with support for multithreaded execution while respecting dependencies.

    The graph ensures that child nodes (dependencies) are computed before their parent nodes,
    and allows N threads to compute nodes concurrently when their dependencies have been satisfied.

    Parameters:
        nodes: A list of PhenexComputeNode objects to be computed
    """

    def __init__(self, nodes: List[PhenexComputeNode]):
        self.nodes = {node.name: node for node in nodes}
        self._dependency_graph = self._build_dependency_graph()
        self._reverse_graph = self._build_reverse_graph()

    def _build_dependency_graph(self) -> Dict[str, Set[str]]:
        """
        Build a dependency graph where each node maps to its direct dependencies (children).
        """
        graph = defaultdict(set)
        for node_name, node in self.nodes.items():
            for child in node.children:
                if child.name in self.nodes:
                    graph[node_name].add(child.name)
        return dict(graph)

    def _build_reverse_graph(self) -> Dict[str, Set[str]]:
        """
        Build a reverse dependency graph where each node maps to nodes that depend on it (parents).
        """
        reverse_graph = defaultdict(set)
        for node_name, dependencies in self._dependency_graph.items():
            for dep in dependencies:
                reverse_graph[dep].add(node_name)
        return dict(reverse_graph)

    def _topological_sort(self) -> List[str]:
        """
        Perform topological sort to determine the execution order.
        Returns nodes in dependency order (children before parents).
        """
        in_degree = defaultdict(int)

        # Initialize in-degree for all nodes
        for node_name in self.nodes:
            in_degree[node_name] = 0

        # Calculate in-degrees
        for node_name, dependencies in self._dependency_graph.items():
            in_degree[node_name] = len(dependencies)

        # Start with nodes that have no dependencies
        queue_nodes = deque([node for node, degree in in_degree.items() if degree == 0])
        result = []

        while queue_nodes:
            current = queue_nodes.popleft()
            result.append(current)

            # Reduce in-degree for dependent nodes
            for dependent in self._reverse_graph.get(current, set()):
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue_nodes.append(dependent)

        if len(result) != len(self.nodes):
            raise ValueError("Circular dependency detected in the compute graph")

        return result

    def _validate_dependencies(self):
        """
        Validate that all node dependencies exist in the graph.
        """
        missing_deps = []
        for node_name, node in self.nodes.items():
            for child in node.children:
                if child.name not in self.nodes:
                    missing_deps.append((node_name, child.name))

        if missing_deps:
            error_msg = "Missing dependencies found:\n"
            for parent, child in missing_deps:
                error_msg += f"  Node '{parent}' depends on '{child}' which is not in the graph\n"
            raise ValueError(error_msg)

    def execute(
        self,
        tables: Dict[str, Table] = None,
        con: Optional[object] = None,
        overwrite: bool = False,
        lazy_execution: bool = False,
        n_threads: int = 4,
    ) -> Dict[str, Table]:
        """
        Execute all nodes in the graph in the correct dependency order using multithreading.

        Parameters:
            tables: A dictionary mapping domains to Table objects
            con: Database connector for materializing outputs
            overwrite: Whether to overwrite existing tables
            lazy_execution: Whether to use lazy execution with change detection

        Returns:
            Dict[str, Table]: A dictionary mapping node names to their computed tables
        """
        self._validate_dependencies()
        if n_threads == 1:
            return self.execute_sequential(tables, con, overwrite, lazy_execution)

        # Track completion status and results
        completed = set()
        results = {}
        completion_lock = threading.Lock()

        # Track in-degree for scheduling
        in_degree = {}
        for node_name, dependencies in self._dependency_graph.items():
            in_degree[node_name] = len(dependencies)
        for node_name in self.nodes:
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
            while True:
                try:
                    node_name = ready_queue.get(timeout=1)
                    if node_name is None:  # Sentinel value to stop worker
                        break
                except queue.Empty:
                    break

                try:
                    logger.info(
                        f"Thread {threading.current_thread().name}: executing node '{node_name}'"
                    )
                    node = self.nodes[node_name]

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

                        if node._get_current_hash() != node._get_last_hash():
                            logger.info(f"Node '{node_name}': computing...")
                            table = node._execute(tables)
                            con.create_table(table, node_name, overwrite=overwrite)
                            node._update_current_hash()
                        else:
                            logger.info(
                                f"Node '{node_name}': unchanged, using cached result"
                            )
                            table = con.get_dest_table(node_name)
                    else:
                        table = node._execute(tables)
                        if con:
                            con.create_table(table, node_name, overwrite=overwrite)

                    node.table = table

                    with completion_lock:
                        completed.add(node_name)
                        results[node_name] = table

                        # Update in-degree for dependent nodes and add ready ones to queue
                        for dependent in self._reverse_graph.get(node_name, set()):
                            in_degree[dependent] -= 1
                            if in_degree[dependent] == 0:
                                # Check if all dependencies are completed
                                deps_completed = all(
                                    dep in completed
                                    for dep in self._dependency_graph.get(
                                        dependent, set()
                                    )
                                )
                                if deps_completed:
                                    ready_queue.put(dependent)

                    logger.info(
                        f"Thread {threading.current_thread().name}: completed node '{node_name}'"
                    )

                except Exception as e:
                    logger.error(f"Error executing node '{node_name}': {str(e)}")
                    raise
                finally:
                    ready_queue.task_done()

        # Start worker threads
        threads = []
        for i in range(min(n_threads, len(self.nodes))):
            thread = threading.Thread(target=worker, name=f"PhenexWorker-{i}")
            thread.daemon = True
            thread.start()
            threads.append(thread)

        # Wait for all nodes to complete
        while len(completed) < len(self.nodes):
            threading.Event().wait(0.1)  # Small delay to prevent busy waiting

        # Signal workers to stop and wait for them
        for _ in threads:
            ready_queue.put(None)  # Sentinel value to stop workers

        for thread in threads:
            thread.join(timeout=1)

        logger.info(f"PhenexComputeGraph: completed execution of {len(results)} nodes")
        return results

    def execute_sequential(
        self,
        tables: Dict[str, Table] = None,
        con: Optional[object] = None,
        overwrite: bool = False,
        lazy_execution: bool = False,
    ) -> Dict[str, Table]:
        """
        Execute all nodes sequentially in topological order (for debugging/comparison).

        Parameters:
            tables: A dictionary mapping domains to Table objects
            con: Database connector for materializing outputs
            overwrite: Whether to overwrite existing tables
            lazy_execution: Whether to use lazy execution with change detection

        Returns:
            Dict[str, Table]: A dictionary mapping node names to their computed tables
        """
        self._validate_dependencies()
        execution_order = self._topological_sort()
        results = {}

        for node_name in execution_order:
            logger.info(f"Sequential execution: processing node '{node_name}'")
            node = self.nodes[node_name]
            table = node.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                lazy_execution=lazy_execution,
            )
            results[node_name] = table

        return results

    def get_execution_plan(self) -> List[str]:
        """
        Get the planned execution order for nodes.

        Returns:
            List[str]: Node names in execution order
        """
        return self._topological_sort()

    def visualize_dependencies(self) -> str:
        """
        Create a text visualization of the dependency graph.

        Returns:
            str: A text representation of the dependency graph
        """
        lines = ["PhenexComputeGraph Dependencies:"]
        dependency_graph = self._build_dependency_graph()
        for node_name in sorted(self.nodes.keys()):
            dependencies = dependency_graph.get(node_name, set())
            if dependencies:
                deps_str = ", ".join(sorted(dependencies))
                lines.append(f"  {node_name} depends on: {deps_str}")
            else:
                lines.append(f"  {node_name} (no dependencies)")

        return "\n".join(lines)
