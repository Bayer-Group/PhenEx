from typing import List
from datetime import date, datetime
from ibis.expr.types.relations import Table
import ibis
from phenex.tables import PhenexTable
from phenex.util import create_logger

logger = create_logger(__name__)


def attach_anchor_and_get_reference_date(table, anchor_phenotype=None):
    # Unwrap PhenexTable so all joins are done at the raw ibis level.
    # PhenexTable.join would re-wrap the join result through __init__ which
    # calls .mutate(), triggering ibis's collision check on PERSON_ID_right.
    raw = table.table if isinstance(table, PhenexTable) else table

    if anchor_phenotype is not None:
        if anchor_phenotype.table is None:
            raise ValueError(
                f"Dependent Phenotype {anchor_phenotype.name} must be executed before this node can run!"
            )
        else:
            anchor_table = anchor_phenotype.table
            # Rename EVENT_DATE to a unique name before joining to avoid collisions
            # when this function is called multiple times on the same table.
            # If the column is already present (same anchor used in a previous filter),
            # skip the join and reuse the existing column.
            ref_col_name = f"_ref_date_{anchor_phenotype.name}"
            if ref_col_name not in raw.columns:
                anchor_slim = anchor_table.select(
                    anchor_table.PERSON_ID,
                    anchor_table.EVENT_DATE.name(ref_col_name),
                )
                # Join at raw ibis level using an explicit predicate so we can
                # drop the duplicate PERSON_ID_right immediately afterwards.
                raw = raw.join(
                    anchor_slim,
                    raw.PERSON_ID == anchor_slim.PERSON_ID,
                    how="left",
                ).select([c for c in raw.columns] + [ref_col_name])
            reference_column = raw[ref_col_name]
    else:
        assert (
            "INDEX_DATE" in raw.columns
        ), f"INDEX_DATE column not found in table {table}"
        reference_column = raw.INDEX_DATE

    return raw, reference_column


def hstack(phenotypes: List["Phenotype"], join_table: Table = None) -> Table:
    """
    Horizontally stacks multiple PhenotypeTable objects into a single table. The PERSON_ID columns are used to join the tables together. The resulting table will have three columns per phenotype: BOOLEAN, EVENT_DATE, and VALUE. The columns will be contain the phenotype name as a prefix.
    # TODO: Add a test for this function.
    Args:
        phenotypes (List[Phenotype]): A list of Phenotype objects to stack.
    """
    # TODO decide if phenotypes should be returning a phenextable
    t0 = datetime.now()
    if isinstance(join_table, PhenexTable):
        join_table = join_table.table

    if join_table is None:
        # UNION all phenotype PERSON_IDs as the base so every patient appears exactly once.
        # We then LEFT JOIN each phenotype against this base. This replaces the previous
        # chained FULL OUTER JOIN approach which inserted a .mutate()/.select() between
        # every join, breaking ibis's JoinChain into N nested subqueries.
        logger.info(
            f"hstack: building flat LEFT JOIN chain for {len(phenotypes)} phenotypes (UNION base)"
        )
        person_id_tables = [
            pt.namespaced_table.select("PERSON_ID") for pt in phenotypes
        ]
        join_table = ibis.union(*person_id_tables, distinct=True)
    else:
        logger.info(
            f"hstack: building flat LEFT JOIN chain for {len(phenotypes)} phenotypes"
        )

    # Chain all LEFT JOINs WITHOUT any intermediate .select()/.mutate() between iterations.
    # Consecutive .join() calls on an ibis relation accumulate into a single JoinChain that
    # compiles to a flat multi-way JOIN in SQL, rather than N layers of nested subqueries.
    # Since join_table always has all PERSON_IDs (UNION base or caller-supplied), its
    # PERSON_ID is always non-null so COALESCE is unnecessary.
    for pt in phenotypes:
        join_table = join_table.join(pt.namespaced_table, "PERSON_ID", how="left")

    # Remove all PERSON_ID_right* columns (key duplicates from each join's right side).
    # Phenotype-specific columns are named {NAME}_BOOLEAN / _EVENT_DATE / _VALUE and are unaffected.
    columns = [
        c
        for c in join_table.columns
        if c == "PERSON_ID" or not c.startswith("PERSON_ID")
    ]
    join_table = join_table.select(columns)

    # Apply fill_null for all boolean columns in a single .mutate() call
    # (one SQL projection instead of N separate projections).
    null_fills = {}
    for pt in phenotypes:
        bool_col_name = f"{pt.name}_BOOLEAN"
        bool_column = join_table[bool_col_name]
        if bool_column.type().is_floating():
            null_fills[bool_col_name] = bool_column.fill_null(0.0)
        else:
            null_fills[bool_col_name] = bool_column.fill_null(False)
    if null_fills:
        join_table = join_table.mutate(**null_fills)

    logger.info(
        f"hstack: expression built in {(datetime.now() - t0).total_seconds():.3f}s "
        f"(SQL execution deferred to con.create_table)"
    )
    return join_table


def hstack_boolean(phenotypes: List["Phenotype"], join_table: Table = None) -> Table:
    """
    Efficiently stacks only the BOOLEAN column from multiple phenotypes into a wide table
    using UNION ALL + GROUP BY with filtered aggregation instead of N sequential JOINs.

    This produces SQL of the form:
        SELECT PERSON_ID,
               MAX(CASE WHEN _PHENOTYPE = 'pheno1' THEN BOOLEAN END) AS pheno1_BOOLEAN,
               ...
        FROM (SELECT PERSON_ID, BOOLEAN, 'pheno1' AS _PHENOTYPE FROM t1
              UNION ALL
              SELECT PERSON_ID, BOOLEAN, 'pheno2' AS _PHENOTYPE FROM t2 ...)
        GROUP BY PERSON_ID

    This is O(n) with a single data shuffle, compared to O(n * k) for k sequential joins.

    Args:
        phenotypes: A list of Phenotype objects to stack.
        join_table: Optional base table. If provided, the result is LEFT JOINed onto it
                    to preserve all rows (e.g. all patients in the index table).

    Returns:
        Table with PERSON_ID and {name}_BOOLEAN columns for each phenotype.
    """
    t0 = datetime.now()
    logger.info(
        f"hstack_boolean: building UNION ALL + pivot expression for {len(phenotypes)} phenotypes"
    )

    if isinstance(join_table, PhenexTable):
        join_table = join_table.table

    # Step 1: UNION ALL — stack each phenotype's (PERSON_ID, BOOLEAN) with a tag column
    unioned_tables = []
    for pt in phenotypes:
        t = pt.table.select("PERSON_ID", "BOOLEAN").mutate(
            _PHENOTYPE=ibis.literal(pt.name)
        )
        unioned_tables.append(t)

    long_table = ibis.union(*unioned_tables)

    # Step 2: Pivot via GROUP BY + filtered MAX
    agg_exprs = {}
    for pt in phenotypes:
        col_name = f"{pt.name}_BOOLEAN"
        bool_col = long_table.BOOLEAN
        is_match = long_table._PHENOTYPE == pt.name
        if bool_col.type().is_floating():
            agg_exprs[col_name] = bool_col.max(where=is_match).fill_null(0.0)
        else:
            agg_exprs[col_name] = bool_col.max(where=is_match).fill_null(False)
    wide_table = long_table.group_by("PERSON_ID").aggregate(**agg_exprs)

    # Step 3: If a base table was provided, LEFT JOIN to preserve all its rows
    if join_table is not None:
        result = join_table.join(wide_table, "PERSON_ID", how="left")
        # Drop duplicated PERSON_ID_right if present
        columns = [
            c
            for c in result.columns
            if c == "PERSON_ID" or not c.startswith("PERSON_ID")
        ]
        result = result.select(columns)
    else:
        result = wide_table

    logger.info(
        f"hstack_boolean: expression built in {(datetime.now() - t0).total_seconds():.3f}s "
        f"(SQL execution deferred to con.create_table)"
    )
    return result


def hstack_pivot(
    phenotypes: List["Phenotype"], join_table: Table = None, date_agg: str = "max"
) -> Table:
    """
    Efficiently stacks BOOLEAN, EVENT_DATE, and VALUE from multiple phenotypes into a
    wide table using UNION ALL + GROUP BY with filtered aggregation.

    This is the full-column equivalent of hstack_boolean. VALUE is cast to string
    before the UNION ALL so the schema is consistent across all phenotypes (numeric,
    categorical, and null-typed values are all compatible). BOOLEAN and EVENT_DATE
    are kept as-is.

    Args:
        phenotypes: A list of Phenotype objects to stack.
        join_table: Optional base table whose rows are all preserved via LEFT JOIN.
        date_agg: Aggregation to apply to EVENT_DATE when a child phenotype has
            multiple rows per person (e.g. return_date='all'). Use ``"min"`` when
            the parent wants the first (earliest) date, and ``"max"`` (default)
            when it wants the last (latest) date. The parent's own
            ``ibis.least`` / ``ibis.greatest`` call then operates correctly on
            per-child min/max dates.

    Returns:
        Table with PERSON_ID and {name}_BOOLEAN / {name}_EVENT_DATE / {name}_VALUE
        columns for each phenotype. Each {name}_VALUE retains its original type.
    """
    t0 = datetime.now()
    logger.info(
        f"hstack_pivot: building UNION ALL + pivot expression for {len(phenotypes)} phenotypes"
    )

    if isinstance(join_table, PhenexTable):
        join_table = join_table.table

    # Step 1: Build each per-phenotype slice as select → mutate so that every
    # column reference inside .mutate() is bound to the SAME relation produced
    # by .select(). Referencing pt.table.VALUE inside pt.table.select() risks
    # ibis treating them as two distinct relation nodes and emitting a cross join.
    original_value_types = {pt.name: pt.table.schema()["VALUE"] for pt in phenotypes}
    parts = []
    for pt in phenotypes:
        base = pt.table.select("PERSON_ID", "BOOLEAN", "EVENT_DATE", "VALUE")
        t = base.mutate(
            EVENT_DATE=base.EVENT_DATE.cast("date"),
            VALUE=base.VALUE.cast("str"),
            _PHENOTYPE=ibis.literal(pt.name),
        )
        parts.append(t)

    # UNION ALL — keep every row (distinct=False); the GROUP BY handles deduplication
    long_table = ibis.union(*parts, distinct=False)

    # Step 2: Pivot via GROUP BY + filtered MAX — one aggregation pass, no joins.
    # Cast each VALUE column back to its original type after the pivot.
    bool_col = long_table.BOOLEAN
    date_col = long_table.EVENT_DATE
    val_col = long_table.VALUE

    agg_exprs = {}
    for pt in phenotypes:
        is_match = long_table._PHENOTYPE == pt.name
        agg_exprs[f"{pt.name}_BOOLEAN"] = bool_col.max(where=is_match).fill_null(False)
        agg_exprs[f"{pt.name}_EVENT_DATE"] = (
            date_col.min(where=is_match)
            if date_agg == "min"
            else date_col.max(where=is_match)
        )
        original_type = original_value_types[pt.name]
        agg_exprs[f"{pt.name}_VALUE"] = val_col.max(where=is_match).cast(original_type)

    wide_table = long_table.group_by("PERSON_ID").aggregate(**agg_exprs)

    # Step 3: If a base table was provided, LEFT JOIN to preserve all its rows
    if join_table is not None:
        join_table = join_table.select(
            "PERSON_ID"
        ).distinct()  # Ensure join_table has only one PERSON_ID column
        result = join_table.join(wide_table, "PERSON_ID", how="left")
        columns = [
            c
            for c in result.columns
            if c == "PERSON_ID" or not c.startswith("PERSON_ID")
        ]
        result = result.select(columns)
    else:
        logger.debug("No join table provided to hstack")
        result = wide_table

    logger.info(
        f"hstack_pivot: expression built in {(datetime.now() - t0).total_seconds():.3f}s "
        f"(SQL execution deferred to con.create_table)"
    )
    return result


def select_phenotype_columns(
    table,
    fill_date=ibis.null(date),
    fill_value=ibis.null().cast("int32"),
    fill_boolean=True,
):
    if "PERSON_ID" not in table.columns:
        raise ValueError("Table must have a PERSON_ID column")
    if "EVENT_DATE" not in table.columns:
        table = table.mutate(EVENT_DATE=fill_date)
    if "VALUE" not in table.columns:
        table = table.mutate(VALUE=fill_value)
    if "BOOLEAN" not in table.columns:
        table = table.mutate(BOOLEAN=fill_boolean)
    return table.select([table.PERSON_ID, table.BOOLEAN, table.EVENT_DATE, table.VALUE])
