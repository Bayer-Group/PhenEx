from typing import Dict
from ibis.expr.types.relations import Table


class DerivedTable:
    def __init__(self, source_domain: str, dest_domain: str):
        self.source_domain = source_domain
        self.dest_domain = dest_domain

    def derive(
        self,
        tables: Dict[str, Table],
    ) -> "PhenexTable":
        raise NotImplementedError
