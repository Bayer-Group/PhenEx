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
        SNOWFLAKE_DATABASE: Snowflake database name.
        SNOWFLAKE_SCHEMA: Snowflake schema name.
        SNOWFLAKE_ROLE: Snowflake role name.
        SNOWFLAKE_PASSWORD: Snowflake password. If not specified, will attempt to authenticate with externalbrowser.
        SNOWFLAKE_SOURCE_DATABASE: Snowflake source database name. Use a fully qualified database name (e.g. CATALOG.DATABASE).
        SNOWFLAKE_DEST_DATABASE: Snowflake destination database name. Use a fully qualified database name (e.g. CATALOG.DATABASE).

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
        self.source_connection = self.connect_source()
        if self.SNOWFLAKE_DEST_DATABASE:
            self.dest_connection = self.connect_dest()
        else:
            self.dest_connection = None

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
        if self.dest_connection is None:
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
        if self.dest_connection is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")
        name_table = name_table or self._get_output_table_name(table)

        # Check if the destination database exists, if not, create it
        catalog, database = self.SNOWFLAKE_DEST_DATABASE.split(".")
        if not database in self.dest_connection.list_databases():
            self.dest_connection.create_database(name=database, catalog=catalog)

        return self.dest_connection.create_view(
            name=name_table, database=database, obj=table, overwrite=overwrite
        )

    def create_table(self, table, name_table=None, overwrite=False):
        """
        Materialize a table in the destination Snowflake database.

        Args:
            table (Table): Ibis table object to materialize.
            name_table (str, optional): Name of the table to create. Defaults to None.
            overwrite (bool, optional): Whether to overwrite the table if it exists. Defaults to False.

        Returns:
            Table: Ibis table object created in the destination Snowflake database.
        """
        if self.dest_connection is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")

        name_table = name_table or self._get_output_table_name(table)

        # Check if the destination database exists, if not, create it
        catalog, database = self.SNOWFLAKE_DEST_DATABASE.split(".")
        if not database in self.dest_connection.list_databases():
            self.dest_connection.create_database(name=database, catalog=catalog)

        return self.dest_connection.create_table(
            name=name_table, database=database, obj=table, overwrite=overwrite
        )

    def drop_table(self, name_table):
        """
        Drop a table from the destination Snowflake database.

        Args:
            name_table (str): Name of the table to drop.

        Returns:
            None
        """
        if self.dest_connection is None:
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
        if self.dest_connection is None:
            raise ValueError("Must specify SNOWFLAKE_DEST_DATABASE!")
        return self.dest_connection.drop_view(
            name=name_table, database=self.SNOWFLAKE_DEST_DATABASE
        )


class DuckDBConnector:
    """
    DuckDBConnector manages connections to DuckDB using Ibis.

    Attributes:
        DUCKDB_PATH: Path to the DuckDB database file.

    Methods:
        connect() -> BaseBackend:
            Establishes and returns an Ibis backend connection to the DuckDB database.
    """

    def __init__(self, DUCKDB_PATH: Optional[str] = ":memory"):
        """
        Initializes the DuckDBConnector with the specified path.

        Args:
            DUCKDB_PATH (str, optional): Path to the DuckDB database file. Defaults to ":memory".
        """
        self.DUCKDB_PATH = DUCKDB_PATH

    def connect(self) -> BaseBackend:
        """
        Establishes and returns an Ibis backend connection to the DuckDB database.

        Returns:
            BaseBackend: Ibis backend connection to the DuckDB database.
        """
        required_vars = ["DUCKDB_PATH"]
        _check_env_vars(*required_vars)
        return ibis.connect(
            backend="duckdb", path=self.DUCKDB_PATH or os.getenv("DUCKDB_PATH")
        )
