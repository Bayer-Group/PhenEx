import hashlib
import json
from typing import Dict, List
from ibis.expr.types.relations import Table
from phenex.util import create_logger
from phenex.util.serialization.to_dict import to_dict

logger = create_logger(__name__)


class PhenexComputeNode:
    """
    A PhenexComputeNode is a "unit of computation" in the execution of phenotypes / cohorts. Its output is always a single table. PhenexComputeNode manages the execution of itself and any children (dependent) nodes, optionally using lazy (re)execution for making incremental updates to a node defintion.

    Parameters:
        name: A short but descriptive name for the node. The name is used as a unique identifier for the node and must be unique across all nodes used in the graph (you cannot have two nodes called "age_phenotype", for example, as they will conflict with each other).
        children: The list of dependent nodes that must be executed before this node can run.

    Attributes:
        table: The stored output from call to self.execute().

    """

    def __init__(self, name: str, children: List["PhenexComputeNode"] = None):
        self.name = name
        self.children = children if children is not None else []
        self.table = None
        self.hash = None
        self._check_children_are_ok()

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

    def _compute_hash(self):
        """
        Computes a hash of the node's defining parameters for change detection in lazy execution.

        Returns:
            str: The MD5 hash of the node's attributes as a hexadecimal string.
        """
        as_dict = to_dict(self)
        dhash = hashlib.md5()
        # Use json.dumps to get a string, enforce sorted keys for deterministic ordering
        encoded = json.dumps(as_dict, sort_keys=True).encode()
        dhash.update(encoded)
        return dhash.hexdigest()

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
        logger.info(f"Node '{self.name}': executing ...")
        for child in self.children:
            logger.info(f"Node '{self.name}': executing children nodes ...")
            child.execute(
                tables=tables,
                con=con,
                overwrite=overwrite,
                lazy_execution=lazy_execution,
            )
        if lazy_execution:
            if not overwrite:
                raise ValueError("lazy_execution only works with overwrite=True.")
            if con is None:
                raise ValueError(
                    "A DatabseConnector is required for lazy execution. Comupted tables will be materialized and only recomputed as needed."
                )

            # first time computing, self.hash will be None and execution will still be triggered
            hash = self._compute_hash()
            if hash != self.hash:
                logger.info(
                    f"Node '{self.name}': changed since last computation -- recomputing ..."
                )
                self.table = self._execute(tables)
                logger.info(f"Node '{self.name}': writing table to {self.name} ...")
                con.create_table(
                    self.table,
                    self.name,
                    overwrite=overwrite,
                )
                self.hash = hash
            else:
                logger.info(
                    f"Node '{self.name}': unchanged since last computation -- skipping!"
                )

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
