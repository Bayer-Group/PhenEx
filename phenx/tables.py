from ibis.expr.types.relations import Table
from dataclasses import asdict
from phenx.mappers import PersonTableColumnMapper, CodeTableColumnMapper


class PersonTable(Table):
    # These datatpyes are just used for type hinting
    pass


class IndexTable(Table):
    # These datatpyes are just used for type hinting
    pass


class CodeTable(Table):
    # These datatpyes are just used for type hinting
    pass


class EventTable(Table):
    # These datatpyes are just used for type hinting
    pass


class MeasurementTable(Table):
    # These datatpyes are just used for type hinting
    pass


class PhenotypeTable(Table):
    # These datatpyes are just used for type hinting
    pass


PERSON_TABLE_COLUMNS = ["PERSON_ID", "DATE_OF_BIRTH"]
CODE_TABLE_COLUMNS = ["PERSON_ID", "EVENT_DATE", "CODE"]
PHENOTYPE_TABLE_COLUMNS = ["PERSON_ID", "BOOLEAN", "EVENT_DATE", "VALUE"]
EVENT_TABLE_COLUMNS = ["PERSON_ID", "EVENT_DATE"]
INDEX_TABLE_COLUMNS = ["PERSON_ID", "INDEX_DATE"]


def is_phenx_person_table(table: Table) -> bool:
    """
    Check if given table is a person table.
    One could check one row per patient?
    """
    return set(PERSON_TABLE_COLUMNS) <= set(table.columns)


def is_phenx_code_table(table: Table) -> bool:
    """
    Check if given table is a code table.
    """
    return set(CODE_TABLE_COLUMNS) <= set(table.columns + ["CODE_TYPE"])


def is_phenx_event_table(table: Table) -> bool:
    """
    Check if given table is a code table.
    """
    return set(EVENT_TABLE_COLUMNS) <= set(table.columns)


def is_phenx_phenotype_table(table: Table) -> bool:
    """
    Check if given table is a code table.
    """
    return set(PHENOTYPE_TABLE_COLUMNS) <= set(table.columns)


def is_phenx_index_table(table: Table) -> bool:
    """
    Check if given table is a code table.
    """
    return set(INDEX_TABLE_COLUMNS) <= set(table.columns)
