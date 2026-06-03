from typing import List
from datetime import date, datetime
from ibis.expr.types.relations import Table
import ibis
from phenex.tables import PhenexTable
from phenex.util import create_logger

logger = create_logger(__name__)


def _get_join_keys(table=None):
    """Return the join keys. Always (PERSON_ID, INDEX_DATE) unless table lacks INDEX_DATE."""
    if table is not None and "INDEX_DATE" not in table.columns:
        return ["PERSON_ID"]
    return ["PERSON_ID", "INDEX_DATE"]


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
                anchor_cols = [anchor_table.PERSON_ID]
                has_index = "INDEX_DATE" in raw.columns and "INDEX_DATE" in anchor_table.columns
                if has_index:
                    anchor_cols.append(anchor_table.INDEX_DATE)
                anchor_cols.append(anchor_table.EVENT_DATE.name(ref_col_name))
                anchor_slim = anchor_table.select(anchor_cols)
                # Build join predicate
                pred = raw.PERSON_ID == anchor_slim.PERSON_ID
                if has_index:
                    pred = pred & (raw.INDEX_DATE == anchor_slim.INDEX_DATE)
                keep_cols = [c for c in raw.columns] + [ref_col_name]
                raw = raw.join(
                    anchor_slim,
                    pred,
                    how="left",
                ).select(keep_cols)
            reference_column = raw[ref_col_name]
    else:
        assert (
            "INDEX_DATE" in raw.columns
        ), f"INDEX_DATE column not found in table {table}"
        reference_column = raw.INDEX_DATE

    return raw, reference_column


def hstack(phenotypes: List["Phenotype"], join_table: Table = None) -> Table:
    """
    Horizontally stacks multiple PhenotypeTable objects into a single table.
    Joins on (PERSON_ID, INDEX_DATE) when INDEX_DATE is present, otherwise PERSON_ID only.
    """
    t0 = datetime.now()
    if isinstance(join_table, PhenexTable):
        join_table = join_table.table

    # Detect join keys from the first phenotype's table
    join_keys = _get_join_keys(phenotypes[0].table)

    if join_table is None:
        logger.info(
            f"hstack: building flat LEFT JOIN chain for {len(phenotypes)} phenotypes (UNION base)"
        )
        key_tables = [
            pt.namespaced_table.select(join_keys) for pt in phenotypes
        ]
        join_table = ibis.union(*key_tables, distinct=True)
    else:
        # When a join_table is provided (e.g. PERSON table), restrict join keys
        # to columns available in the join_table
        join_keys = [k for k in join_keys if k in join_table.columns]
        logger.info(
            f"hstack: building flat LEFT JOIN chain for {len(phenotypes)} phenotypes"
        )

    for pt in phenotypes:
        join_table = join_table.join(pt.namespaced_table, join_keys, how="left")

    # Remove duplicate key columns from right side of joins
    columns = [
        c
        for c in join_table.columns
        if c in join_keys or (not c.startswith("PERSON_ID") and not c.startswith("INDEX_DATE"))
    ]
    # Deduplicate (join_keys appear once)
    seen = set()
    unique_columns = []
    for c in columns:
        if c not in seen:
            seen.add(c)
            unique_columns.append(c)
    join_table = join_table.select(unique_columns)

    # Apply fill_null for all boolean columns in a single .mutate() call
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
    using UNION ALL + GROUP BY with filtered aggregation.
    Groups by (PERSON_ID, INDEX_DATE) when INDEX_DATE is present, otherwise PERSON_ID only.
    """
    t0 = datetime.now()
    logger.info(
        f"hstack_boolean: building UNION ALL + pivot expression for {len(phenotypes)} phenotypes"
    )

    if isinstance(join_table, PhenexTable):
        join_table = join_table.table

    # Detect join keys from the first phenotype's table
    join_keys = _get_join_keys(phenotypes[0].table)

    # Step 1: UNION ALL — stack each phenotype's (keys, BOOLEAN) with a tag column
    unioned_tables = []
    for pt in phenotypes:
        t = pt.table.select(*join_keys, "BOOLEAN").mutate(
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
    wide_table = long_table.group_by(join_keys).aggregate(**agg_exprs)

    # Step 3: If a base table was provided, LEFT JOIN to preserve all its rows
    if join_table is not None:
        result = join_table.join(wide_table, join_keys, how="left")
        # Drop duplicated key columns from right side
        columns = [
            c
            for c in result.columns
            if c in join_keys or (not c.startswith("PERSON_ID") and not c.startswith("INDEX_DATE"))
        ]
        seen = set()
        unique_columns = []
        for c in columns:
            if c not in seen:
                seen.add(c)
                unique_columns.append(c)
        result = result.select(unique_columns)
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
    Groups by (PERSON_ID, INDEX_DATE) when INDEX_DATE is present, otherwise PERSON_ID only.
    """
    t0 = datetime.now()
    logger.info(
        f"hstack_pivot: building UNION ALL + pivot expression for {len(phenotypes)} phenotypes"
    )

    if isinstance(join_table, PhenexTable):
        join_table = join_table.table

    # Detect join keys from the first phenotype's table
    join_keys = _get_join_keys(phenotypes[0].table)

    # Step 1: Build per-phenotype slices
    original_value_types = {pt.name: pt.table.schema()["VALUE"] for pt in phenotypes}
    parts = []
    for pt in phenotypes:
        base = pt.table.select(*join_keys, "BOOLEAN", "EVENT_DATE", "VALUE")
        t = base.mutate(
            EVENT_DATE=base.EVENT_DATE.cast("date"),
            VALUE=base.VALUE.cast("str"),
            _PHENOTYPE=ibis.literal(pt.name),
        )
        parts.append(t)

    long_table = ibis.union(*parts, distinct=False)

    # Step 2: Pivot via GROUP BY + filtered MAX
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

    wide_table = long_table.group_by(join_keys).aggregate(**agg_exprs)

    # Step 3: If a base table was provided, LEFT JOIN to preserve all its rows
    if join_table is not None:
        join_table = join_table.select(join_keys).distinct()
        result = join_table.join(wide_table, join_keys, how="left")
        columns = [
            c
            for c in result.columns
            if c in join_keys or (not c.startswith("PERSON_ID") and not c.startswith("INDEX_DATE"))
        ]
        seen = set()
        unique_columns = []
        for c in columns:
            if c not in seen:
                seen.add(c)
                unique_columns.append(c)
        result = result.select(unique_columns)
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
    cols = [table.PERSON_ID]
    if "INDEX_DATE" in table.columns:
        cols.append(table.INDEX_DATE)
    cols.extend([table.BOOLEAN, table.EVENT_DATE, table.VALUE])
    return table.select(cols)
