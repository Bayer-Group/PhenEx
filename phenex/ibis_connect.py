import os
import ibis
from ibis.backends import BaseBackend


# Snowflake connection function
def check_env_vars(*vars):
    missing_vars = [var for var in vars if os.getenv(var) is None]
    if missing_vars:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing_vars)}. Add to .env file or set in the environment."
        )


def ibis_snowflake_connect() -> BaseBackend:
    required_vars = [
        "SNOWFLAKE_USER",
        "SNOWFLAKE_ACCOUNT",
        "SNOWFLAKE_WAREHOUSE",
        "SNOWFLAKE_DATABASE",
        "SNOWFLAKE_SCHEMA",
        "SNOWFLAKE_ROLE",
    ]
    check_env_vars(*required_vars)
    if "SNOWFLAKE_PASSWORD" in os.environ:
        return ibis.snowflake.connect(
            user=os.getenv("SNOWFLAKE_USER"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=os.getenv("SNOWFLAKE_ACCOUNT"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            database=os.getenv("SNOWFLAKE_DATABASE"),
            role=os.getenv("SNOWFLAKE_ROLE"),
            schema=os.getenv("SNOWFLAKE_SCHEMA"),
        )
    else:
        return ibis.snowflake.connect(
            user=os.getenv("SNOWFLAKE_USER"),
            authenticator="externalbrowser",
            account=os.getenv("SNOWFLAKE_ACCOUNT"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            database=os.getenv("SNOWFLAKE_DATABASE"),
            role=os.getenv("SNOWFLAKE_ROLE"),
            schema=os.getenv("SNOWFLAKE_SCHEMA"),
        )


# DuckDB connection function
def ibis_duckdb_connect() -> BaseBackend:
    required_vars = ["DUCKDB_PATH"]
    check_env_vars(*required_vars)

    return ibis.connect(backend="duckdb", path=os.getenv("DUCKDB_PATH", ":memory:"))
