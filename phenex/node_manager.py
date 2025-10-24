import json
import threading
import uuid
from datetime import datetime
from typing import Dict, Optional
import pandas as pd
import ibis

from phenex.util import create_logger
from phenex.ibis_connect import DuckDBConnector

logger = create_logger(__name__)

NODE_STATES_TABLE_NAME = "__PHENEX_META__NODE_STATES"
NODE_STATES_DB_NAME = "phenex.db"


class NodeManager:
    """
    Manages node state tracking for lazy execution, including determining when nodes
    should be rerun and storing/retrieving execution metadata.

    The NodeManager tracks node executions by matching:
    1. Node name
    2. Execution context (database connector configuration)
    3. Node hash (computed from node parameters)

    This allows for context-aware lazy execution where nodes are only recomputed
    when either the node definition changes or the execution context changes.
    """

    # Class-level lock for thread-safe operations
    _lock = threading.RLock()

    def __init__(self, db_name: str = NODE_STATES_DB_NAME):
        self.db_name = db_name

    def should_rerun(self, node, con) -> bool:
        """
        Determine if a node should be rerun based on changes to node definition or execution context.

        Logic:
        1. Look up previous runs of a node by matching name and execution context
        2. If a run is found with the same name and execution context, check the node hash to see if the node itself has changed
        3. If the node hash has not changed, return False; if node has changed, return True
        4. If no entry is found with the same name and execution context, return True

        Parameters:
            node: The Node object to check
            con: Database connector object (determines execution context)

        Returns:
            bool: True if the node should be rerun, False otherwise
        """
        reasons = []

        # Get current execution context
        current_execution_params = self._get_execution_params(con)

        # Get current node hash
        current_hash = self._get_node_hash(node)

        # Look up previous run with same name and execution context
        last_hash = self._getlasthash(
            node.name, execution_params=current_execution_params
        )

        # Determine if node should rerun
        node_changed = current_hash != last_hash

        if node_changed:
            if last_hash is None:
                reasons.append("never executed with these parameters")
            else:
                reasons.append("node definition changed")

        should_rerun = node_changed

        # Log the decision
        if should_rerun:
            reason_str = ", ".join(reasons)
            logger.info(f"Node '{node.name}': {reason_str}, computing...")
        else:
            logger.info(f"Node '{node.name}': unchanged, using cached result")

        return should_rerun

    def update_run_params(self, node, con) -> bool:
        """
        Update the run parameters for a node after execution.

        This atomically removes any existing entry with the same node name and execution context, then inserts a new entry with updated execution metadata.

        Parameters:
            node: The Node object that was executed
            con: Database connector object (determines execution context)

        Returns:
            bool: True if successful
        """
        execution_params = self._get_execution_params(con)
        last_hash = self._getlasthash(node.name, execution_params=execution_params)

        with self._lock:
            duckdb_con = DuckDBConnector(DUCKDB_DEST_DATABASE=self.db_name)

            # Get current node hash
            current_hash = self._get_node_hash(node)

            # Create new row data
            new_row = pd.DataFrame.from_dict(
                {
                    "EXECUTION_ID": [str(uuid.uuid4())],
                    "NODE_NAME": [node.name],
                    "NODE_HASH": [current_hash],
                    "NODE_PARAMS": [json.dumps(node.to_dict())],
                    "EXECUTION_PARAMS": [
                        (
                            json.dumps(execution_params, sort_keys=True)
                            if execution_params is not None
                            else None
                        )
                    ],
                    "EXECUTION_START_TIME": [node.lastexecution_start_time],
                    "EXECUTION_END_TIME": [node.lastexecution_end_time],
                    "EXECUTION_DURATION": [node.lastexecution_duration],
                }
            )

            if NODE_STATES_TABLE_NAME in duckdb_con.dest_connection.list_tables():
                existing_table = duckdb_con.get_dest_table(
                    NODE_STATES_TABLE_NAME
                ).to_pandas()

                # Remove matching row if it exists
                if last_hash is not None:
                    execution_params_json = (
                        json.dumps(execution_params, sort_keys=True)
                        if execution_params is not None
                        else None
                    )

                    if execution_params_json is None:
                        # Remove row with matching node name, hash, and null execution params
                        mask = (
                            (existing_table.NODE_NAME == node.name)
                            & (existing_table.NODE_HASH == last_hash)
                            & pd.isna(existing_table.EXECUTION_PARAMS)
                        )
                    else:
                        # Remove row with matching node name, hash, and execution params
                        mask = (
                            (existing_table.NODE_NAME == node.name)
                            & (existing_table.NODE_HASH == last_hash)
                            & (existing_table.EXECUTION_PARAMS == execution_params_json)
                        )

                    existing_table = existing_table[~mask]

                # Add the new row
                df = pd.concat([existing_table, new_row], ignore_index=True)
            else:
                # No existing table, just use the new row
                df = new_row

            table = ibis.memtable(df)
            duckdb_con.create_table(
                table, name_table=NODE_STATES_TABLE_NAME, overwrite=True
            )

        return True

    def get_run_params(self, node, con=None) -> Optional[pd.DataFrame]:
        """
        Get execution metadata for a node.

        Parameters:
            node: The Node object
            con: Database connector object (optional, used to filter by execution context)

        Returns:
            pandas.DataFrame: Table containing execution metadata for the node, or None if no executions found
        """
        with self._lock:
            duckdb_con = DuckDBConnector(DUCKDB_DEST_DATABASE=self.db_name)
            if NODE_STATES_TABLE_NAME in duckdb_con.dest_connection.list_tables():
                table = duckdb_con.get_dest_table(NODE_STATES_TABLE_NAME).to_pandas()
                table = table[table.NODE_NAME == node.name]

                if con is not None:
                    # Filter by execution context
                    execution_params = self._get_execution_params(con)
                    execution_params_json = (
                        json.dumps(execution_params, sort_keys=True)
                        if execution_params is not None
                        else None
                    )

                    if execution_params_json is None:
                        table = table[pd.isna(table.EXECUTION_PARAMS)]
                    else:
                        table = table[table.EXECUTION_PARAMS == execution_params_json]

                return table if len(table) > 0 else None

            return None

    def clear_cache(self, node, con=None, recursive=False) -> bool:
        """
        Clear cached state for a node.

        Parameters:
            node: The Node object to clear cache for
            con: Optional database connector. If provided, clears only runs with matching execution context and drops the materialized table. If None, clears all runs for the node.
            recursive: If True, also clear the cache for all child nodes recursively. Defaults to False.

        Returns:
            bool: True if successful
        """
        if con is not None:
            logger.info(
                f"Node '{node.name}': clearing cached state for execution context..."
            )
        else:
            logger.info(f"Node '{node.name}': clearing all cached state...")

        if con is not None:
            # Need to run this before acquiring lock since this method also needs to acquire a lock
            execution_params = self._get_execution_params(con)

        with self._lock:
            # Clear from node states table
            duckdb_con = DuckDBConnector(DUCKDB_DEST_DATABASE=self.db_name)
            if NODE_STATES_TABLE_NAME in duckdb_con.dest_connection.list_tables():
                table = duckdb_con.get_dest_table(NODE_STATES_TABLE_NAME).to_pandas()

                if con is not None:
                    # Remove only entries with matching execution context
                    execution_params_json = (
                        json.dumps(execution_params, sort_keys=True)
                        if execution_params is not None
                        else None
                    )

                    if execution_params_json is None:
                        # Remove entries with matching node name and null execution params
                        mask = (table.NODE_NAME == node.name) & pd.isna(
                            table.EXECUTION_PARAMS
                        )
                    else:
                        # Remove entries with matching node name and execution params
                        mask = (table.NODE_NAME == node.name) & (
                            table.EXECUTION_PARAMS == execution_params_json
                        )

                    table = table[~mask]
                else:
                    # Remove all entries for this node
                    table = table[table.NODE_NAME != node.name]

                # Update the table
                if len(table) > 0:
                    updated_table = ibis.memtable(table)
                    duckdb_con.create_table(
                        updated_table, name_table=NODE_STATES_TABLE_NAME, overwrite=True
                    )
                else:
                    # Drop the table if it's empty
                    duckdb_con.dest_connection.drop_table(NODE_STATES_TABLE_NAME)

        # Drop materialized table if connector is provided
        if con is not None:
            try:
                logger.info(f"Node '{node.name}': dropping materialized table...")
                con.drop_table(node.name)
            except Exception as e:
                logger.warning(
                    f"Node '{node.name}': failed to drop materialized table: {e}"
                )

        # Reset the node's table attribute and timing info
        node.table = None
        node.lastexecution_start_time = None
        node.lastexecution_end_time = None
        node.lastexecution_duration = None

        # Recursively clear children if requested
        if recursive:
            for child in node.children:
                self.clear_cache(child, con=con, recursive=recursive)

        logger.info(f"Node '{node.name}': cache cleared successfully.")
        return True

    def _getlasthash(self, node_name: str, execution_params=None) -> Optional[int]:
        """
        Retrieve the hash of a node's defining parameters from the last time it was computed
        with matching execution parameters.

        Parameters:
            node_name: Name of the node
            execution_params: Dictionary of execution parameters to match against

        Returns:
            int: The hash of the node's attributes, or None if no matching entry found
        """
        with self._lock:
            duckdb_con = DuckDBConnector(DUCKDB_DEST_DATABASE=self.db_name)
            if NODE_STATES_TABLE_NAME in duckdb_con.dest_connection.list_tables():
                table = duckdb_con.get_dest_table(NODE_STATES_TABLE_NAME).to_pandas()
                table = table[table.NODE_NAME == node_name]

                if len(table):
                    # Convert execution_params to JSON string for comparison
                    execution_params_json = (
                        json.dumps(execution_params, sort_keys=True)
                        if execution_params is not None
                        else None
                    )

                    # Find matching entry based on execution params
                    if execution_params_json is None:
                        matching_rows = table[pd.isna(table.EXECUTION_PARAMS)]
                    else:
                        matching_rows = table[
                            table.EXECUTION_PARAMS == execution_params_json
                        ]

                    if len(matching_rows):
                        return int(matching_rows.iloc[0].NODE_HASH)

                return None

    def _get_node_hash(self, node) -> int:
        """
        Get the hash of a node by calling its hash() method.

        Parameters:
            node: The Node object

        Returns:
            int: Hash of the node's attributes
        """
        return hash(node)

    def _get_execution_params(self, con) -> Optional[Dict]:
        """
        Extract execution parameters from the connector for tracking context changes.

        Parameters:
            con: Database connector object

        Returns:
            dict: Dictionary containing connector configuration
        """
        if con is None:
            return None

        execution_params = {}

        # Get connector type name for identification
        connector_type = con.__class__.__name__
        execution_params["connector_type"] = connector_type

        # Helper function to convert values to JSON-serializable types
        def _serialize_value(value):
            if hasattr(value, "_mock_name"):  # It's a Mock object
                return str(value)
            return value

        # Handle different connector types - check by class name to handle mocks
        if "Snowflake" in connector_type or hasattr(con, "SNOWFLAKE_SOURCE_DATABASE"):
            execution_params["source_database"] = _serialize_value(
                getattr(con, "SNOWFLAKE_SOURCE_DATABASE", None)
            )
            execution_params["dest_database"] = _serialize_value(
                getattr(con, "SNOWFLAKE_DEST_DATABASE", None)
            )
        elif "DuckDB" in connector_type or hasattr(con, "DUCKDB_SOURCE_DATABASE"):
            execution_params["source_database"] = _serialize_value(
                getattr(con, "DUCKDB_SOURCE_DATABASE", None)
            )
            execution_params["dest_database"] = _serialize_value(
                getattr(con, "DUCKDB_DEST_DATABASE", None)
            )
        else:
            # For mocks and unknown types, try to get any database attributes
            execution_params["source_database"] = _serialize_value(
                getattr(
                    con,
                    "DUCKDB_SOURCE_DATABASE",
                    getattr(con, "SNOWFLAKE_SOURCE_DATABASE", None),
                )
            )
            execution_params["dest_database"] = _serialize_value(
                getattr(
                    con,
                    "DUCKDB_DEST_DATABASE",
                    getattr(con, "SNOWFLAKE_DEST_DATABASE", None),
                )
            )

        return execution_params
