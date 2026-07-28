"""Regression tests for dialect-correct SQL generation (ticket-4, to_sql)."""

import ibis

from phenex.ibis_connect import (
    DIALECT_STAMP_PREFIX,
    compile_sql,
    ibis_dialect_of_expr,
    read_dialect_stamp,
)


def _day_count_expr(con):
    """A `.delta(..., "day")` expression - the DATEDIFF shape that differs by dialect."""
    con.create_table("T", schema=dict(A="date", B="date"))
    t = con.table("T")
    return t.mutate(VALUE=t.A.delta(t.B, "day"))


def test_snowflake_dialect_uses_datediff_not_date_diff():
    # Same expression must emit DATEDIFF on Snowflake and DATE_DIFF on DuckDB.
    expr = ibis.table(dict(A="date", B="date"), name="T").mutate(
        VALUE=ibis.table(dict(A="date", B="date"), name="T").A.delta(
            ibis.table(dict(A="date", B="date"), name="T").B, "day"
        )
    )
    snow = compile_sql(expr, dialect="snowflake", stamp=False)
    duck = compile_sql(expr, dialect="duckdb", stamp=False)
    assert "DATEDIFF" in snow and "DATE_DIFF" not in snow
    assert "DATE_DIFF" in duck and "DATEDIFF(" not in duck


def test_compile_sql_stamps_and_infers_dialect_from_bound_expr():
    con = ibis.duckdb.connect()
    expr = _day_count_expr(con)
    # dialect inferred from the bound expression, not the DuckDB default fallback
    assert ibis_dialect_of_expr(expr) == "duckdb"
    sql = compile_sql(expr)  # no explicit dialect -> infer from binding
    assert sql.startswith(f"{DIALECT_STAMP_PREFIX} duckdb")
    assert read_dialect_stamp(sql) == "duckdb"
    # the stamp is a leading SQL comment, so the SQL still executes
    assert con.sql(sql).count().execute() == 0


def test_explicit_dialect_stamp_matches_requested_dialect():
    expr = ibis.table(dict(A="date", B="date"), name="T")
    sql = compile_sql(expr, dialect="snowflake")
    assert sql.startswith(f"{DIALECT_STAMP_PREFIX} snowflake")
    assert read_dialect_stamp(sql) == "snowflake"


def test_read_dialect_stamp_none_when_unstamped():
    assert read_dialect_stamp("SELECT 1") is None
    assert read_dialect_stamp("") is None
    assert read_dialect_stamp(None) is None


def test_compile_sql_unbound_expr_falls_back_unstamped():
    # Unbound expression has no backend to infer from -> no stamp, like bare ibis.to_sql.
    expr = ibis.table(dict(A="int"), name="T")
    assert ibis_dialect_of_expr(expr) is None
    sql = compile_sql(expr)
    assert read_dialect_stamp(sql) is None
    assert "SELECT" in sql.upper()
