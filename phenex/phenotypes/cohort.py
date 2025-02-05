from typing import List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
import ibis
from ibis.expr.types.relations import Table
from phenex.tables import PhenotypeTable
from phenex.phenotypes.functions import hstack
from phenex.reporting import Table1


def subset_and_add_index_date(tables: Dict[str, Table], index_table: PhenotypeTable): 
    index_table = index_table.mutate(INDEX_DATE="EVENT_DATE")
    subset_tables = {}
    for key, table in tables.items():
        columns = ["INDEX_DATE"] + table.columns
        subset_tables[key] = type(table)(table.inner_join(index_table, "PERSON_ID").select(columns))
    return subset_tables


class Cohort(Phenotype):
    """
    The Cohort class represents a cohort of individuals based on specified entry criteria,
    inclusions, exclusions, and baseline characteristics. It extends the Phenotype class.

    Parameters:
        entry_criterion: The primary phenotype used to define the cohort.
        inclusions: A list of phenotypes that must be included in the cohort.
        exclusions: A list of phenotypes that must be excluded from the cohort.
        characteristics: A list of phenotypes representing baseline characteristics of the cohort.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Methods:
        execute(tables: Dict[str, Table]) -> PhenotypeTable:
            Executes the phenotype calculation and returns a table with the computed age.
    """

    table = None

    def __init__(
        self,
        name: str,
        entry_criterion: Phenotype,
        inclusions: Optional[List[Phenotype]] = None,
        exclusions: Optional[List[Phenotype]] = None,
        characteristics: Optional[List[Phenotype]] = None,
    ):
        """
        Initializes the Cohort with the specified entry criterion, inclusions, exclusions, and characteristics.

        Args:
            name (str): The name of the cohort.
            entry_criterion (Phenotype): The primary phenotype used to define the cohort.
            inclusions (Optional[List[Phenotype]]): A list of phenotypes that must be included in the cohort. Defaults to an empty list.
            exclusions (Optional[List[Phenotype]]): A list of phenotypes that must be excluded from the cohort. Defaults to an empty list.
            characteristics (Optional[List[Phenotype]]): A list of phenotypes representing baseline characteristics of the cohort. Defaults to an empty list.
        """
        super(Cohort, self).__init__()
        self.name = name
        self.entry_criterion = entry_criterion
        self.inclusions = inclusions if inclusions is not None else []
        self.exclusions = exclusions if exclusions is not None else []
        self.characteristics = characteristics if characteristics is not None else []
        self.index_table = None
        self.exclusions_table = None
        self.inclusions_table = None
        self.characteristics_table = None
        self.children = (
            [entry_criterion] + self.inclusions + self.exclusions + self.characteristics
        )
        self._table1 = None

    def execute(self, tables: Dict[str, Table], con:"SnowflakeConnector" = None) -> PhenotypeTable:
        """
        Executes the phenotype computation for the current object and its children.
        This method iterates over the children of the current object and calls their
        execute method if their table attribute is None. It then calls the _execute
        method to perform the actual computation for the current object. The resulting
        table is checked to ensure it contains the required phenotype columns. If the
        required columns are present, the table is filtered to include only these columns
        and assigned to the table attribute of the current object.

        Args:
            tables (Dict[str, Table]): A dictionary of table names to Table objects.

        Returns:
            PhenotypeTable: The resulting phenotype table containing the required columns.

        Raises:
            ValueError: If the table returned by _execute() does not contain the required phenotype
            columns.
        """
       # Compute entry criterion
        self.entry_criterion.execute(tables)
        self.subset_tables_entry = subset_and_add_index_date(tables, self.entry_criterion.table)
        index_table = self.entry_criterion.table
        # Apply inclusions if any
        if self.inclusions:
            self._compute_inclusions_table()
            include = self.inclusions_table.filter(
                self.inclusions_table["BOOLEAN"] == True
            ).select(["PERSON_ID"])
            index_table = index_table.inner_join(include, ["PERSON_ID"])

        # Apply exclusions if any
        if self.exclusions:
            self._compute_exclusions_table()
            exclude = self.exclusions_table.filter(
                self.exclusions_table["BOOLEAN"] == False
            ).select(["PERSON_ID"])
            index_table = index_table.inner_join(exclude, ["PERSON_ID"])

        self.index_table = index_table
        
        self.subset_tables_index = subset_and_add_index_date(tables, index_table)
        if self.characteristics:
           self._compute_characteristics_table()

        return index_table
    
    def _compute_inclusions_table(self) -> Table:
        """
        Compute the inclusions table from the individual inclusions phenotypes.
        Meant only to be called internally from execute() so that all dependent phenotypes
        have already been computed.

        Returns:
            Table: The join of all inclusion phenotypes together with a single "BOOLEAN"
            column that is the logical AND of all individual inclusion phenotypes
        """
        # create an inex table; 
        # rows are persons that fulfill the entry criterion
        # columns are inclusion criteria with true of false if that column pt criteria are fulfilled
        inclusions_table = self._compute_inex_table(self.inclusions)

        # create the final boolean inclusion column
        # this is true only if all inclusion criteria are true
        inclusions_table = inclusions_table.mutate(
            BOOLEAN=ibis.least(
                *[inclusions_table[f"{x.name}_BOOLEAN"] for x in self.inclusions]
            )
        )
        self.inclusions_table = inclusions_table
        return self.inclusions_table
 

    def _compute_exclusions_table(self) -> Table:
        """
        Compute the exclusions table from the individual exclusions phenotypes.

        Returns:
            Table: The join of all exclusions phenotypes together with a single "BOOLEAN"
            column that is the logical OR of all individual inclusion phenotypes
        """
        # create an inex table; 
        # rows are persons that fulfill the entry criterion
        # columns are inclusion criteria with true of false if fulfill
        exclusions_table = self._compute_inex_table(self.exclusions)

        # create the boolean inclusions column
        # this is true only if all inclusions criteria are true
        exclusions_table = exclusions_table.mutate(
            BOOLEAN=ibis.greatest(
                *[exclusions_table[f"{x.name}_BOOLEAN"] for x in self.exclusions]
            )
        )
        self.exclusions_table = exclusions_table
        return self.exclusions_table

    def _compute_inex_table(self, phenotypes: List["Phenotype"]) -> Table:
        """
        Compute the exclusion table from the individual exclusion phenotypes.

        Returns:
            Table: The join of all inclusion phenotypes together with a single "BOOLEAN"
            column that is the logical AND of all individual inclusion phenotypes
        """
        inex_table = self.entry_criterion.table.select(["PERSON_ID"])
        # execute all phenotypes and join the boolean column only
        for pt in phenotypes:
            pt.execute(self.subset_tables_entry)
            pt_table = pt.table.select(["PERSON_ID", "BOOLEAN"]).rename(
                **{
                    f"{pt.name}_BOOLEAN": "BOOLEAN",
                }
            )
            inex_table = inex_table.left_join(pt_table, ["PERSON_ID"])
            columns = inex_table.columns
            columns.remove("PERSON_ID_right")
            inex_table = inex_table.select(columns)
        
        # fill all nones with False
        boolean_columns = [col for col in inex_table.columns if "BOOLEAN" in col]
        for col in boolean_columns:
            inex_table = inex_table.mutate(
                {col: inex_table[col].fill_null(False)}
            )
        return inex_table

    def _compute_characteristics_table(self) -> Table:
        """
        Retrieves and joins all characteristic tables.
        Meant only to be called internally from _execute() so that all dependent phenotypes
        have already been computed.

        Returns:
            Table: The join of all characteristic tables.
        """
        for c in self.characteristics:
            c.execute(self.subset_tables_index)
        self.characteristics_table = hstack(
            self.characteristics,
            join_table=self.index_table.select(["PERSON_ID", "EVENT_DATE"]),
        )
        return self.characteristics_table

    @property
    def table1(self):
        if self._table1 is None:
            reporter = Table1()
            self._table1 = reporter.execute(self)
        return self._table1