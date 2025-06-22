from typing import Dict
from ibis.expr.types.relations import Table


class DerivedTable:
    """
    A DerivedTable takes one or more source tables and creates a single output table. Possible use cases are:
    1. combining multiple tables into one e.g. taking the vaccination table, patient reported medication, administered medication and prescription table and creating a single medication table.
    2. performing cleaning operations on a table, e.g. removing duplicates, filling in missing values, etc.
    3. performing aggregations on a table, e.g. calculating the number of visits per patient, etc.

    To subclass:
        1. implement derive method, and return a single table
    """

    def __init__(self, source_domain: str, dest_domain: str):
        self.source_domain = source_domain
        self.dest_domain = dest_domain

    def derive(
        self,
        tables: Dict[str, Table],
    ) -> "PhenexTable":
        raise NotImplementedError
