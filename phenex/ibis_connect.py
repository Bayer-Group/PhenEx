from typing import Optional, List
import os
import ibis
from ibis.backends import BaseBackend


# Snowflake connection function
def _check_env_vars(*vars: str) -> None:
    """
    Check if the required environment variables are set.

    Args:
        *vars: Variable length argument list of environment variable names.

    Raises:
        EnvironmentError: If any of the required environment variables are missing.
    """
    missing_vars = [var for var in vars if os.getenv(var) is None]
    if missing_vars:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing_vars)}. Add to .env file or set in the environment."
        )


class SnowflakeConnector:
    """
    SnowflakeConnector manages input (read) and output (write) connections to Snowflake using Ibis. Parameters may be specified with environment variables of the same name or through the __init__() method interface. Variables passed through __init__() take precedence.

    Attributes:
        SNOWFLAKE_USER: Snowflake user name.
        SNOWFLAKE_ACCOUNT: Snowflake account identifier.
        SNOWFLAKE_WAREHOUSE: Snowflake warehouse name.
        SNOWFLAKE_ROLE: Snowflake role name.
        SNOWFLAKE_PASSWORD: Snowflake password. If not specified, will attempt to authenticate with externalbrowser.
        SNOWFLAKE_SOURCE_DATABASE: Snowflake source database name. Use a fully qualified database name (in snowflake terminology DATABASE.SCHEMA; ibis calls this a "database").
        SNOWFLAKE_DEST_DATABASE: Snowflake destination database name. Use a fully qualified database name (in snowflake terminology DATABASE.SCHEMA; ibis calls this a "database").

    Methods:
        connect_dest() -> BaseBackend:
            Establishes and returns an Ibis backend connection to the destination Snowflake database and schema.

        connect_source() -> BaseBackend:
            Establishes and returns an Ibis backend connection to the source Snowflake database and schema.

        get_source_table(name_table: str) -> Table:
            Retrieves a table from the source Snowflake database.

        get_dest_table(name_table: str) -> Table:
            Retrieves a table from the destination Snowflake database.

        create_view(table: Table, name_table: Optional[str] = None, overwrite: bool = False) -> View:
            Create a view of a table in the destination Snowflake database.

        create_table(table: Table, name_table: Optional[str] = None, overwrite: bool = False) -> Table:
            Materialize a table in the destination Snowflake database.

        drop_table(name_table: str) -> None:
            Drop a table from the destination Snowflake database.

        drop_view(name_table: str) -> None:
            Drop a view from the destination Snowflake database.
    """

    def __init__(
        self,
        SNOWFLAKE_USER: Optional[str] = None,
        SNOWFLAKE_ACCOUNT: Optional[str] = None,
        SNOWFLAKE_WAREHOUSE: Optional[str] = None,
        SNOWFLAKE_ROLE: Optional[str] = None,
        SNOWFLAKE_PASSWORD: Optional[str] = None,
        SNOWFLAKE_SOURCE_DATABASE: Optional[str] = None,
        SNOWFLAKE_DEST_DATABASE: Optional[str] = None,
    ):
        self.SNOWFLAKE_USER = SNOWFLAKE_USER or os.environ.get("SNOWFLAKE_USER")
        self.SNOWFLAKE_ACCOUNT = SNOWFLAKE_ACCOUNT or os.environ.get(
            "SNOWFLAKE_ACCOUNT"
        )
        self.SNOWFLAKE_WAREHOUSE = SNOWFLAKE_WAREHOUSE or os.environ.get(
            "SNOWFLAKE_WAREHOUSE"
        )
        self.SNOWFLAKE_ROLE = SNOWFLAKE_ROLE or os.environ.get("SNOWFLAKE_ROLE")
        self.SNOWFLAKE_PASSWORD = SNOWFLAKE_PASSWORD or os.environ.get(
            "SNOWFLAKE_PASSWORD"
        )
        self.SNOWFLAKE_SOURCE_DATABASE = SNOWFLAKE_SOURCE_DATABASE or os.environ.get(
            "SNOWFLAKE_SOURCE_DATABASE"
        )
        self.SNOWFLAKE_DEST_DATABASE = SNOWFLAKE_DEST_DATABASE or os.environ.get(
            "SNOWFLAKE_DEST_DATABASE"
        )

        try:
            _, _ = self.SNOWFLAKE_SOURCE_DATABASE.split(".")
        except:
            raise ValueError(
                "Use a fully qualified database name (e.g. CATALOG.DATABASE)."
            )
        if self.SNOWFLAKE_DEST_DATABASE:
            try:
                _, _ = self.SNOWFLAKE_DEST_DATABASE.split(".")
            except:
                raise ValueError(
                    "Use a fully qualified database name (e.g. CATALOG.DATABASE)."
                )

        required_vars = [
            "SNOWFLAKE_USER",
            "SNOWFLAKE_ACCOUNT",
            "SNOWFLAKE_WAREHOUSE",
            "SNOWFLAKE_ROLE",
            "SNOWFLAKE_SOURCE_DATABASE",
        ]
        self._check_env_vars(required_vars)
        self._check_source_dest()
        self.source_connection = self.dest_connection = self.connect_source()

    def _check_env_vars(self, required_vars: List[str]):
        for var in required_vars:
            if not getattr(self, var):
                raise ValueError(
                    f"Missing required variable: {var}. Set in the environment or pass through __init__()."
                )

    def _check_source_dest(self):
        if self.SNOWFLAKE_DEST_DATABASE and (
            self.SNOWFLAKE_SOURCE_DATABASE == self.SNOWFLAKE_DEST_DATABASE
            and self.SNOWFLAKE_SOURCE_SCHEMA == self.SNOWFLAKE_DEST_SCHEMA
        ):
            raise ValueError("Source and destination locations cannot be the same.")

    def _connect(self, database) -> BaseBackend:
        """
        Private method to get a database connection. End users should use connect_source() and connect_dest() to get connections to source and destination databases.
        """
        database, schema = database.split(".")
        #
        # In Ibis speak: catalog = collection of databases
        #                database = collection of tables
        #                schema = columns and column types
        # In snowflake speak: database = collection of schemas = ibis catalog
        #                schema = collection of tables = ibis database
        #
        # In the below connect method, the arguments are the SNOWFLAKE terms.
        #

        if self.SNOWFLAKE_PASSWORD:
            return ibis.snowflake.connect(
                user=self.SNOWFLAKE_USER,
                password=self.SNOWFLAKE_PASSWORD,
                account=self.SNOWFLAKE_ACCOUNT,
                warehouse=self.SNOWFLAKE_WAREHOUSE,
                role=self.SNOWFLAKE_ROLE,
                database=database,
                schema=schema,
            )
        else:
            return ibis.snowflake.connect(
                user=self.SNOWFLAKE_USER,
                authenticator="externalbrowser",
                account=self.SNOWFLAKE_ACCOUNT,
                warehouse=self.SNOWFLAKE_WAREHOUSE,
                role=self.SNOWFLAKE_ROLE,
                database=database,
                schema=schema,
            )

    def connect_dest(self) -> BaseBackend:
        """
        Establishes and returns an Ibis backend connection to the destination Snowflake database.

        Returns:
            BaseBackend: Ibis backend connection to the destination Snowflake database.
        """
        return self._connect(
            database=self.SNOWFLAKE_DEST_DATABASE,
        )

    def connect_source(self) -> BaseBackend:
        """
        Establishes and returns an Ibis backend connection to the source Snowflake database.

        Returns:
            BaseBackend: Ibis backend connection to the source Snowflake database.
        """
        return self._connect(
            database=self.SNOWFLAKE_SOURCE_DATABASE,
        )

    def get_source_table(self, name_table):
        """
        Retrieves a table from the source Snowflake database.

        Args:
            name_table (str): Name of the table to retrieve.

        Returns:
            Table: Ibis table object from the source Snowflake database.
        """
        return self.source_connection.table(
            name_table, database=self.SNOWFLAKE_SOURCE_DATABASE
        )

    def get_dest_table(self, name_table):
        """
        Retrieves a table from the destination Snowflake database.

        Args:
            name_table (str): Name of the table to retrieve.

        Returns:
            Table: Ibis table object from the destination Snowflake database.
        """
        if self.SNOWFLAKE_DEST_DATABASE is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")
        return self.dest_connection.table(
            name_table, database=self.SNOWFLAKE_DEST_DATABASE
        )

    def _get_output_table_name(self, table):
        if table.has_name:
            name_table = table.get_name().split(".")[-1]
        else:
            raise ValueError("Must specify name_table!")
        return name_table

    def create_view(self, table, name_table=None, overwrite=False):
        """
        Create a view of a table in the destination Snowflake database.

        Args:
            table (Table): Ibis table object to create a view from.
            name_table (str, optional): Name of the view to create. Defaults to None.
            overwrite (bool, optional): Whether to overwrite the view if it exists. Defaults to False.

        Returns:
            View: Ibis view object created in the destination Snowflake database.
        """
        if self.SNOWFLAKE_DEST_DATABASE is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")
        name_table = name_table or self._get_output_table_name(table)

        # Check if the destination database exists, if not, create it
        catalog, database = self.SNOWFLAKE_DEST_DATABASE.split(".")
        if not database in self.dest_connection.list_databases(catalog=catalog):
            self.dest_connection.create_database(name=database, catalog=catalog)

        return self.dest_connection.create_view(
            name=name_table.upper(),
            database=self.SNOWFLAKE_DEST_DATABASE,
            obj=table,
            overwrite=overwrite,
            schema=table.schema(),
        )

    def create_table(self, table, name_table=None, overwrite=False, comment=None):
        """
        Materialize a table in the destination Snowflake database.

        Args:
            table: Ibis table object to materialize.
            name_table (str, optional): Name of the table to create. Defaults to None.
            overwrite: Whether to overwrite the table if it exists. Defaults to False.
            comment: Add a comment about the table.

        Returns:
            Table: Ibis table object created in the destination Snowflake database.
        """
        if self.SNOWFLAKE_DEST_DATABASE is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")

        name_table = name_table or self._get_output_table_name(table)

        # Check if the destination database exists, if not, create it
        catalog, database = self.SNOWFLAKE_DEST_DATABASE.split(".")
        if not database in self.dest_connection.list_databases(catalog=catalog):
            self.dest_connection.create_database(name=database, catalog=catalog)

        return self.dest_connection.create_table(
            name=name_table.upper(),
            database=self.SNOWFLAKE_DEST_DATABASE,
            obj=table,
            overwrite=overwrite,
            schema=table.schema(),
            comment=comment,
        )

    def drop_table(self, name_table):
        """
        Drop a table from the destination Snowflake database.

        Args:
            name_table (str): Name of the table to drop.

        Returns:
            None
        """
        if self.SNOWFLAKE_DEST_DATABASE is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")
        return self.dest_connection.drop_table(
            name=name_table, database=self.SNOWFLAKE_DEST_DATABASE
        )

    def drop_view(self, name_table):
        """
        Drop a view from the destination Snowflake database.

        Args:
            name_table (str): Name of the view to drop.

        Returns:
            None
        """
        if self.SNOWFLAKE_DEST_DATABASE is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")
        return self.dest_connection.drop_view(
            name=name_table, database=self.SNOWFLAKE_DEST_DATABASE
        )


class DuckDBConnector:
    """
    DuckDBConnector manages connections to DuckDB using Ibis.

    Attributes:
        DUCKDB_SOURCE_DATABASE: Source DuckDB database name.
        DUCKDB_DEST_DATABASE: Destination DuckDB database name. If not specified, defaults to an in-memory database.

    Methods:
        connect_source() -> BaseBackend:
            Establishes and returns an Ibis backend connection to the source DuckDB database.

        connect_dest() -> BaseBackend:
            Establishes and returns an Ibis backend connection to the destination DuckDB database.

        get_source_table(name_table: str):
            Retrieves a table from the source DuckDB database.

        get_dest_table(name_table: str):
            Retrieves a table from the destination DuckDB database.

        create_view(table, name_table: Optional[str] = None, overwrite: bool = False):
            Create a view of a table in the destination DuckDB database.

        create_table(table, name_table: Optional[str] = None, overwrite: bool = False):
            Materialize a table in the destination DuckDB database.

        drop_table(name_table: str):
            Drop a table from the destination DuckDB database.

        drop_view(name_table: str):
            Drop a view from the destination DuckDB database.

    Example:
        ```python
        # Initialize the DuckDBConnector with a source duckdb database file with path "file.duckdb" and in-memory destination database.
        con = DuckDBConnector(DUCKDB_SOURCE_DATABASE="file.duckdb")
        ```

    Example:
        ```python
        # Initialize the DuckDBConnector with a source duckdb database file with path "source_file.duckdb" and a destination duckdb database with path "destination_file.duckdb".
        con = DuckDBConnector(
            DUCKDB_SOURCE_DATABASE="source_file.duckdb"
            DUCKDB_DEST_DATABASE="destination_file.duckdb"
        )
        ```
    """

    def __init__(
        self,
        DUCKDB_SOURCE_DATABASE: Optional[str] = None,
        DUCKDB_DEST_DATABASE: Optional[str] = None,
    ):
        """
        Initializes the DuckDBConnector with the specified path.

        Args:
            DUCKDB_SOURCE_DATABASE (str, optional): Path to the source DuckDB database.
            DUCKDB_DEST_DATABASE (str, optional): Path to the destination DuckDB database. If not specified, defaults to an in-memory database.
        """
        self.DUCKDB_SOURCE_DATABASE = DUCKDB_SOURCE_DATABASE or os.environ.get(
            "DUCKDB_SOURCE_DATABASE"
        )
        self.DUCKDB_DEST_DATABASE = (
            DUCKDB_DEST_DATABASE or os.environ.get("DUCKDB_DEST_DATABASE") or ":memory:"
        )
        required_vars = []
        self._check_env_vars(required_vars)
        if self.DUCKDB_SOURCE_DATABASE:
            self.source_connection = self.connect_source()
        else:
            self.source_connection = None
        if self.DUCKDB_DEST_DATABASE:
            self.dest_connection = self.connect_dest()
        else:
            self.dest_connection = None

    def _check_env_vars(self, required_vars: List[str]):
        for var in required_vars:
            if not getattr(self, var):
                raise ValueError(
                    f"Missing required variable: {var}. Set in the environment or pass through __init__()."
                )

    def connect_source(self) -> BaseBackend:
        """
        Establishes and returns an Ibis backend connection to the source DuckDB database.

        Returns:
            BaseBackend: Ibis backend connection to the  DuckDB database.
        """
        try:
            return ibis.duckdb.connect(self.DUCKDB_SOURCE_DATABASE)
        except Exception as e:
            print(f"An error occurred: {e}")
            raise

    def connect_dest(self) -> BaseBackend:
        """
        Establishes and returns an Ibis backend connection to the destination DuckDB database.

        Returns:
            BaseBackend: Ibis backend connection to the destination DuckDB database.
        """
        if self.DUCKDB_DEST_DATABASE is None:
            raise ValueError("Must specify DUCKDB_DEST_DATABASE")
        try:
            return ibis.duckdb.connect(self.DUCKDB_DEST_DATABASE)
        except Exception as e:
            print(f"An error occurred: {e}")
            raise

    def get_source_table(self, name_table: str):
        """
        Retrieves a table from the source DuckDB database.

        Args:
            name_table (str): Name of the table to retrieve.

        Returns:
            Table: Ibis table object from the source DuckDB database.
        """
        return self.source_connection.table(name_table)

    def get_dest_table(self, name_table: str):
        """
        Retrieves a table from the destination DuckDB database.

        Args:
            name_table (str): Name of the table to retrieve.

        Returns:
            Table: Ibis table object from the destination DuckDB database.
        """
        if self.dest_connection is None:
            raise ValueError("Must specify DUCKDB_DEST_DATABASE!")
        return self.dest_connection.table(name_table)

    def create_view(self, table, name_table=None, overwrite=False):
        """
        Create a view of a table in the destination DuckDB database.

        Args:
            table (Table): Ibis table object to create a view from.
            name_table (str, optional): Name of the view to create. Defaults to None.
            overwrite (bool, optional): Whether to overwrite the view if it exists. Defaults to False.

        Returns:
            View: Ibis view object created in the destination DuckDB database.
        """
        if self.dest_connection is None:
            raise ValueError("Must specify DUCKDB_DEST_DATABASE!")

        if not name_table:
            if hasattr(table, "get_name") and table.get_name():
                name_table = table.get_name()
            else:
                raise ValueError(
                    "name_table must be provided if the table doesn't have a name."
                )

        try:
            return self.dest_connection.create_view(
                name=name_table, obj=table, overwrite=overwrite
            )
        except AttributeError as e:
            print(f"Error creating view: {e}")
            raise

    def create_table(self, table, name_table=None, overwrite=False):
        """
        Materialize a table in the destination DuckDB database.

        Args:
            table (Table): Ibis table object to materialize.
            name_table (str, optional): Name of the table to create. Defaults to None.
            overwrite (bool, optional): Whether to overwrite the table if it exists. Defaults to False.

        Returns:
            Table: Ibis table object created in the destination DuckDB database.
        """
        if self.dest_connection is None:
            raise ValueError("Must specify DUCKDB_DEST_DATABASE!")
        if not name_table:
            if hasattr(table, "get_name") and table.get_name():
                name_table = table.get_name()
            else:
                raise ValueError(
                    "name_table must be provided if the table doesn't have a name."
                )
        return self.dest_connection.create_table(
            name=name_table, obj=table, overwrite=overwrite
        )

    def drop_table(self, name_table):
        """
        Drop a table from the destination DuckDB database.

        Args:
            name_table (str): Name of the table to drop.

        Returns:
            None
        """
        if self.dest_connection is None:
            raise ValueError("Must specify DUCKDB_DEST_DATABASE!")
        self.dest_connection.drop_table(name_table)

    def drop_view(self, name_table):
        """
        Drop a view from the destination DuckDB database.

        Args:
            name_table (str): Name of the view to drop.

        Returns:
            None
        """
        if self.dest_connection is None:
            raise ValueError("Must specify DUCKDB_DEST_DATABASE!")
        self.dest_connection.drop_view(name_table)
