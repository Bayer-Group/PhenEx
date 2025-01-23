from typing import List
from ibis.expr.types.relations import Table
import ibis
from phenex.tables import PhenexTable


def hstack(phenotypes: List["Phenotype"], join_table: Table = None) -> Table:
    """
    Horizontally stacks multiple PhenotypeTable objects into a single table. The PERSON_ID columns are used to join the tables together. The resulting table will have three columns per phenotype: BOOLEAN, EVENT_DATE, and VALUE. The columns will be contain the phenotype name as a prefix.
    # TODO: Add a test for this function.
    Args:
        phenotypes (List[Phenotype]): A list of Phenotype objects to stack.
    """
    # TODO decide if phenotypes should be returning a phenextable
    if isinstance(join_table, PhenexTable):
        join_table = join_table.table
    idx_phenotype_to_begin = 0
    join_type = "left"  # if join table is defined, we want to left join
    if join_table is None:
        idx_phenotype_to_begin = 1
        join_table = phenotypes[0].namespaced_table
        join_type = "outer"  # if join table is NOT defined, we want an outer join
    for pt in phenotypes[idx_phenotype_to_begin:]:
        join_table = join_table.join(pt.namespaced_table, "PERSON_ID", how=join_type)
        join_table = join_table.mutate(
            PERSON_ID=ibis.coalesce(join_table.PERSON_ID, join_table.PERSON_ID_right)
        )
        columns = join_table.columns
        columns.remove("PERSON_ID_right")
        join_table = join_table.select(columns)

    for pt in phenotypes:
        column_operation = join_table[f"{pt.name}_BOOLEAN"].fill_null(False)
        join_table = join_table.mutate(**{f"{pt.name}_BOOLEAN": column_operation})
    return join_table


def select_phenotype_columns(
    table, fill_date=ibis.null(), fill_value=ibis.null(), fill_boolean=True
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
