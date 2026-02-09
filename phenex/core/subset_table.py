from typing import Dict
from ibis.expr.types.relations import Table
from phenex.node import Node
from phenex.phenotypes.phenotype import Phenotype
from phenex.util import create_logger

logger = create_logger(__name__)


class SubsetTable(Node):
    """
    A compute node that creates a subset of a domain table by joining it with an index phenotype.

    This node takes a table from a specific domain and filters it to include only records for patients who have entries in the index phenotype table. The resulting table contains all original columns from the domain table plus an INDEX_DATE column from the index phenotype.

    Parameters:
        name: Name identifier for this subset table node.
        domain: The domain name (e.g., 'PERSON', 'CONDITION_OCCURRENCE') of the table to subset.
        index_phenotype: The phenotype used to filter the domain table. Only patients present in this phenotype's table will be included in the subset.

    Attributes:
        index_phenotype: The phenotype used for subsetting.
        domain: The domain of the table being subset.

    Example:
        ```python
        # Create a subset of the CONDITION_OCCURRENCE table based on diabetes patients
        diabetes_subset = SubsetTable(
            name="DIABETES_CONDITIONS",
            domain="CONDITION_OCCURRENCE",
            index_phenotype=diabetes_phenotype
        )
        ```
    """

    def __init__(self, name: str, domain: str, index_phenotype: Phenotype):
        super(SubsetTable, self).__init__(name=name)
        self.add_children(index_phenotype)
        self.index_phenotype = index_phenotype
        self.domain = domain

    def _execute(self, tables: Dict[str, Table]):
        table = tables.get(self.domain)

        # Skip subsetting if table doesn't exist in source data
        if table is None:
            logger.warning(
                f"Table for domain '{self.domain}' not found in source data. Skipping subset for '{self.name}'."
            )
            return None

        index_table = self.index_phenotype.table

        # Check if EVENT_DATE exists in the index table
        if "EVENT_DATE" in index_table.columns:
            index_table = index_table.rename({"INDEX_DATE": "EVENT_DATE"})
            columns = list(set(["INDEX_DATE"] + table.columns))
        else:
            logger.warning(
                f"EVENT_DATE column not found in index_phenotype table for SubsetTable '{self.name}'. INDEX_DATE will not be set."
            )
            columns = table.columns

        subset_table = table.inner_join(index_table, "PERSON_ID")
        subset_table = subset_table.select(columns)
        return subset_table
