from typing import Optional
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


def ibis_snowflake_connect(
    SNOWFLAKE_USER: Optional[str] = None,
    SNOWFLAKE_ACCOUNT: Optional[str] = None,
    SNOWFLAKE_WAREHOUSE: Optional[str] = None,
    SNOWFLAKE_DATABASE: Optional[str] = None,
    SNOWFLAKE_SCHEMA: Optional[str] = None,
    SNOWFLAKE_ROLE: Optional[str] = None,
    SNOWFLAKE_PASSWORD: Optional[str] = None,
) -> BaseBackend:
    """
    Establish a connection to Snowflake using Ibis. Variables for the connection can
    be passed either via this function call or as environment variables of the same name.
    All arguments are required to be specified by one of these two methods except
    SNOWFLAKE_PASSWORD.


    Args:
        SNOWFLAKE_USER: Snowflake user name.
        SNOWFLAKE_ACCOUNT: Snowflake account identifier.
        SNOWFLAKE_WAREHOUSE: Snowflake warehouse name.
        SNOWFLAKE_DATABASE: Snowflake database name.
        SNOWFLAKE_SCHEMA : Snowflake schema name.
        SNOWFLAKE_ROLE: Snowflake role name.
        SNOWFLAKE_PASSWORD: Snowflake password. If not specified, will attempt to authenticate with externalbrowser.

    Returns:
        BaseBackend: An Ibis backend connection to Snowflake.
    """
    required_vars = [
        "SNOWFLAKE_USER",
        "SNOWFLAKE_ACCOUNT",
        "SNOWFLAKE_WAREHOUSE",
        "SNOWFLAKE_DATABASE",
        "SNOWFLAKE_SCHEMA",
        "SNOWFLAKE_ROLE",
    ]
    _check_env_vars(*required_vars)
    if "SNOWFLAKE_PASSWORD" in os.environ:
        return ibis.snowflake.connect(
            user=os.getenv("SNOWFLAKE_USER", SNOWFLAKE_USER),
            password=os.getenv("SNOWFLAKE_PASSWORD", SNOWFLAKE_PASSWORD),
            account=os.getenv("SNOWFLAKE_ACCOUNT", SNOWFLAKE_ACCOUNT),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", SNOWFLAKE_WAREHOUSE),
            database=os.getenv("SNOWFLAKE_DATABASE", SNOWFLAKE_DATABASE),
            role=os.getenv("SNOWFLAKE_ROLE", SNOWFLAKE_ROLE),
            schema=os.getenv("SNOWFLAKE_SCHEMA", SNOWFLAKE_SCHEMA),
        )
    else:
        return ibis.snowflake.connect(
            user=os.getenv("SNOWFLAKE_USER", SNOWFLAKE_USER),
            authenticator="externalbrowser",
            account=os.getenv("SNOWFLAKE_ACCOUNT", SNOWFLAKE_ACCOUNT),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", SNOWFLAKE_WAREHOUSE),
            database=os.getenv("SNOWFLAKE_DATABASE", SNOWFLAKE_DATABASE),
            role=os.getenv("SNOWFLAKE_ROLE", SNOWFLAKE_ROLE),
            schema=os.getenv("SNOWFLAKE_SCHEMA", SNOWFLAKE_SCHEMA),
        )


# DuckDB connection function
def ibis_duckdb_connect(DUCKDB_PATH: Optional[str] = ":memory") -> BaseBackend:
    """
    Establish a connection to DuckDB using Ibis. Variables for the connection can
    be passed either via this function call or as environment variables of the same name.

    Returns:
        BaseBackend: An Ibis backend connection to DuckDB.
    """
    required_vars = ["DUCKDB_PATH"]
    _check_env_vars(*required_vars)

    return ibis.connect(backend="duckdb", path=os.getenv("DUCKDB_PATH", DUCKDB_PATH))
