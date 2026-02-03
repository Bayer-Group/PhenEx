from typing import List, Dict
import ibis
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.phenotypes.phenotype import Phenotype


class ExclusionsTableNode(Node):
    """
    Compute the inclusions / exclusions table from the individual inclusions / exclusions phenotypes.
    """

    def __init__(
        self, name: str, index_phenotype: Phenotype, phenotypes: List[Phenotype]
    ):
        super(ExclusionsTableNode, self).__init__(name=name)
        self.add_children(phenotypes)
        self.add_children(index_phenotype)
        self.phenotypes = phenotypes
        self.index_phenotype = index_phenotype

    def _execute(self, tables: Dict[str, Table]):
        exclusions_table = self.index_phenotype.table.select(["PERSON_ID"])

        for pt in self.phenotypes:
            pt_table = pt.table.select(["PERSON_ID", "BOOLEAN"]).rename(
                **{
                    f"{pt.name}_BOOLEAN": "BOOLEAN",
                }
            )
            exclusions_table = exclusions_table.left_join(pt_table, ["PERSON_ID"])
            columns = exclusions_table.columns
            columns.remove("PERSON_ID_right")
            exclusions_table = exclusions_table.select(columns)

        # fill all nones with False
        boolean_columns = [col for col in exclusions_table.columns if "BOOLEAN" in col]
        for col in boolean_columns:
            exclusions_table = exclusions_table.mutate(
                {col: exclusions_table[col].fill_null(False)}
            )

        # create the boolean inclusions column
        # this is true only if all inclusions criteria are true
        exclusions_table = exclusions_table.mutate(
            BOOLEAN=ibis.greatest(
                *[exclusions_table[f"{x.name}_BOOLEAN"] for x in self.phenotypes]
            )
        )

        return exclusions_table
