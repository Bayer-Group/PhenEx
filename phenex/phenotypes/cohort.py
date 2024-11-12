from typing import List, Dict, Optional
from phenex.phenotypes.phenotype import Phenotype
import ibis
from ibis.expr.types.relations import Table
from phenex.tables import PhenotypeTable
from phenex.phenotypes.functions import hstack


def subset_and_add_index_date(tables: Dict[str, Table], index_table: PhenotypeTable):
    index_table = index_table.mutate(INDEX_DATE="EVENT_DATE")
    subset_tables = {}
    for key, table in tables.items():
        columns = ["INDEX_DATE"] + table.columns
        subset_tables[key] = table.join(index_table, "PERSON_ID").select(columns)
    return subset_tables


class Cohort(Phenotype):
    """
    The Cohort class represents a cohort of individuals based on specified entry criteria,
    inclusions, exclusions, and baseline characteristics. It extends the Phenotype class.

    Attributes:
        table (Table): The table representing the cohort.
        entry_criterion (Phenotype): The primary phenotype used to define the cohort.
        inclusions (List[Phenotype]): A list of phenotypes that must be included in the cohort.
        exclusions (List[Phenotype]): A list of phenotypes that must be excluded from the cohort.
        characteristics (List[Phenotype]): A list of phenotypes representing baseline characteristics of the cohort.
        children (List[Phenotype]): A list of all phenotypes involved in defining the cohort.
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

    def _execute(
        self,
        tables: Dict[str, Table],
    ) -> PhenotypeTable:
        """
        Executes the cohort definition by applying the entry criterion, inclusions, exclusions, and characteristics.

        Args:
            tables (Dict[str, Table]): A dictionary of tables available for phenotype execution.

        Returns:
            PhenotypeTable: The resulting table representing the cohort.
        """
        # Compute entry criterion
        entry_table = self.entry_criterion.table
        subset_tables_entry = subset_and_add_index_date(tables, entry_table)

        index_table = entry_table
        # Apply inclusions if any
        if self.inclusions:
            self._compute_inclusions_table()
            index_table = index_table.inner_join(
                self.inclusions_table.select(["PERSON_ID", "BOOLEAN"]), ["PERSON_ID"]
            )

        # Apply exclusions if any
        if self.exclusions:
            self._compute_exclusions_table()
            index_table = index_table.inner_join(
                self.exclusions_table.select(["PERSON_ID", "BOOLEAN"]), ["PERSON_ID"]
            )

        self.index_table = index_table
        subset_tables_index = subset_and_add_index_date(tables, index_table)
        if self.characteristics:
            self._compute_characteristics_table()

        return index_table

    def _compute_exclusions_table(self) -> Table:
        """
        Compute the exclusion table from the individual exclusion phenotypes.
        Meant only to be called internally from _execute() so that all dependent phenotypes
        have already been computed.

        Returns:
            Table: The join of all exclusion phenotypes together with a single "BOOLEAN"
            column that is the logical OR of all individual exclusion phenotypes
        """
        exclusions_table = self.entry_criterion.table.select(["PERSON_ID", "BOOLEAN"])
        for i in self.inclusions:
            i_table = i.table.select(["PERSON_ID", "BOOLEAN"]).rename(
                **{
                    f"{i.name}_BOOLEAN": "BOOLEAN",
                }
            )
            exclusions_table = exclusions_table.left_join(
                i_table, ["PERSON_ID"]
            ).fillna(False)
            columns = exclusions_table.columns
            columns.remove("PERSON_ID_right")
            exclusions_table = exclusions_table.select(columns)
            exclusions_table = exclusions_table.mutate(
                BOOLEAN=ibis.greatest(
                    exclusions_table["BOOLEAN"], exclusions_table[f"{i.name}_BOOLEAN"]
                )
            )

        boolean_columns = [col for col in exclusions_table.columns if "BOOLEAN" in col]
        for col in boolean_columns:
            exclusions_table = exclusions_table.mutate(
                {col: exclusions_table[col].fill_null(False)}
            )

        self.exclusions_table = exclusions_table
        return self.exclusions_table

    def _compute_inclusions_table(self) -> Table:
        """
        Compute the exclusion table from the individual exclusion phenotypes.
        Meant only to be called internally from _execute() so that all dependent phenotypes
        have already been computed.

        Returns:
            Table: The join of all inclusion phenotypes together with a single "BOOLEAN"
            column that is the logical AND of all individual inclusion phenotypes
        """
        inclusions_table = self.entry_criterion.table.select(["PERSON_ID", "BOOLEAN"])
        for i in self.inclusions:
            i_table = i.table.select(["PERSON_ID", "BOOLEAN"]).rename(
                **{
                    f"{i.name}_BOOLEAN": "BOOLEAN",
                }
            )
            inclusions_table = inclusions_table.left_join(i_table, ["PERSON_ID"])
            columns = inclusions_table.columns
            columns.remove("PERSON_ID_right")
            inclusions_table = inclusions_table.select(columns)
            inclusions_table = inclusions_table.mutate(
                BOOLEAN=ibis.least(
                    inclusions_table["BOOLEAN"], inclusions_table[f"{i.name}_BOOLEAN"]
                )
            )

        boolean_columns = [col for col in inclusions_table.columns if "BOOLEAN" in col]
        for col in boolean_columns:
            inclusions_table = inclusions_table.mutate(
                {col: inclusions_table[col].fill_null(False)}
            )

        self.inclusions_table = inclusions_table

        return self.inclusions_table

    def _compute_characteristics_table(self) -> Table:
        """
        Retrieves and joins all characteristic tables.
        Meant only to be called internally from _execute() so that all dependent phenotypes
        have already been computed.

        Returns:
            Table: The join of all characteristic tables.
        """
        self.characteristics_table = hstack(
            self.characteristics,
            join_table=self.index_table.select(["PERSON_ID", "EVENT_DATE"]),
        )
        return self.characteristics_table

    @property
    def table1(self):
        if self._table1 is None:
            ds = []
            N = (
                self.index_table.filter(self.index_table.BOOLEAN == 1)
                .select("PERSON_ID")
                .distinct()
                .count()
                .execute()
            )

            ds.append({"name": self.name, "N": N, "%": 100})
            for pt in self.characteristics:
                d = {}
                print(pt.name)
                d["name"] = pt.name
                d["N"] = pt.table.filter(pt.table.BOOLEAN == 1).count().execute()
                d["%"] = 100 * d["N"] / N
                ds.append(d)
            import pandas as pd

            self._table1 = pd.DataFrame(ds)
        return self._table1
