"""
Inspect the PhenEx metadata database (phenex.db).

Provides read-only queries for exploring the node execution history stored
by the lazy-execution system.  Useful for debugging cache behaviour,
understanding what was last executed, and finding nodes by name.

Usage::

    from phenex.util.inspect_phenex_db import PhenexDBInspector

    db = PhenexDBInspector()           # uses default "phenex.db"
    db = PhenexDBInspector("other.db") # or a custom path

    db.list_nodes()                    # all node names
    db.list_cohorts()                  # cohort-level node groups
    db.search("table1")               # nodes whose name contains "table1"
    db.get_node("MY_COHORT__TABLE1")   # full metadata row(s)
    db.get_nodes_for_cohort("MY_COHORT")  # all nodes prefixed with cohort name
    db.summary()                       # quick overview printed to stdout
"""

import json
from typing import List, Optional

import pandas as pd

from phenex.ibis_connect import DuckDBConnector

NODE_STATES_TABLE_NAME = "__PHENEX_META__NODE_STATES"


class PhenexDBInspector:
    """Read-only inspector for the PhenEx lazy-execution metadata database."""

    def __init__(self, db_path: str = "phenex.db"):
        self.db_path = db_path

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _load(self) -> pd.DataFrame:
        """Load the full node-states table into a DataFrame."""
        con = DuckDBConnector(DUCKDB_DEST_DATABASE=self.db_path)
        if NODE_STATES_TABLE_NAME not in con.dest_connection.list_tables():
            return pd.DataFrame(
                columns=[
                    "EXECUTION_ID",
                    "NODE_NAME",
                    "NODE_HASH",
                    "NODE_PARAMS",
                    "EXECUTION_PARAMS",
                    "EXECUTION_START_TIME",
                    "EXECUTION_END_TIME",
                    "EXECUTION_DURATION",
                ]
            )
        return con.get_dest_table(NODE_STATES_TABLE_NAME).to_pandas()

    # ------------------------------------------------------------------
    # Node listing
    # ------------------------------------------------------------------

    def list_nodes(self) -> List[str]:
        """Return a sorted list of all unique node names."""
        df = self._load()
        return sorted(df["NODE_NAME"].unique().tolist())

    def list_cohorts(self) -> List[str]:
        """
        Return probable cohort names.

        Cohort nodes follow the naming convention ``COHORT__INDEX``.  This
        method extracts the prefix before ``__INDEX`` for every node whose
        name ends with that suffix.
        """
        names = self.list_nodes()
        cohorts = set()
        for name in names:
            if name.endswith("__INDEX"):
                cohorts.add(name.rsplit("__INDEX", 1)[0])
        return sorted(cohorts)

    # ------------------------------------------------------------------
    # Search / lookup
    # ------------------------------------------------------------------

    def search(self, pattern: str) -> pd.DataFrame:
        """
        Search for nodes whose name contains *pattern* (case-insensitive).

        Returns a DataFrame with one row per matching node showing name,
        hash, duration, and last execution time.
        """
        df = self._load()
        if df.empty:
            return df
        mask = df["NODE_NAME"].str.contains(pattern, case=False, na=False)
        cols = [
            "NODE_NAME",
            "NODE_HASH",
            "EXECUTION_DURATION",
            "EXECUTION_START_TIME",
        ]
        return df.loc[mask, cols].sort_values("NODE_NAME").reset_index(drop=True)

    def get_node(self, node_name: str) -> pd.DataFrame:
        """Return all metadata rows for an exact node name (case-insensitive)."""
        df = self._load()
        if df.empty:
            return df
        mask = df["NODE_NAME"].str.upper() == node_name.upper()
        return df.loc[mask].reset_index(drop=True)

    def get_node_params(self, node_name: str) -> Optional[dict]:
        """Return the parsed NODE_PARAMS dict for a node, or None if not found."""
        row = self.get_node(node_name)
        if row.empty:
            return None
        params_json = row.iloc[0]["NODE_PARAMS"]
        if params_json and isinstance(params_json, str):
            return json.loads(params_json)
        return None

    def get_nodes_for_cohort(self, cohort_name: str) -> pd.DataFrame:
        """
        Return all nodes belonging to a cohort.

        Matches nodes whose name starts with ``COHORT_NAME__`` or equals
        ``COHORT_NAME`` exactly.
        """
        df = self._load()
        if df.empty:
            return df
        prefix = cohort_name.upper() + "__"
        mask = df["NODE_NAME"].str.startswith(prefix) | (
            df["NODE_NAME"] == cohort_name.upper()
        )
        cols = [
            "NODE_NAME",
            "NODE_HASH",
            "EXECUTION_DURATION",
            "EXECUTION_START_TIME",
        ]
        return df.loc[mask, cols].sort_values("NODE_NAME").reset_index(drop=True)

    # ------------------------------------------------------------------
    # Aggregated views
    # ------------------------------------------------------------------

    def summary(self) -> pd.DataFrame:
        """
        Print and return a summary table: one row per node with name, hash,
        duration, and last execution time.
        """
        df = self._load()
        if df.empty:
            print("phenex.db is empty — no nodes have been executed yet.")
            return df
        cols = [
            "NODE_NAME",
            "NODE_HASH",
            "EXECUTION_DURATION",
            "EXECUTION_START_TIME",
            "EXECUTION_PARAMS",
        ]
        out = df[cols].sort_values("NODE_NAME").reset_index(drop=True)
        print(out.to_string(index=False))
        return out

    def slowest(self, n: int = 10) -> pd.DataFrame:
        """Return the *n* slowest nodes by execution duration."""
        df = self._load()
        if df.empty:
            return df
        cols = ["NODE_NAME", "EXECUTION_DURATION", "EXECUTION_START_TIME"]
        return (
            df[cols]
            .sort_values("EXECUTION_DURATION", ascending=False)
            .head(n)
            .reset_index(drop=True)
        )

    def execution_context(self) -> List[dict]:
        """Return the distinct execution contexts stored in the database."""
        df = self._load()
        if df.empty:
            return []
        raw = df["EXECUTION_PARAMS"].dropna().unique().tolist()
        return [json.loads(r) for r in raw]
