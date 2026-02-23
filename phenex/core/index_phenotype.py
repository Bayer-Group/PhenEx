from typing import Dict
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.phenotypes.phenotype import Phenotype


class IndexPhenotype(Phenotype):
    """
    Compute the index table form the individual inclusions / exclusions phenotypes.
    """

    def __init__(
        self,
        name: str,
        entry_phenotype: Phenotype,
        inclusion_table_node: Node,
        exclusion_table_node: Node,
    ):
        super(IndexPhenotype, self).__init__(name=name)
        self.add_children(entry_phenotype)
        if inclusion_table_node:
            self.add_children(inclusion_table_node)
        if exclusion_table_node:
            self.add_children(exclusion_table_node)

        self.entry_phenotype = entry_phenotype
        self.inclusion_table_node = inclusion_table_node
        self.exclusion_table_node = exclusion_table_node

    def _execute(self, tables: Dict[str, Table]):
        index_table = self.entry_phenotype.table.mutate(INDEX_DATE="EVENT_DATE")

        if self.inclusion_table_node:
            include = self.inclusion_table_node.table.filter(
                self.inclusion_table_node.table["BOOLEAN"] == True
            ).select(["PERSON_ID"])
            index_table = index_table.inner_join(include, ["PERSON_ID"])

        if self.exclusion_table_node:
            exclude = self.exclusion_table_node.table.filter(
                self.exclusion_table_node.table["BOOLEAN"] == False
            ).select(["PERSON_ID"])
            index_table = index_table.inner_join(exclude, ["PERSON_ID"])

        return index_table
