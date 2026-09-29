from typing import Callable, Dict, Optional
from ibis.expr.types.relations import Table
import ibis

from phenex.node import DerivedTable
from phenex.tables import PhenexTable
from phenex.util import create_logger
from phenex.util.serialization.function_serialization import (
    serialize_function,
    deserialize_function,
)

logger = create_logger(__name__)


class LoadTable(DerivedTable):
    """
    LoadTable loads an arbitrary named table and registers it as a new domain, without
    depending on any other domain table.

    This is useful for pulling in a table that lives outside the mapped OMOP source schema,
    for example a study-specific table that only exists in the destination database. Rather
    than opening a new connection, LoadTable borrows the ibis backend connection already used
    by an existing domain table (from `tables`). This keeps the loaded table on the same
    backend as the rest of the domains, so it can be joined against them lazily -- nothing is
    materialized -- without ibis raising a "Multiple backends found for this expression" error,
    which happens when tables from two different ibis connections (e.g. a source connection and
    a destination connection) are combined in a single expression.

    Parameters:
        name: The name under which the loaded table is registered in the domains dict.
        table_name: Name of the table to load from the backend.
        database: Fully-qualified `DATABASE.SCHEMA` to look up `table_name` in. If omitted,
                  the table is looked up in the backend's current database.
        function: Optional callable applied to the loaded table, e.g. to rename/select
                  columns or apply a filter. Receives the loaded table and must return a table.
        function_string: The source code of `function` as a string. Used when deserializing
                  a LoadTable; generally not passed directly by users.

    Examples:

    Example: Loading a table from a different database on the same backend
        ```python
        from phenex.derived_tables import LoadTable

        lvef_table = LoadTable(
            name="LVEF_ALL_PATIENTS",
            table_name="LVEF_ALL_PATIENTS",
            database=SNOWFLAKE_DEST_DATABASE,
        )
        ```
    """

    def __init__(
        self,
        table_name: str,
        name: Optional[str] = None,
        database: Optional[str] = None,
        function: Optional[Callable[[Table], Table]] = None,
        function_string: Optional[str] = None,
        **kwargs,
    ):
        if function is not None:
            function_string = serialize_function(function)
        elif function_string is not None:
            function = deserialize_function(function_string)

        self.table_name = table_name
        self.database = database
        self.function = function
        self.function_string = function_string
        super(LoadTable, self).__init__(
            name=name if name is not None else self.table_name, **kwargs
        )

    def to_dict(self):
        _dict = super().to_dict()
        # The raw callable is not serializable; persist the source string instead.
        _dict.pop("function", None)
        _dict["function_string"] = self.function_string
        return _dict

    def _execute(self, tables: Dict[str, Table]) -> Table:
        backend = self._borrow_backend(tables)
        logger.info(
            f"LoadTable '{self.name}': loading table '{self.table_name}'"
            + (f" from database '{self.database}'" if self.database else "")
        )
        table = backend.table(self.table_name, database=self.database)
        if self.function is not None:
            table = self.function(table)
        return table

    def _borrow_backend(self, tables: Dict[str, Table]):
        """
        Reuse the ibis backend connection of an already-loaded domain table instead of opening
        a new one, so `table_name` can later be joined lazily against the other domains without
        triggering ibis's multi-backend error.
        """
        for table in tables.values():
            if table is None:
                continue
            expr = table.table if isinstance(table, PhenexTable) else table
            try:
                return ibis.get_backend(expr)
            except Exception:
                continue
        raise ValueError(
            f"LoadTable '{self.name}': no existing domain table found in `tables` to borrow "
            "an ibis backend connection from."
        )
