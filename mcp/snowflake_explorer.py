"""
Snowflake data warehouse exploration utilities.
"""

import os
import re
from typing import Dict, List, Any, Optional


def _sanitize_pattern(pattern: str) -> str:
    """
    Sanitize a SQL LIKE pattern to prevent SQL injection.

    Args:
        pattern: The pattern to sanitize

    Returns:
        Sanitized pattern safe for SQL LIKE clause
    """
    if not pattern:
        return pattern

    sanitized = pattern.replace("'", "''")

    if not re.match(r"^[a-zA-Z0-9_%\s\-\.\*]+$", sanitized.replace("''", "'")):
        raise ValueError("Invalid pattern: contains potentially unsafe characters")

    return sanitized


def _sanitize_where(where: str) -> str:
    """
    Sanitize a WHERE clause to prevent SQL injection.

    Args:
        where: The WHERE clause to sanitize (without 'WHERE' keyword)

    Returns:
        Sanitized WHERE clause

    Raises:
        ValueError: If the WHERE clause contains dangerous SQL patterns
    """
    if not where:
        return where

    if ";" in where:
        raise ValueError("WHERE clause cannot contain semicolons")

    if "--" in where or "/*" in where or "*/" in where:
        raise ValueError("WHERE clause cannot contain SQL comments")

    dangerous_keywords = [
        "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE",
        "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "EXEC",
    ]
    where_upper = where.upper()
    for keyword in dangerous_keywords:
        if f" {keyword} " in f" {where_upper} ":
            raise ValueError(f"WHERE clause cannot contain {keyword} statement")

    return where


def _get_connection():
    """
    Create a Snowflake connection using environment variables.

    Required environment variables:
    - SNOWFLAKE_USER
    - SNOWFLAKE_PASSWORD
    - SNOWFLAKE_ACCOUNT
    - SNOWFLAKE_WAREHOUSE
    - SNOWFLAKE_ROLE
    """
    import snowflake.connector

    required_vars = [
        "SNOWFLAKE_USER",
        "SNOWFLAKE_PASSWORD",
        "SNOWFLAKE_ACCOUNT",
        "SNOWFLAKE_WAREHOUSE",
        "SNOWFLAKE_ROLE",
    ]

    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        raise ValueError(
            f"Missing required Snowflake environment variables: {', '.join(missing)}"
        )

    return snowflake.connector.connect(
        user=os.getenv("SNOWFLAKE_USER"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        role=os.getenv("SNOWFLAKE_ROLE"),
        database=os.getenv("SNOWFLAKE_DATABASE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA"),
    )


def list_databases(pattern: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """List all databases in Snowflake, optionally filtered by pattern."""
    from snowflake.connector import DictCursor

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)

        if pattern:
            sanitized_pattern = _sanitize_pattern(pattern)
            query = f"SHOW DATABASES LIKE '{sanitized_pattern}' LIMIT {limit}"
        else:
            query = f"SHOW DATABASES LIMIT {limit}"

        cursor.execute(query)
        results = cursor.fetchall()

        return [
            {
                "name": row["name"],
                "owner": row["owner"],
                "created_on": str(row["created_on"]),
            }
            for row in results
        ]
    finally:
        conn.close()


def list_schemas(database: str, pattern: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """List all schemas in a Snowflake database, optionally filtered by pattern."""
    from snowflake.connector import DictCursor

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)
        cursor.execute(f"USE DATABASE {database}")

        if pattern:
            sanitized_pattern = _sanitize_pattern(pattern)
            cursor.execute(f"SHOW SCHEMAS LIKE '{sanitized_pattern}'")
        else:
            cursor.execute("SHOW SCHEMAS")
        results = cursor.fetchall()[:limit]

        return [
            {
                "name": row["name"],
                "database": row["database_name"],
                "owner": row.get("owner", ""),
                "created_on": str(row.get("created_on", "")),
            }
            for row in results
        ]
    finally:
        conn.close()


def list_tables(schema: str, database: str, pattern: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """List all tables in a Snowflake schema, optionally filtered by pattern."""
    from snowflake.connector import DictCursor

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)
        cursor.execute(f"USE DATABASE {database}")
        cursor.execute(f"USE SCHEMA {schema}")

        if pattern:
            sanitized_pattern = _sanitize_pattern(pattern)
            cursor.execute(f"SHOW TABLES LIKE '{sanitized_pattern}'")
        else:
            cursor.execute("SHOW TABLES")
        results = cursor.fetchall()[:limit]

        return [
            {
                "name": row["name"],
                "schema": row["schema_name"],
                "database": row["database_name"],
                "rows": row.get("rows", 0),
                "bytes": row.get("bytes", 0),
                "created_on": str(row.get("created_on", "")),
            }
            for row in results
        ]
    finally:
        conn.close()


def get_table_columns(table: str, schema: str, database: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get column information for a table."""
    from snowflake.connector import DictCursor

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)

        if database:
            cursor.execute(f"USE DATABASE {database}")

        cursor.execute(f"USE SCHEMA {schema}")
        cursor.execute(f"DESCRIBE TABLE {table}")
        results = cursor.fetchall()

        return [
            {
                "name": row["name"],
                "type": row["type"],
                "nullable": row.get("null?", "Y") == "Y",
                "default": row.get("default"),
                "primary_key": row.get("primary key", "N") == "Y",
            }
            for row in results
        ]
    finally:
        conn.close()


def preview_table(table: str, schema: str, database: str, limit: int = 10) -> Dict[str, Any]:
    """Preview rows from a table."""
    from snowflake.connector import DictCursor

    if limit > 1000:
        limit = 1000

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)
        cursor.execute(f"USE DATABASE {database}")
        cursor.execute(f"USE SCHEMA {schema}")

        cursor.execute(f"DESCRIBE TABLE {table}")
        columns = [row["name"] for row in cursor.fetchall()]

        cursor.execute(f"SELECT * FROM {table} LIMIT {limit}")
        rows = cursor.fetchall()

        formatted_rows = []
        for row in rows:
            formatted_row = {}
            for col in columns:
                value = row.get(col)
                formatted_row[col] = str(value) if value is not None else None
            formatted_rows.append(formatted_row)

        return {
            "columns": columns,
            "rows": formatted_rows,
            "row_count": len(formatted_rows),
            "limit": limit,
        }
    finally:
        conn.close()


def select_rows(
    database: str,
    schema: str,
    table: str,
    columns: Optional[List[str]] = None,
    where: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """Select rows from a table with optional filtering."""
    from snowflake.connector import DictCursor

    if limit > 1000:
        limit = 1000
    if limit < 1:
        limit = 1

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)

        col_list = "*"
        if columns:
            col_list = ", ".join([f'"{col}"' for col in columns])

        query = f'SELECT {col_list} FROM "{database}"."{schema}"."{table}"'

        if where:
            sanitized_where = _sanitize_where(where)
            query += f" WHERE {sanitized_where}"

        query += f" LIMIT {limit}"

        cursor.execute(query)
        results = cursor.fetchall()

        if not results:
            return {"columns": [], "rows": [], "row_count": 0, "limit": limit}

        columns_list = list(results[0].keys())

        return {
            "columns": columns_list,
            "rows": results,
            "row_count": len(results),
            "limit": limit,
        }
    finally:
        conn.close()


def get_distinct_values(
    database: str,
    schema: str,
    table: str,
    column: str,
    where: Optional[str] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """Get distinct values from a column."""
    from snowflake.connector import DictCursor

    if limit > 1000:
        limit = 1000
    if limit < 1:
        limit = 1

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)

        query = f'SELECT DISTINCT "{column}" FROM "{database}"."{schema}"."{table}"'

        if where:
            sanitized_where = _sanitize_where(where)
            query += f" WHERE {sanitized_where}"

        query += f" LIMIT {limit}"

        cursor.execute(query)
        results = cursor.fetchall()

        values = [row[column] for row in results if column in row]

        return {
            "column": column,
            "values": values,
            "count": len(values),
            "limit": limit,
        }
    finally:
        conn.close()


def count_rows(
    database: str,
    schema: str,
    table: str,
    where: Optional[str] = None,
) -> Dict[str, Any]:
    """Count rows in a table with optional filtering."""
    from snowflake.connector import DictCursor

    conn = _get_connection()
    try:
        cursor = conn.cursor(DictCursor)

        query = f'SELECT COUNT(*) as row_count FROM "{database}"."{schema}"."{table}"'

        if where:
            sanitized_where = _sanitize_where(where)
            query += f" WHERE {sanitized_where}"

        cursor.execute(query)
        result = cursor.fetchone()

        return {
            "count": result["ROW_COUNT"] if result else 0,
            "table": f'"{database}"."{schema}"."{table}"',
        }
    finally:
        conn.close()
