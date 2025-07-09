import hashlib
import json
from typing import Dict, List
import pandas as pd
import ibis
from ibis.expr.types.relations import Table
from phenex.util.serialization.to_dict import to_dict
from phenex.util import create_logger
from phenex.ibis_connect import DuckDBConnector

logger = create_logger(__name__)

NODE_STATES_TABLE_NAME = "__PHENEX_META__NODE_STATES"
NODE_STATES_DB_NAME = "phenex.db"


class PhenexComputeNode:
    """
    A PhenexComputeNode is a "unit of computation" in the execution of phenotypes / cohorts. Its output is always a single table. PhenexComputeNode manages the execution of itself and any children (dependent) nodes, optionally using lazy (re)execution for making incremental updates to a node defintion.

    To subclass:
        1. Define the parameters required to compute the Node in the `__init__()` interface.
        2. At the end of `__init__()`, call super().__init__() as pass along the required children nodes - a list of Node's which must be executed before the current Node, allowing Node's to be chained and executed recursively.
        3. Define `self._execute()`. The `self._execute()` method is reponsible for interpreting the input parameters to the Node and returning the appropriate Table.
        4. Define tests in `phenex.test`! We demand a high level of test coverage for our code. High test coverage gives us confidence that our answers are correct and makes it easier to make changes to the code later on.

    Parameters:
        name: A short but descriptive name for the node. The name is used as a unique identifier for the node and must be unique across all nodes used in the graph (you cannot have two nodes called "age_phenotype", for example, as they will conflict with each other). If the output table is materialized from this node, name will be used as the table name in the database.
        children: The list of dependent nodes that must be executed before this node can run.

    Attributes:
        table: The stored output from call to self.execute().

    """

    def __init__(self, name: str, children: List["PhenexComputeNode"] = None):
        self._name = name
        self.children = children if children is not None else []
        self.table = None
        self._check_children_are_ok()

    @property
    def name(self):
        if self._name is not None:
            return self._name.upper()
        return "PHENOTYPE"  # TODO replace with phenotype id when phenotype id is implemented

    @name.setter
    def name(self, name):
        self._name = name

    def _check_children_are_ok(self):
        """
        Checks that children nodes are in fact PhenexComputeNode's and contain no duplicate names between this node and its children.
        """
        for node in self.children:
            if not isinstance(node, PhenexComputeNode):
                raise ValueError(
                    "Dependent children must be of type PhenexComputeNode!"
                )

        child_names = [child.name for child in self.children]
        if self.name in child_names:
            raise ValueError(
                f"Duplicate node name found: '{self.name}' is used both for this node and one of its children."
            )

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
        con: "SnowflakeConnector" = None,
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
