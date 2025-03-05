from ibis.expr.types.relations import Table
from phenex.tables import PhenexTable
from typing import Optional, Dict
from phenex.util.serialization.to_dict import to_dict


class Filter:
    """
    Filters operate on single tables and return these tables with rows removed. Filters are generally used within a Phenotype as a subquery. Filters know about their dependencies but cannot trigger recursive execution. Fitlers can add columns but may not remove columns. All classes in the filters module should subclass this class. This class is not intended to be used directly, but should be subclassed to create useful filters. Subclasses must implement the _filter method.

    Methods:
        filter: Filters the given table according to the rules of the Filter.

        autojoin_filter: Like filter, but magically joins needed tables in order to filter table, for instance, when filtering a CONDITION_OCCURRENCE-like table based on contextual information in a VISIT-like table.
    """

    def __init__(self):
        pass

    def filter(self, table: PhenexTable) -> PhenexTable:
        """
        Filters the given table according to the rules of the Filter.

        Args:
            table (PhenexTable): The table to be filtered.

        Returns:
            PhenexTable: The filtered table. The returned table has the exact same schema as the input table but has rows removed.
        """
        input_columns = table.columns
        filtered_table = self._filter(table)
        if not set(input_columns) <= set(filtered_table.columns):
            raise ValueError(f"Filter must not remove columns.")

        filtered_table = filtered_table.select(input_columns)
        if isinstance(table, PhenexTable):
            return type(table)(filtered_table)
        else:
            return filtered_table

    def _filter(self, table: Table) -> Table:
        """
        Performs the operations required to filter the table.
        """
        raise NotImplementedError()

    def autojoin_filter(
        self, table: "PhenexTable", tables: Optional[Dict[str, "PhenexTable"]] = None
    ) -> "PhenexTable":
        raise NotImplementedError()

    def __and__(self, other):
        return AndFilter(self, other)

    def __or__(self, other):
        return OrFilter(self, other)

    def __invert__(self):
        return NotFilter(self)

    def to_dict(self):
        return to_dict(self)


class AndFilter(Filter):
    """
    Combines two filters using logical AND.
    """

    def __init__(self, filter1, filter2):
        self.filter1 = filter1
        self.filter2 = filter2

    def filter(self, table: Table) -> Table:
        table = self.filter1.filter(table)
        return self.filter2.filter(table)

    def autojoin_filter(self, table: "PhenexTable", tables: dict = None):
        table = self.filter1.autojoin_filter(table, tables)
        return self.filter2.autojoin_filter(table, tables)


class OrFilter(Filter):
    """
    Combines two filters using logical OR.
    """

    def __init__(self, filter1, filter2):
        self.filter1 = filter1
        self.filter2 = filter2

    def filter(self, table: Table) -> Table:
        table1 = self.filter1.filter(table).table
        table2 = self.filter2.filter(table).table
        return type(table)(table1.union(table2).distinct())

    def autojoin_filter(self, table: "PhenexTable", tables: dict = None):
        table1 = self.filter1.autojoin_filter(table, tables).table
        table2 = self.filter2.autojoin_filter(table, tables).table
        return type(table)(table1.union(table2, distinct=True))


class NotFilter(Filter):
    """
    Negates a filter.
    """

    def __init__(self, filter):
        self.filter = filter

    def filter(self, table: Table) -> Table:
        filtered_table = self.filter.filter(table).table
        return type(table)(table.difference(filtered_table))

    def autojoin_filter(self, table: "PhenexTable", tables: dict = None):
        filtered_table = self.filter.autojoin_filter(table, tables).table
        return type(table)(table.difference(filtered_table))
