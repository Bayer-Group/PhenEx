from ibis.expr.types.relations import Table


class Filter:
    """
    Filters operate on single tables and return these tables with rows removed. Filters are
    generally used within a Phenotype as a subquery. Filters know about their dependencies
    but cannot trigger recursive execution. Fitlers can add columns but may not remove columns.
    All classes in the filters module should subclass this class. Subclasses must implement
    the _filter method.
    """

    def __init__(self):
        pass

    def filter(self, table: Table) -> Table:
        input_columns = table.columns
        table = self._filter(table)
        if not set(input_columns) <= set(table.columns):
            raise ValueError(f"Filter must not remove columns.")

        return table

    def _filter(self, table: Table) -> Table:
        raise NotImplementedError()
