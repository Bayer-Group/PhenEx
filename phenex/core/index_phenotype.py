from typing import Dict, Optional
from ibis.expr.types.relations import Table
import ibis
from phenex.node import Node
from phenex.phenotypes.phenotype import Phenotype
from phenex.util import create_logger

logger = create_logger(__name__)


class IndexPhenotype(Phenotype):
    """
    Compute the index table from the individual inclusions / exclusions phenotypes.

    Parameters:
        return_index: Controls how multiple candidate index dates per patient are handled
            after inclusion/exclusion filtering:
            - "first": keep earliest passing INDEX_DATE per patient (default)
            - "last": keep latest passing INDEX_DATE per patient
            - "all": keep all passing INDEX_DATEs
        max_index_dates: When set, cap the number of candidate entry dates per patient
            to at most this many (keeping the earliest N) before applying inclusion/exclusion.
    """

    def __init__(
        self,
        name: str,
        entry_phenotype: Phenotype,
        inclusion_table_node: Node,
        exclusion_table_node: Node,
        return_index: str = "first",
        max_index_dates: Optional[int] = None,
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
        self.return_index = return_index
        self.max_index_dates = max_index_dates

    def _execute(self, tables: Dict[str, Table]):
        index_table = self.entry_phenotype.table.mutate(INDEX_DATE="EVENT_DATE")

        # Apply max_index_dates cap: keep only the N earliest candidate dates per patient
        if self.max_index_dates is not None:
            w = ibis.window(group_by="PERSON_ID", order_by="INDEX_DATE")
            index_table = index_table.mutate(_rn=ibis.row_number().over(w))
            n_before = index_table.count()
            index_table = index_table.filter(index_table._rn < self.max_index_dates)
            index_table = index_table.drop("_rn")
            logger.info(
                f"IndexPhenotype '{self.name}': applied max_index_dates={self.max_index_dates}"
            )

        if self.inclusion_table_node:
            inc_keys = ["PERSON_ID"] + (
                ["INDEX_DATE"]
                if "INDEX_DATE" in self.inclusion_table_node.table.columns
                else []
            )
            include = self.inclusion_table_node.table.filter(
                self.inclusion_table_node.table["BOOLEAN"] == True
            ).select(inc_keys)
            index_table = index_table.inner_join(include, inc_keys)

        if self.exclusion_table_node:
            exc_keys = ["PERSON_ID"] + (
                ["INDEX_DATE"]
                if "INDEX_DATE" in self.exclusion_table_node.table.columns
                else []
            )
            exclude = self.exclusion_table_node.table.filter(
                self.exclusion_table_node.table["BOOLEAN"] == False
            ).select(exc_keys)
            index_table = index_table.inner_join(exclude, exc_keys)

        # Apply return_index selection after inclusion/exclusion filtering
        if self.return_index == "first":
            w = ibis.window(group_by="PERSON_ID", order_by="INDEX_DATE")
            index_table = index_table.mutate(_rn=ibis.row_number().over(w))
            index_table = index_table.filter(index_table._rn == 0).drop("_rn")
        elif self.return_index == "last":
            w = ibis.window(group_by="PERSON_ID", order_by=ibis.desc("INDEX_DATE"))
            index_table = index_table.mutate(_rn=ibis.row_number().over(w))
            index_table = index_table.filter(index_table._rn == 0).drop("_rn")
        # "all": keep everything

        # Deduplicate to at most one row per (PERSON_ID, INDEX_DATE)
        dedup_keys = ["PERSON_ID"] + (
            ["INDEX_DATE"] if "INDEX_DATE" in index_table.columns else []
        )
        w = ibis.window(group_by=dedup_keys, order_by="EVENT_DATE")
        index_table = index_table.mutate(_dedup_rn=ibis.row_number().over(w))
        index_table = index_table.filter(index_table._dedup_rn == 0).drop("_dedup_rn")

        return index_table
